import Fastify from "fastify";
import cors from "@fastify/cors";
import { isKnownUser, makeHealth } from "@kookkook/shared";
import {
  CapacityExistsError,
  CapacityFullError,
  CapacityNotFoundError,
  CapacityRepository,
  ReservationNotFoundError,
} from "./domain.js";
import { InMemoryCapacityRepository } from "./in-memory-repository.js";

const SERVICE_NAME = "capacity-service";
const PORT = Number(process.env.PORT ?? 3003);

// Austauschbar: hier später z.B. ein PostgresCapacityRepository einsetzen.
const repo: CapacityRepository = new InMemoryCapacityRepository();

// Demo-Kapazitäten passend zu den Topic-Service-Seeds (1,2,3).
await (repo as InMemoryCapacityRepository).seed([
  { topicId: "1", maxGuests: 6 },
  { topicId: "2", maxGuests: 4 },
  { topicId: "3", maxGuests: 8 },
]);

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => makeHealth(SERVICE_NAME));

// --- POST /capacities ------------------------------------------------------
app.post<{ Body: { topicId?: string; maxGuests?: number } }>(
  "/capacities",
  async (req, reply) => {
    const { topicId, maxGuests } = req.body ?? {};
    if (!topicId) return reply.code(400).send({ error: "topicId is required" });
    if (typeof maxGuests !== "number" || !Number.isInteger(maxGuests) || maxGuests < 0) {
      return reply.code(400).send({ error: "maxGuests must be a non-negative integer" });
    }
    try {
      const view = await repo.createCapacity(topicId, maxGuests);
      return reply.code(201).send(view);
    } catch (err) {
      if (err instanceof CapacityExistsError) {
        return reply.code(409).send({ error: err.message });
      }
      throw err;
    }
  },
);

// --- GET /capacities/:topicId ---------------------------------------------
app.get<{ Params: { topicId: string } }>("/capacities/:topicId", async (req, reply) => {
  try {
    return await repo.getCapacity(req.params.topicId);
  } catch (err) {
    if (err instanceof CapacityNotFoundError) {
      return reply.code(404).send({ error: err.message });
    }
    throw err;
  }
});

// --- POST /seat-reservations ----------------------------------------------
app.post<{ Body: { topicId?: string; userId?: string; idempotencyKey?: string } }>(
  "/seat-reservations",
  async (req, reply) => {
    const { topicId, userId, idempotencyKey } = req.body ?? {};
    if (!topicId || !userId) {
      return reply.code(400).send({ error: "topicId and userId are required" });
    }
    if (!isKnownUser(userId)) {
      return reply.code(400).send({ error: `unknown user: ${userId}` });
    }
    try {
      const reservation = await repo.reserveSeat(topicId, userId, idempotencyKey);
      return reply.code(201).send(reservation);
    } catch (err) {
      if (err instanceof CapacityNotFoundError) {
        return reply.code(404).send({ error: err.message });
      }
      if (err instanceof CapacityFullError) {
        return reply.code(409).send({ error: err.message });
      }
      throw err;
    }
  },
);

// --- POST /seat-reservations/:reservationId/release ------------------------
app.post<{ Params: { reservationId: string } }>(
  "/seat-reservations/:reservationId/release",
  async (req, reply) => {
    try {
      return await repo.releaseReservation(req.params.reservationId);
    } catch (err) {
      if (err instanceof ReservationNotFoundError) {
        return reply.code(404).send({ error: err.message });
      }
      throw err;
    }
  },
);

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
