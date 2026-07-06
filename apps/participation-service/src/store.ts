import { ParticipationRequest, ParticipationStatus, isActive } from "./domain.js";

// In-memory store. Kapselt den Zugriff, damit später eine DB dahinter kann.
const requests = new Map<string, ParticipationRequest>();
let nextId = 1;

function now(): string {
  return new Date().toISOString();
}

export function getRequest(id: string): ParticipationRequest | undefined {
  return requests.get(id);
}

export function listByTopic(topicId: string): ParticipationRequest[] {
  return Array.from(requests.values()).filter((r) => r.topicId === topicId);
}

export function listByUser(userId: string): ParticipationRequest[] {
  return Array.from(requests.values()).filter((r) => r.guestUserId === userId);
}

/** Gibt es für diesen Gast bereits eine aktive Anfrage zu diesem Topic? */
export function hasActiveRequest(topicId: string, guestUserId: string): boolean {
  return Array.from(requests.values()).some(
    (r) => r.topicId === topicId && r.guestUserId === guestUserId && isActive(r.status),
  );
}

export function createRequest(
  topicId: string,
  guestUserId: string,
  hostUserId: string,
): ParticipationRequest {
  const ts = now();
  const request: ParticipationRequest = {
    id: String(nextId++),
    topicId,
    guestUserId,
    hostUserId,
    status: "REQUESTED",
    declineReason: null,
    reservationId: null,
    createdAt: ts,
    updatedAt: ts,
  };
  requests.set(request.id, request);
  return request;
}

export function updateRequest(
  request: ParticipationRequest,
  patch: Partial<Pick<ParticipationRequest, "status" | "declineReason" | "reservationId">>,
): ParticipationRequest {
  Object.assign(request, patch, { updatedAt: now() });
  return request;
}

/**
 * Seed-Daten (nur für den Start). Setzt terminale/aktive Zustände direkt,
 * ohne die echten Cross-Service-Calls – die laufen erst zur Laufzeit.
 * Konsistent zu den Topic-Service-Seeds (Host je Topic).
 */
export function seed(): void {
  const ts = now();
  const seeds: Array<Omit<ParticipationRequest, "id" | "createdAt" | "updatedAt">> = [
    { topicId: "1", guestUserId: "ben", hostUserId: "anna", status: "ACCEPTED", declineReason: null, reservationId: "seed-r1" },
    { topicId: "1", guestUserId: "clara", hostUserId: "anna", status: "REQUESTED", declineReason: null, reservationId: null },
    { topicId: "2", guestUserId: "clara", hostUserId: "ben", status: "ACCEPTED", declineReason: null, reservationId: "seed-r2" },
    { topicId: "2", guestUserId: "david", hostUserId: "ben", status: "REQUESTED", declineReason: null, reservationId: null },
  ];
  for (const s of seeds) {
    const id = String(nextId++);
    requests.set(id, { id, createdAt: ts, updatedAt: ts, ...s });
  }
}

// Nur für Zustandssicht/Status-Konstanten im Server nützlich.
export type { ParticipationStatus };
