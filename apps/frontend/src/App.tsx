import { useEffect, useState } from "react";
import { SERVICES, ServiceKey, getJson } from "./services.js";

interface Health {
  status: string;
  service: string;
  uptime: number;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  createdBy: string;
}

interface User {
  id: string;
  displayName: string;
}

function useHealth() {
  const [health, setHealth] = useState<Record<string, string>>({});
  useEffect(() => {
    (Object.entries(SERVICES) as [ServiceKey, string][]).forEach(([key, base]) => {
      getJson<Health>(base, "/health")
        .then((h) => setHealth((prev) => ({ ...prev, [key]: h.status })))
        .catch(() => setHealth((prev) => ({ ...prev, [key]: "down" })));
    });
  }, []);
  return health;
}

export function App() {
  const health = useHealth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    getJson<Topic[]>(SERVICES.topic, "/topics").then(setTopics).catch(() => {});
    getJson<User[]>(SERVICES.topic, "/users").then(setUsers).catch(() => {});
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>🍳 KookKook</h1>

      <section>
        <h2>Services</h2>
        <ul>
          {Object.keys(SERVICES).map((key) => (
            <li key={key}>
              <strong>{key}</strong>: {health[key] ?? "…"}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Demo-User</h2>
        <ul>
          {users.map((u) => (
            <li key={u.id}>{u.displayName}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Topics</h2>
        <ul>
          {topics.map((t) => (
            <li key={t.id}>
              <strong>{t.title}</strong> — {t.description} <em>(von {t.createdBy})</em>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
