// 127.0.0.1 statt localhost: Node/undici löst "localhost" bevorzugt auf IPv6
// (::1) auf, während die Services auf IPv4 (0.0.0.0) lauschen -> ECONNREFUSED.
const PARTICIPATION_SERVICE_URL =
  process.env.PARTICIPATION_SERVICE_URL ?? "http://127.0.0.1:3002";

interface ParticipationRecord {
  id: string;
  topicId: string;
  userId: string;
  status: string;
}

/**
 * "Akzeptierter Teilnehmer" = im Participation Service als `joined` geführt.
 * (waitlist/cancelled zählen nicht.)
 */
const ACCEPTED_STATUS = "joined";

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
  const url = `${PARTICIPATION_SERVICE_URL}/participations?topicId=${encodeURIComponent(
    topicId,
  )}&userId=${encodeURIComponent(userId)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`participation-service responded ${res.status} ${res.statusText}`);
  }
  const records = (await res.json()) as ParticipationRecord[];
  return records.some((p) => p.status === ACCEPTED_STATUS);
}
