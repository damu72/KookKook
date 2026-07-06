// 127.0.0.1 statt localhost: Node/undici löst "localhost" bevorzugt auf IPv6
// (::1) auf, während die Services auf IPv4 (0.0.0.0) lauschen -> ECONNREFUSED.
const PARTICIPATION_SERVICE_URL =
  process.env.PARTICIPATION_SERVICE_URL ?? "http://127.0.0.1:3002";

interface ParticipationRequest {
  id: string;
  topicId: string;
  guestUserId: string;
  status: string;
}

/**
 * "Akzeptierter Teilnehmer" = Teilnahme-Anfrage im Status ACCEPTED.
 * (REQUESTED/DECLINED/CANCELLED zählen nicht.)
 */
const ACCEPTED_STATUS = "ACCEPTED";

/**
 * Fragt den Participation Service (HTTP, MVP) danach, ob `userId` ein
 * akzeptierter Teilnehmer von `topicId` ist.
 *
 * Wirft bei Netzwerk-/Serverfehlern – der Aufrufer entscheidet, wie damit
 * umzugehen ist (im Zweifel: keine privaten Details ausliefern).
 */
export async function isAcceptedParticipant(
  topicId: string,
  userId: string,
): Promise<boolean> {
  const url = `${PARTICIPATION_SERVICE_URL}/topics/${encodeURIComponent(
    topicId,
  )}/participation-requests`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`participation-service responded ${res.status} ${res.statusText}`);
  }
  const requests = (await res.json()) as ParticipationRequest[];
  return requests.some((r) => r.guestUserId === userId && r.status === ACCEPTED_STATUS);
}
