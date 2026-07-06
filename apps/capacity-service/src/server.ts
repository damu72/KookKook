import Fastify from "fastify";
import cors from "@fastify/cors";
import { makeHealth } from "@kookkook/shared";

const SERVICE_NAME = "capacity-service";
const PORT = Number(process.env.PORT ?? 3003);

interface Capacity {
  topicId: string;
  maxSeats: number;
  reservedSeats: number;
}

// --- In-memory store -------------------------------------------------------
const capacities = new Map<string, Capacity>();

function seed() {
  const seeds: Capacity[] = [
    { topicId: "1", maxSeats: 6, reservedSeats: 2 },
    { topicId: "2", maxSeats: 4, reservedSeats: 1 },
    { topicId: "3", maxSeats: 8, reservedSeats: 0 },
  ];
  for (const c of seeds) capacities.set(c.topicId, c);
}
seed();

function withAvailable(c: Capacity) {
  return { ...c, availableSeats: Math.max(0, c.maxSeats - c.reservedSeats) };
}

// --- Server ----------------------------------------------------------------
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => makeHealth(SERVICE_NAME));

app.get("/capacities", async () => Array.from(capacities.values()).map(withAvailable));

app.get<{ Params: { topicId: string } }>("/capacities/:topicId", async (req, reply) => {
  const c = capacities.get(req.params.topicId);
  if (!c) return reply.code(404).send({ error: "capacity not found" });
  return withAvailable(c);
});

app.put<{ Params: { topicId: string }; Body: { maxSeats?: number } }>(
  "/capacities/:topicId",
  async (req, reply) => {
    const { maxSeats } = req.body ?? {};
    if (typeof maxSeats !== "number" || maxSeats < 0) {
      return reply.code(400).send({ error: "maxSeats must be a non-negative number" });
    }
    const existing = capacities.get(req.params.topicId);
    const updated: Capacity = {
      topicId: req.params.topicId,
      maxSeats,
      reservedSeats: existing?.reservedSeats ?? 0,
    };
    capacities.set(req.params.topicId, updated);
    return withAvailable(updated);
  },
);

// Reserve or release seats: delta may be positive (reserve) or negative (release).
app.post<{ Params: { topicId: string }; Body: { delta?: number } }>(
  "/capacities/:topicId/reserve",
  async (req, reply) => {
    const delta = req.body?.delta ?? 1;
    const c = capacities.get(req.params.topicId);
    if (!c) return reply.code(404).send({ error: "capacity not found" });
    const reserved = c.reservedSeats + delta;
    if (reserved < 0) {
      return reply.code(400).send({ error: "cannot release more than reserved" });
    }
    if (reserved > c.maxSeats) {
      return reply.code(409).send({ error: "not enough capacity" });
    }
    c.reservedSeats = reserved;
    return withAvailable(c);
  },
);

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
