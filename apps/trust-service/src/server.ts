import Fastify from "fastify";
import cors from "@fastify/cors";
import { isKnownUser, makeHealth } from "@kookkook/shared";

const SERVICE_NAME = "trust-service";
const PORT = Number(process.env.PORT ?? 3004);

interface TrustEdge {
  fromUserId: string;
  toUserId: string;
  score: number; // 0..100
}

// --- In-memory store -------------------------------------------------------
// key = `${fromUserId}->${toUserId}`
const trust = new Map<string, TrustEdge>();

function key(from: string, to: string) {
  return `${from}->${to}`;
}

function seed() {
  const seeds: TrustEdge[] = [
    { fromUserId: "anna", toUserId: "ben", score: 80 },
    { fromUserId: "anna", toUserId: "clara", score: 60 },
    { fromUserId: "ben", toUserId: "anna", score: 75 },
    { fromUserId: "clara", toUserId: "david", score: 90 },
    { fromUserId: "david", toUserId: "anna", score: 50 },
  ];
  for (const e of seeds) trust.set(key(e.fromUserId, e.toUserId), e);
}
seed();

// --- Server ----------------------------------------------------------------
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => makeHealth(SERVICE_NAME));

app.get("/trust", async () => Array.from(trust.values()));

// Outgoing trust edges for a user plus the average trust others place in them.
app.get<{ Params: { userId: string } }>("/trust/:userId", async (req) => {
  const { userId } = req.params;
  const outgoing = Array.from(trust.values()).filter((e) => e.fromUserId === userId);
  const incoming = Array.from(trust.values()).filter((e) => e.toUserId === userId);
  const averageIncoming =
    incoming.length === 0
      ? null
      : Math.round(incoming.reduce((sum, e) => sum + e.score, 0) / incoming.length);
  return { userId, outgoing, incoming, averageIncoming };
});

app.put<{ Body: { fromUserId?: string; toUserId?: string; score?: number } }>(
  "/trust",
  async (req, reply) => {
    const { fromUserId, toUserId, score } = req.body ?? {};
    if (!fromUserId || !toUserId || typeof score !== "number") {
      return reply.code(400).send({ error: "fromUserId, toUserId and score are required" });
    }
    if (!isKnownUser(fromUserId) || !isKnownUser(toUserId)) {
      return reply.code(400).send({ error: "unknown user" });
    }
    if (score < 0 || score > 100) {
      return reply.code(400).send({ error: "score must be between 0 and 100" });
    }
    const edge: TrustEdge = { fromUserId, toUserId, score };
    trust.set(key(fromUserId, toUserId), edge);
    return edge;
  },
);

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
