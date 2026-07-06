import { Navigate } from "../App.js";
import { getPrivateView } from "../api.js";
import { displayName } from "../users.js";
import { formatDateTime, useAsync } from "../ui.js";

export function ConfirmedView({
  topicId,
  navigate,
  currentUser,
}: {
  topicId: string;
  navigate: Navigate;
  currentUser: string;
}) {
  const { data, error, loading } = useAsync(
    () => getPrivateView(topicId, currentUser),
    [topicId, currentUser],
  );

  if (loading) return <p className="empty">Lädt…</p>;
  if (error || !data) return <div className="notice error">Fehler: {error}</div>;

  const canSee = data.viewer.canSeePrivateDetails;

  return (
    <div>
      <button className="link back" onClick={() => navigate({ name: "mine" })}>
        ← Zurück
      </button>
      <h1>{data.title}</h1>
      <div className="meta">
        <span className="pill">{data.cuisine || "Küche"}</span>
        <span>📅 {formatDateTime(data.startsAt)}</span>
        <span>📍 {data.publicLocationLabel}</span>
      </div>
      <p className="subtitle" style={{ marginTop: "0.75rem" }}>
        Gastgeber: {displayName(data.hostUserId)}
      </p>

      {canSee ? (
        <div className="private-box">
          <div className="label">Adresse</div>
          <p className="value">{data.privateAddress || "—"}</p>
          <div className="label">Ankunfts-Hinweis</div>
          <p className="value" style={{ marginBottom: 0 }}>
            {data.hostArrivalNote || "—"}
          </p>
        </div>
      ) : (
        <div className="notice info">
          Die private Adresse ist nur für bestätigte Gäste sichtbar. Dein Status reicht dafür
          (noch) nicht.
        </div>
      )}
    </div>
  );
}
