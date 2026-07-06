import { useCallback, useEffect, useState } from "react";
import { ParticipationStatus } from "./api.js";

/** Kleiner Datenlade-Hook mit loading/error/reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    fn()
      .then((d) => setData(d))
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);
  return { data, error, loading, reload: run };
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<ParticipationStatus, string> = {
  REQUESTED: "Angefragt",
  ACCEPTED: "Bestätigt",
  DECLINED: "Abgelehnt",
  CANCELLED: "Zurückgezogen",
};

export function StatusBadge({ status }: { status: ParticipationStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>
  );
}
