// Domänenmodell des Participation Service.
//
// Zustandsmaschine einer Teilnahme-Anfrage:
//
//   REQUESTED --accept--> ACCEPTED  (Host; Platz im Capacity Service reserviert)
//   REQUESTED --decline--> DECLINED (Host)
//   REQUESTED --cancel--> CANCELLED (Gast)
//   ACCEPTED  --cancel--> CANCELLED (Gast; Reservierung wird freigegeben)
//
// DECLINED und CANCELLED sind terminal. "Aktiv" = REQUESTED oder ACCEPTED.

export type ParticipationStatus = "REQUESTED" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export const ACTIVE_STATUSES: ParticipationStatus[] = ["REQUESTED", "ACCEPTED"];

export interface ParticipationRequest {
  id: string;
  topicId: string;
  guestUserId: string;
  hostUserId: string;
  status: ParticipationStatus;
  /** Grund bei DECLINED, z.B. "NO_SEATS_AVAILABLE" oder Host-Text. */
  declineReason: string | null;
  /** Reservierungs-ID aus dem Capacity Service, sobald ACCEPTED. */
  reservationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isActive(status: ParticipationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

// --- Fehler (vom Server auf HTTP-Codes gemappt) ----------------------------
export class DuplicateActiveRequestError extends Error {
  constructor(topicId: string, guestUserId: string) {
    super(`guest ${guestUserId} already has an active request for topic ${topicId}`);
    this.name = "DuplicateActiveRequestError";
  }
}

export class TrustDeniedError extends Error {
  constructor(public readonly reason: string) {
    super(`interaction not allowed by trust service: ${reason}`);
    this.name = "TrustDeniedError";
  }
}

export class TopicNotFoundError extends Error {
  constructor(topicId: string) {
    super(`topic ${topicId} not found`);
    this.name = "TopicNotFoundError";
  }
}

export class RequestNotFoundError extends Error {
  constructor(id: string) {
    super(`participation request ${id} not found`);
    this.name = "RequestNotFoundError";
  }
}

export class NotHostError extends Error {
  constructor() {
    super("only the host of the topic may perform this action");
    this.name = "NotHostError";
  }
}

export class NotGuestError extends Error {
  constructor() {
    super("only the guest who created the request may cancel it");
    this.name = "NotGuestError";
  }
}

export class InvalidStateError extends Error {
  constructor(from: ParticipationStatus, action: string) {
    super(`cannot ${action} a request in state ${from}`);
    this.name = "InvalidStateError";
  }
}

export class NoSeatsAvailableError extends Error {
  public readonly reason = "NO_SEATS_AVAILABLE";
  constructor(topicId: string) {
    super(`no seats available for topic ${topicId}`);
    this.name = "NoSeatsAvailableError";
  }
}

/** Ein abhängiger Service (Trust/Capacity/Topic) war nicht erreichbar. */
export class UpstreamUnavailableError extends Error {
  constructor(service: string, cause?: unknown) {
    super(`upstream service unavailable: ${service}`);
    this.name = "UpstreamUnavailableError";
    if (cause) this.cause = cause;
  }
}
