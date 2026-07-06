import Fastify from "fastify";
import cors from "@fastify/cors";
import { isKnownUser, makeHealth } from "@kookkook/shared";

const SERVICE_NAME = "participation-service";
const PORT = Number(process.env.PORT ?? 3002);

type ParticipationStatus = "joined" | "waitlist" | "cancelled";

interface Participation {
  id: string;
  topicId: string;
  userId: string;
  status: ParticipationStatus;
  joinedAt: string;
}

// --- In-memory store -------------------------------------------------------
const participations = new Map<string, Participation>();
let nextId = 1;

function seed() {
  const now = new Date().toISOString();
  const seeds: Array<Omit<Participation, "id" | "joinedAt">> = [
    { topicId: "1", userId: "anna", status: "joined" },
    { topicId: "1", userId: "ben", status: "joined" },
    { topicId: "2", userId: "clara", status: "joined" },
    { topicId: "2", userId: "david", status: "waitlist" },
  ];
  for (const s of seeds) {
    const id = String(nextId++);
    participations.set(id, { id, joinedAt: now, ...s });
  }
}
seed();

// --- Server ----------------------------------------------------------------
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => makeHealth(SERVICE_NAME));

app.get<{ Querystring: { topicId?: string; userId?: string } }>(
  "/participations",
  async (req) => {
    const { topicId, userId } = req.query;
    return Array.from(participations.values()).filter(
      (p) => (!topicId || p.topicId === topicId) && (!userId || p.userId === userId),
    );
  },
);

app.post<{ Body: { topicId?: string; userId?: string; status?: ParticipationStatus } }>(
  "/participations",
  async (req, reply) => {
    const { topicId, userId, status } = req.body ?? {};
    if (!topicId || !userId) {
      return reply.code(400).send({ error: "topicId and userId are required" });
    }
    if (!isKnownUser(userId)) {
      return reply.code(400).send({ error: `unknown user: ${userId}` });
    }
    const id = String(nextId++);
    const participation: Participation = {
      id,
      topicId,
      userId,
      status: status ?? "joined",
      joinedAt: new Date().toISOString(),
    };
    participations.set(id, participation);
    return reply.code(201).send(participation);
  },
);

app.delete<{ Params: { id: string } }>("/participations/:id", async (req, reply) => {
  if (!participations.delete(req.params.id)) {
    return reply.code(404).send({ error: "participation not found" });
  }
  return reply.code(204).send();
});

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
