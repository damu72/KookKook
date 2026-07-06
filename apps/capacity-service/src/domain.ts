// Domänenmodell + Repository-Port des Capacity Service.
//
// Die Geschäftslogik hängt NUR von der `CapacityRepository`-Schnittstelle ab,
// nicht von einer konkreten Speicherung. So lässt sich die aktuelle
// In-Memory-Implementierung später gegen ein Postgres-Repository austauschen,
// ohne Server-/Routen-Code zu ändern.

export type ReservationStatus = "active" | "released";

/** Kapazitäts-Definition eines Topics. */
export interface Capacity {
  topicId: string;
  maxGuests: number;
}

/** Sicht auf die Kapazität inkl. aktueller Auslastung. */
export interface CapacityView {
  topicId: string;
  maxGuests: number;
  reservedSeats: number;
  availableSeats: number;
}

export interface SeatReservation {
  id: string;
  topicId: string;
  userId: string;
  status: ReservationStatus;
  /**
   * Optionaler Idempotenz-Schlüssel des Aufrufers. Ein wiederholter
   * reserveSeat mit demselben Schlüssel liefert dieselbe Reservierung, statt
   * eine zweite anzulegen (macht Retries des nicht-idempotenten POST sicher).
   * In Postgres entspräche das einem UNIQUE-Index auf diesem Schlüssel.
   */
  idempotencyKey: string | null;
  createdAt: string;
  releasedAt: string | null;
}

// --- Fehler (vom Server auf HTTP-Codes gemappt) ----------------------------
export class CapacityExistsError extends Error {
  constructor(topicId: string) {
    super(`capacity for topic ${topicId} already exists`);
    this.name = "CapacityExistsError";
  }
}

export class CapacityNotFoundError extends Error {
  constructor(topicId: string) {
    super(`no capacity defined for topic ${topicId}`);
    this.name = "CapacityNotFoundError";
  }
}

export class CapacityFullError extends Error {
  constructor(topicId: string) {
    super(`no seats available for topic ${topicId}`);
    this.name = "CapacityFullError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`reservation ${reservationId} not found`);
    this.name = "ReservationNotFoundError";
  }
}

/**
 * Port für die Persistenz. Implementierungen MÜSSEN garantieren, dass
 * `reserveSeat` die Invariante `aktive Reservierungen <= maxGuests` auch bei
 * nebenläufigen Aufrufen einhält (In-Memory über einen Lock, Postgres z.B.
 * über eine Transaktion mit `SELECT ... FOR UPDATE` bzw. eine Bedingung).
 */
export interface CapacityRepository {
  createCapacity(topicId: string, maxGuests: number): Promise<CapacityView>;
  getCapacity(topicId: string): Promise<CapacityView>;
  /**
   * Reserviert atomar einen Platz oder wirft CapacityFull/CapacityNotFound.
   * Wird `idempotencyKey` übergeben und existiert dazu bereits eine aktive
   * Reservierung, wird diese unverändert zurückgegeben.
   */
  reserveSeat(
    topicId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<SeatReservation>;
  /** Gibt eine Reservierung frei (idempotent). */
  releaseReservation(reservationId: string): Promise<SeatReservation>;
}
