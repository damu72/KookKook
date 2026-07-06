import { Navigate } from "../App.js";
import { listTopics } from "../api.js";
import { displayName } from "../users.js";
import { formatDateTime, useAsync } from "../ui.js";

export function Discover({ navigate }: { navigate: Navigate }) {
  const { data: topics, error, loading } = useAsync(listTopics, []);

  // Offene Kochabende = veröffentlicht (nicht abgesagt/voll/Entwurf).
  const open = (topics ?? []).filter((t) => t.status === "published");

  return (
    <div>
      <h1>Offene Kochabende</h1>
      <p className="subtitle">Finde einen Abend und frag nach einem Platz am Tisch.</p>

      {loading && <p className="empty">Lädt…</p>}
      {error && <div className="notice error">Fehler: {error}</div>}
      {!loading && !error && open.length === 0 && (
        <p className="empty">Aktuell keine offenen Kochabende.</p>
      )}

      <div className="grid cols-2">
        {open.map((t) => (
          <div
            key={t.id}
            className="card clickable"
            onClick={() => navigate({ name: "topic", topicId: t.id })}
          >
            <h3>{t.title}</h3>
            <div className="meta">
              <span className="pill">{t.cuisine || "Küche"}</span>
              <span>📅 {formatDateTime(t.startsAt)}</span>
            </div>
            <div className="meta" style={{ marginTop: "0.5rem" }}>
              <span>📍 {t.publicLocationLabel || "Ort auf Anfrage"}</span>
              <span>👥 max. {t.maxGuests}</span>
            </div>
            <p style={{ margin: "0.6rem 0 0", color: "var(--muted)" }}>
              Gastgeber: {displayName(t.hostUserId)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
