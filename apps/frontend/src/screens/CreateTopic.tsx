import { FormEvent, useState } from "react";
import { Navigate } from "../App.js";
import { ApiError, createTopicWithCapacity } from "../api.js";
import { displayName } from "../users.js";

export function CreateTopic({
  navigate,
  currentUser,
}: {
  navigate: Navigate;
  currentUser: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    cuisine: "",
    startsAt: "",
    maxGuests: 4,
    publicLocationLabel: "",
    privateAddress: "",
    hostArrivalNote: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const topic = await createTopicWithCapacity({
        hostUserId: currentUser,
        title: form.title,
        description: form.description,
        cuisine: form.cuisine,
        // datetime-local liefert "YYYY-MM-DDTHH:mm" -> in ISO wandeln
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : new Date().toISOString(),
        maxGuests: Number(form.maxGuests),
        publicLocationLabel: form.publicLocationLabel,
        privateAddress: form.privateAddress,
        hostArrivalNote: form.hostArrivalNote,
      });
      navigate({ name: "topic", topicId: topic.id });
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Kochabend anlegen</h1>
      <p className="subtitle">Als {displayName(currentUser)} • du bist der Gastgeber.</p>

      <form onSubmit={submit} className="card">
        <label>Titel</label>
        <input
          required
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="z.B. Pasta-Abend"
        />

        <label>Beschreibung</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Was kocht ihr, was erwartet die Gäste?"
        />

        <div className="grid cols-2">
          <div>
            <label>Küche</label>
            <input
              value={form.cuisine}
              onChange={(e) => set("cuisine", e.target.value)}
              placeholder="Italienisch"
            />
          </div>
          <div>
            <label>Beginn</label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </div>
        </div>

        <div className="grid cols-2">
          <div>
            <label>Max. Gäste</label>
            <input
              type="number"
              min={1}
              value={form.maxGuests}
              onChange={(e) => set("maxGuests", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Öffentlicher Ort <span className="hint">(z.B. Stadtteil)</span></label>
            <input
              value={form.publicLocationLabel}
              onChange={(e) => set("publicLocationLabel", e.target.value)}
              placeholder="Prenzlauer Berg, Berlin"
            />
          </div>
        </div>

        <label>
          Private Adresse <span className="hint">(nur für bestätigte Gäste sichtbar)</span>
        </label>
        <input
          value={form.privateAddress}
          onChange={(e) => set("privateAddress", e.target.value)}
          placeholder="Kastanienallee 12, 3. OG"
        />

        <label>
          Ankunfts-Hinweis <span className="hint">(nur für bestätigte Gäste)</span>
        </label>
        <input
          value={form.hostArrivalNote}
          onChange={(e) => set("hostArrivalNote", e.target.value)}
          placeholder="Klingel 'Schmidt', bitte pünktlich."
        />

        {error && <div className="notice error">Fehler: {error}</div>}

        <div className="row" style={{ marginTop: "1rem" }}>
          <button className="btn" type="submit" disabled={busy || !form.title}>
            {busy ? "Erstelle…" : "Kochabend erstellen"}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => navigate({ name: "discover" })}
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
