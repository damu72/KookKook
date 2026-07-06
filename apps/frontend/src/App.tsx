import { useState } from "react";
import { DEMO_USERS, useCurrentUser } from "./users.js";
import { Discover } from "./screens/Discover.js";
import { TopicDetail } from "./screens/TopicDetail.js";
import { CreateTopic } from "./screens/CreateTopic.js";
import { HostDashboard } from "./screens/HostDashboard.js";
import { MyParticipations } from "./screens/MyParticipations.js";
import { ConfirmedView } from "./screens/ConfirmedView.js";

export type View =
  | { name: "discover" }
  | { name: "topic"; topicId: string }
  | { name: "create" }
  | { name: "host" }
  | { name: "mine" }
  | { name: "confirmed"; topicId: string };

export type Navigate = (view: View) => void;

const NAV_ITEMS: Array<{ label: string; view: View }> = [
  { label: "Entdecken", view: { name: "discover" } },
  { label: "Kochabend anlegen", view: { name: "create" } },
  { label: "Host-Dashboard", view: { name: "host" } },
  { label: "Meine Anfragen", view: { name: "mine" } },
];

export function App() {
  const [view, setView] = useState<View>({ name: "discover" });
  const [currentUser, setCurrentUser] = useCurrentUser();
  const navigate: Navigate = (v) => setView(v);

  return (
    <>
      <header className="topbar">
        <span className="brand" onClick={() => navigate({ name: "discover" })}>
          🍳 KookKook
        </span>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={item.view.name === view.name ? "active" : ""}
              onClick={() => navigate(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="userswitch">
          <label htmlFor="user">Angemeldet als</label>
          <select
            id="user"
            value={currentUser}
            onChange={(e) => setCurrentUser(e.target.value)}
          >
            {DEMO_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="container">
        <Screen view={view} navigate={navigate} currentUser={currentUser} />
      </main>
    </>
  );
}

function Screen({
  view,
  navigate,
  currentUser,
}: {
  view: View;
  navigate: Navigate;
  currentUser: string;
}) {
  switch (view.name) {
    case "discover":
      return <Discover navigate={navigate} />;
    case "topic":
      return <TopicDetail topicId={view.topicId} navigate={navigate} currentUser={currentUser} />;
    case "create":
      return <CreateTopic navigate={navigate} currentUser={currentUser} />;
    case "host":
      return <HostDashboard navigate={navigate} currentUser={currentUser} />;
    case "mine":
      return <MyParticipations navigate={navigate} currentUser={currentUser} />;
    case "confirmed":
      return <ConfirmedView topicId={view.topicId} navigate={navigate} currentUser={currentUser} />;
  }
}
