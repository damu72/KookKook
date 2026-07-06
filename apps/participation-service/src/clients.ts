import { NoSeatsAvailableError, TopicNotFoundError, UpstreamUnavailableError } from "./domain.js";

// 127.0.0.1 statt localhost (Node/undici bevorzugt sonst IPv6 ::1).
const TOPIC_SERVICE_URL = process.env.TOPIC_SERVICE_URL ?? "http://127.0.0.1:3001";
const TRUST_SERVICE_URL = process.env.TRUST_SERVICE_URL ?? "http://127.0.0.1:3004";
const CAPACITY_SERVICE_URL = process.env.CAPACITY_SERVICE_URL ?? "http://127.0.0.1:3003";

/**
 * fetch mit kleinem Retry gegen transiente Verbindungsfehler (z.B. ein
 * ECONNRESET auf einer frisch aufgebauten Verbindung). NUR für idempotente
 * GET-Requests verwenden – POSTs (Reservierung!) dürfen nicht blind wiederholt
 * werden.
 */
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      lastErr = err;
      // kurzes, wachsendes Backoff
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  throw lastErr;
}

// --- Topic Service ---------------------------------------------------------
interface PublicTopic {
  id: string;
  hostUserId: string;
  title: string;
}

/** Holt das Topic (öffentliche Sicht) – wir brauchen v.a. den hostUserId. */
export async function fetchTopic(topicId: string): Promise<PublicTopic> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${TOPIC_SERVICE_URL}/topics/${encodeURIComponent(topicId)}`);
  } catch (err) {
    throw new UpstreamUnavailableError("topic-service", err);
  }
  if (res.status === 404) throw new TopicNotFoundError(topicId);
  if (!res.ok) throw new UpstreamUnavailableError("topic-service");
  return (await res.json()) as PublicTopic;
}

// --- Trust Service ---------------------------------------------------------
interface CanInteractResult {
  canInteract: boolean;
  reason: string | null;
}

/** Prüft can-interact zwischen zwei Usern. Fail-closed via UpstreamError. */
export async function checkCanInteract(
  fromUserId: string,
  toUserId: string,
): Promise<CanInteractResult> {
  const url = `${TRUST_SERVICE_URL}/can-interact?fromUserId=${encodeURIComponent(
    fromUserId,
  )}&toUserId=${encodeURIComponent(toUserId)}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url);
  } catch (err) {
    throw new UpstreamUnavailableError("trust-service", err);
  }
  if (!res.ok) throw new UpstreamUnavailableError("trust-service");
  return (await res.json()) as CanInteractResult;
}

// --- Capacity Service ------------------------------------------------------
interface SeatReservation {
  id: string;
  topicId: string;
  userId: string;
  status: string;
}

/**
 * Reserviert einen Platz. Wirft NoSeatsAvailableError bei 409 (voll) bzw. 404
 * (keine Kapazität definiert), sonst UpstreamUnavailableError.
 *
 * `idempotencyKey` (die Teilnahme-Request-ID) macht die Reservierung
 * wiederholbar: Der Retry bei einem transienten Verbindungsfehler kann keinen
 * zweiten Platz belegen – capacity liefert dieselbe Reservierung zurück.
 */
export async function reserveSeat(
  topicId: string,
  userId: string,
  idempotencyKey: string,
): Promise<SeatReservation> {
  const body = JSON.stringify({ topicId, userId, idempotencyKey });
  let res: Response;
  let lastErr: unknown;
  let done = false;
  for (let i = 0; i < 3 && !done; i++) {
    try {
      res = await fetch(`${CAPACITY_SERVICE_URL}/seat-reservations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      done = true;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  if (!done) throw new UpstreamUnavailableError("capacity-service", lastErr);
  if (res!.status === 409 || res!.status === 404) {
    throw new NoSeatsAvailableError(topicId);
  }
  if (!res!.ok) throw new UpstreamUnavailableError("capacity-service");
  return (await res!.json()) as SeatReservation;
}

/** Gibt eine Reservierung frei (best effort – Fehler werden dem Aufrufer gemeldet). */
export async function releaseReservation(reservationId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `${CAPACITY_SERVICE_URL}/seat-reservations/${encodeURIComponent(reservationId)}/release`,
      { method: "POST" },
    );
  } catch (err) {
    throw new UpstreamUnavailableError("capacity-service", err);
  }
  // 404 (unbekannte Reservierung, z.B. Seed-Daten) ist für die Freigabe unkritisch.
  if (!res.ok && res.status !== 404) throw new UpstreamUnavailableError("capacity-service");
}
