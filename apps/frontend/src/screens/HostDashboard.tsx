import { useState } from "react";
import { Navigate } from "../App.js";
import {
  ApiError,
  ParticipationRequest,
  Topic,
  acceptRequest,
  declineRequest,
  listRequestsByTopic,
  listTopics,
} from "../api.js";
import { displayName } from "../users.js";
import { StatusBadge, formatDateTime, useAsync } from "../ui.js";

interface HostTopic {
  topic: Topic;
  requests: ParticipationRequest[];
}

export function HostDashboard({
  navigate,
  currentUser,
}: {
  navigate: Navigate;
  currentUser: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const { data, error, loading, reload } = useAsync<HostTopic[]>(async () => {
    const topics = await listTopics();
    const mine = topics.filter((t) => t.hostUserId === currentUser);
    return Promise.all(
      mine.map(async (topic) => ({ topic, requests: await listRequestsByTopic(topic.id) })),
    );
  }, [currentUser]);

  async function act(kind: "accept" | "decline", req: ParticipationRequest) {
    setBusyId(req.id);
    setMessage(null);
    try {
      if (kind === "accept") await acceptRequest(req.id, currentUser);
      else await declineRequest(req.id, currentUser, "Vom Gastgeber abgelehnt");
      reload();
    } catch (e) {
      const err = e as ApiError;
      const text =
        err.reason === "NO_SEATS_AVAILABLE"
          ? "Kein freier Platz mehr – die Anfrage bleibt offen."
          : err.message;
      setMessage({ kind: "error", text } as { kind: "error"; text: string });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="empty">Lädt…</p>;
  if (error) return <div className="notice error">Fehler: {error}</div>;

  const hosted = data ?? [];

  return (
    <div>
      <h1>Host-Dashboard</h1>
      <p className="subtitle">Anfragen an deine Kochabende als {displayName(currentUser)}.</p>

      {message && <div className={`notice ${message.kind}`}>{message.text}</div>}

      {hosted.length === 0 && (
        <p className="empty">
          Du bist noch für keinen Kochabend Gastgeber.{" "}
          <button className="link" onClick={() => navigate({ name: "create" })}>
            Jetzt einen anlegen →
          </button>
        </p>
      )}

      {hosted.map(({ topic, requests }) => {
        const pending = requests.filter((r) => r.status === "REQUESTED");
        const accepted = requests.filter((r) => r.status === "ACCEPTED");
        return (
          <div key={topic.id} className="card" style={{ marginBottom: "1rem" }}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>{topic.title}</h3>
              <span className="meta">📅 {formatDateTime(topic.startsAt)}</span>
            </div>
            <p className="meta" style={{ marginTop: "0.35rem" }}>
              {accepted.length} / {topic.maxGuests} bestätigt · {pending.length} offen
            </p>

            {requests.length === 0 && <p className="hint">Noch keine Anfragen.</p>}

            {requests.map((r) => (
              <div key={r.id} className="spread" style={{ marginTop: "0.6rem" }}>
                <div className="row">
                  <strong>{displayName(r.guestUserId)}</strong>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === "REQUESTED" && (
                  <div className="row">
                    <button
                      className="btn ok small"
                      disabled={busyId === r.id}
                      onClick={() => act("accept", r)}
                    >
                      Akzeptieren
                    </button>
                    <button
                      className="btn danger small"
                      disabled={busyId === r.id}
                      onClick={() => act("decline", r)}
                    >
                      Ablehnen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
