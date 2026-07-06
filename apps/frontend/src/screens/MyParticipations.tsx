import { useState } from "react";
import { Navigate } from "../App.js";
import {
  ApiError,
  ParticipationRequest,
  cancelRequest,
  listRequestsByUser,
  listTopics,
} from "../api.js";
import { displayName } from "../users.js";
import { StatusBadge, useAsync } from "../ui.js";

interface Loaded {
  requests: ParticipationRequest[];
  titles: Record<string, string>;
}

export function MyParticipations({
  navigate,
  currentUser,
}: {
  navigate: Navigate;
  currentUser: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError, loading, reload } = useAsync<Loaded>(async () => {
    const [requests, topics] = await Promise.all([
      listRequestsByUser(currentUser),
      listTopics(),
    ]);
    const titles: Record<string, string> = {};
    for (const t of topics) titles[t.id] = t.title;
    return { requests, titles };
  }, [currentUser]);

  async function cancel(req: ParticipationRequest) {
    setBusyId(req.id);
    setError(null);
    try {
      await cancelRequest(req.id, currentUser);
      reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="empty">Lädt…</p>;
  if (loadError || !data) return <div className="notice error">Fehler: {loadError}</div>;

  const { requests, titles } = data;

  return (
    <div>
      <h1>Meine Anfragen</h1>
      <p className="subtitle">Deine Teilnahmen als {displayName(currentUser)}.</p>

      {error && <div className="notice error">Fehler: {error}</div>}
      {requests.length === 0 && (
        <p className="empty">
          Noch keine Anfragen.{" "}
          <button className="link" onClick={() => navigate({ name: "discover" })}>
            Kochabende entdecken →
          </button>
        </p>
      )}

      <div className="grid">
        {requests.map((r) => (
          <div key={r.id} className="card">
            <div className="spread">
              <button
                className="link"
                style={{ fontSize: "1.05rem", fontWeight: 600 }}
                onClick={() => navigate({ name: "topic", topicId: r.topicId })}
              >
                {titles[r.topicId] ?? `Kochabend ${r.topicId}`}
              </button>
              <StatusBadge status={r.status} />
            </div>

            {r.status === "DECLINED" && r.declineReason && (
              <p className="hint">Grund: {r.declineReason}</p>
            )}

            <div className="row" style={{ marginTop: "0.6rem" }}>
              {r.status === "ACCEPTED" && (
                <button
                  className="btn ok small"
                  onClick={() => navigate({ name: "confirmed", topicId: r.topicId })}
                >
                  Adresse ansehen
                </button>
              )}
              {(r.status === "REQUESTED" || r.status === "ACCEPTED") && (
                <button
                  className="btn secondary small"
                  disabled={busyId === r.id}
                  onClick={() => cancel(r)}
                >
                  Zurückziehen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
