import Fastify from "fastify";
import cors from "@fastify/cors";
import { DEMO_USERS, isKnownUser, makeHealth } from "@kookkook/shared";

const SERVICE_NAME = "topic-service";
const PORT = Number(process.env.PORT ?? 3001);

interface Topic {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

// --- In-memory store -------------------------------------------------------
const topics = new Map<string, Topic>();
let nextId = 1;

function seed() {
  const now = new Date().toISOString();
  const seeds: Array<Omit<Topic, "id" | "createdAt">> = [
    { title: "Pasta-Abend", description: "Wir kochen frische Pasta zusammen.", createdBy: "anna" },
    { title: "Sushi-Workshop", description: "Maki und Nigiri rollen lernen.", createdBy: "ben" },
    { title: "Veganer Brunch", description: "Gemütlicher Brunch, alles pflanzlich.", createdBy: "clara" },
  ];
  for (const s of seeds) {
    const id = String(nextId++);
    topics.set(id, { id, createdAt: now, ...s });
  }
}
seed();

// --- Server ----------------------------------------------------------------
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => makeHealth(SERVICE_NAME));

app.get("/users", async () => DEMO_USERS);

app.get("/topics", async () => Array.from(topics.values()));

app.get<{ Params: { id: string } }>("/topics/:id", async (req, reply) => {
  const topic = topics.get(req.params.id);
  if (!topic) return reply.code(404).send({ error: "topic not found" });
  return topic;
});

app.post<{ Body: { title?: string; description?: string; createdBy?: string } }>(
  "/topics",
  async (req, reply) => {
    const { title, description, createdBy } = req.body ?? {};
    if (!title || !createdBy) {
      return reply.code(400).send({ error: "title and createdBy are required" });
    }
    if (!isKnownUser(createdBy)) {
      return reply.code(400).send({ error: `unknown user: ${createdBy}` });
    }
    const id = String(nextId++);
    const topic: Topic = {
      id,
      title,
      description: description ?? "",
      createdBy,
      createdAt: new Date().toISOString(),
    };
    topics.set(id, topic);
    return reply.code(201).send(topic);
  },
);

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
