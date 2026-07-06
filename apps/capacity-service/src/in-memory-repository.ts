import {
  Capacity,
  CapacityExistsError,
  CapacityFullError,
  CapacityNotFoundError,
  CapacityRepository,
  CapacityView,
  ReservationNotFoundError,
  SeatReservation,
} from "./domain.js";
import { KeyedMutex } from "./keyed-mutex.js";

/**
 * In-Memory-Umsetzung des CapacityRepository.
 *
 * Die Reservierungs-Invariante wird über einen KeyedMutex pro Topic
 * abgesichert: "Plätze zählen -> prüfen -> anlegen" läuft nie verschränkt mit
 * einer anderen Reservierung/Freigabe desselben Topics. Nebenläufige Requests
 * können damit zusammen nie mehr aktive Reservierungen erzeugen als maxGuests.
 */
export class InMemoryCapacityRepository implements CapacityRepository {
  private capacities = new Map<string, Capacity>();
  private reservations = new Map<string, SeatReservation>();
  private mutex = new KeyedMutex();
  private nextId = 1;

  private countActive(topicId: string): number {
    let n = 0;
    for (const r of this.reservations.values()) {
      if (r.topicId === topicId && r.status === "active") n++;
    }
    return n;
  }

  private toView(cap: Capacity): CapacityView {
    const reservedSeats = this.countActive(cap.topicId);
    return {
      topicId: cap.topicId,
      maxGuests: cap.maxGuests,
      reservedSeats,
      availableSeats: Math.max(0, cap.maxGuests - reservedSeats),
    };
  }

  async createCapacity(topicId: string, maxGuests: number): Promise<CapacityView> {
    return this.mutex.runExclusive(topicId, () => {
      if (this.capacities.has(topicId)) throw new CapacityExistsError(topicId);
      const cap: Capacity = { topicId, maxGuests };
      this.capacities.set(topicId, cap);
      return this.toView(cap);
    });
  }

  async getCapacity(topicId: string): Promise<CapacityView> {
    const cap = this.capacities.get(topicId);
    if (!cap) throw new CapacityNotFoundError(topicId);
    return this.toView(cap);
  }

  async reserveSeat(
    topicId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<SeatReservation> {
    // Kritischer Abschnitt pro Topic – atomar gegen andere reserve/release.
    return this.mutex.runExclusive(topicId, () => {
      const cap = this.capacities.get(topicId);
      if (!cap) throw new CapacityNotFoundError(topicId);

      // Idempotenz: gibt es zum Schlüssel bereits eine aktive Reservierung,
      // wird sie zurückgegeben (kein zweiter Platz wird belegt).
      if (idempotencyKey) {
        for (const r of this.reservations.values()) {
          if (r.idempotencyKey === idempotencyKey && r.status === "active") return r;
        }
      }

      if (this.countActive(topicId) >= cap.maxGuests) {
        throw new CapacityFullError(topicId);
      }
      const reservation: SeatReservation = {
        id: String(this.nextId++),
        topicId,
        userId,
        status: "active",
        idempotencyKey: idempotencyKey ?? null,
        createdAt: new Date().toISOString(),
        releasedAt: null,
      };
      this.reservations.set(reservation.id, reservation);
      return reservation;
    });
  }

  async releaseReservation(reservationId: string): Promise<SeatReservation> {
    const existing = this.reservations.get(reservationId);
    if (!existing) throw new ReservationNotFoundError(reservationId);
    // Freigabe unter demselben Topic-Lock, damit ein parallel laufendes
    // reserveSeat den frei werdenden Platz konsistent sieht.
    return this.mutex.runExclusive(existing.topicId, () => {
      const r = this.reservations.get(reservationId);
      if (!r) throw new ReservationNotFoundError(reservationId);
      if (r.status === "active") {
        r.status = "released";
        r.releasedAt = new Date().toISOString();
      }
      return r; // idempotent: bereits freigegebene Reservierung wird zurückgegeben
    });
  }

  // --- nur für den Start: Demo-Daten -------------------------------------
  async seed(entries: Array<{ topicId: string; maxGuests: number }>): Promise<void> {
    for (const e of entries) await this.createCapacity(e.topicId, e.maxGuests);
  }
}
