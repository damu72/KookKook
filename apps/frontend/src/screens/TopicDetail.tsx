import { useState } from "react";
import { Navigate } from "../App.js";
import {
  ApiError,
  Capacity,
  ParticipationRequest,
  Topic,
  createRequest,
  getCapacity,
  getTopic,
  listRequestsByUser,
} from "../api.js";
import { displayName } from "../users.js";
import { StatusBadge, formatDateTime, useAsync } from "../ui.js";

interface Loaded {
  topic: Topic;
  capacity: Capacity | null;
  myRequest: ParticipationRequest | null;
}

export function TopicDetail({
  topicId,
  navigate,
  currentUser,
}: {
  topicId: string;
  navigate: Navigate;
  currentUser: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(
    null,
  );

  const { data, error, loading, reload } = useAsync<Loaded>(async () => {
    const [topic, mine] = await Promise.all([
      getTopic(topicId),
      listRequestsByUser(currentUser),
    ]);
    const capacity = await getCapacity(topicId).catch(() => null);
    const myRequest =
      mine.find((r) => r.topicId === topicId && (r.status === "REQUESTED" || r.status === "ACCEPTED")) ??
      mine.find((r) => r.topicId === topicId) ??
      null;
    return { topic, capacity, myRequest };
  }, [topicId, currentUser]);

  async function requestSeat() {
    setBusy(true);
    setMessage(null);
    try {
      await createRequest(topicId, currentUser);
      setMessage({ kind: "success", text: "Anfrage gesendet! Der Gastgeber entscheidet." });
      reload();
    } catch (e) {
      const err = e as ApiError;
      let text = err.message;
      if (err.reason === "LOW_TRUST") text = "Anfrage nicht möglich: zu wenig Vertrauen zum Gastgeber.";
      if (err.status === 409) text = "Du hast für diesen Abend bereits eine aktive Anfrage.";
      setMessage({ kind: "error", text });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="empty">Lädt…</p>;
  if (error || !data) return <div className="notice error">Fehler: {error}</div>;

  const { topic, capacity, myRequest } = data;
  const isHost = topic.hostUserId === currentUser;

  return (
    <div>
      <button className="link back" onClick={() => navigate({ name: "discover" })}>
        ← Zurück
      </button>
      <h1>{topic.title}</h1>
      <div className="meta">
        <span className="pill">{topic.cuisine || "Küche"}</span>
        <span>📅 {formatDateTime(topic.startsAt)}</span>
        <span>📍 {topic.publicLocationLabel || "Ort auf Anfrage"}</span>
        <span>👥 max. {topic.maxGuests}</span>
        {capacity && <span>🪑 {capacity.availableSeats} frei</span>}
      </div>

      <p style={{ marginTop: "1rem" }}>{topic.description || "Keine Beschreibung."}</p>
      <p className="subtitle">Gastgeber: {displayName(topic.hostUserId)}</p>

      <div className="card" style={{ marginTop: "1rem" }}>
        {isHost ? (
          <div className="spread">
            <span>Das ist dein Kochabend.</span>
            <button className="btn secondary" onClick={() => navigate({ name: "host" })}>
              Anfragen verwalten
            </button>
          </div>
        ) : myRequest ? (
          <div>
            <div className="row">
              <span>Dein Status:</span>
              <StatusBadge status={myRequest.status} />
            </div>
            {myRequest.status === "ACCEPTED" && (
              <button
                className="btn ok"
                style={{ marginTop: "0.75rem" }}
                onClick={() => navigate({ name: "confirmed", topicId })}
              >
                Adresse & Details ansehen
              </button>
            )}
            {myRequest.status === "DECLINED" && myRequest.declineReason && (
              <p className="hint">Grund: {myRequest.declineReason}</p>
            )}
          </div>
        ) : (
          <button className="btn" onClick={requestSeat} disabled={busy}>
            {busy ? "Sende…" : "Teilnahme anfragen"}
          </button>
        )}

        {message && <div className={`notice ${message.kind}`}>{message.text}</div>}
      </div>
    </div>
  );
}
