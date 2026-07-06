import Fastify, { FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { isKnownUser, makeHealth } from "@kookkook/shared";
import {
  DuplicateActiveRequestError,
  InvalidStateError,
  NoSeatsAvailableError,
  NotGuestError,
  NotHostError,
  RequestNotFoundError,
  TopicNotFoundError,
  TrustDeniedError,
  UpstreamUnavailableError,
} from "./domain.js";
import * as store from "./store.js";
import { checkCanInteract, fetchTopic, releaseReservation, reserveSeat } from "./clients.js";

const SERVICE_NAME = "participation-service";
const PORT = Number(process.env.PORT ?? 3002);

store.seed();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

/**
 * Mappt Domänenfehler auf HTTP-Antworten. Gibt das (bereits gesendete) reply
 * zurück, wenn behandelt – Fastifys Idiom für "übernommen" –, sonst undefined,
 * damit der Aufrufer den Fehler weiterwerfen kann. `reply.send()` liefert das
 * reply-Objekt, das direkt aus dem Handler zurückgegeben werden darf.
 */
function handleError(reply: FastifyReply, err: unknown): FastifyReply | undefined {
  if (err instanceof TopicNotFoundError || err instanceof RequestNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof DuplicateActiveRequestError || err instanceof InvalidStateError) {
    return reply.code(409).send({ error: err.message });
  }
  if (err instanceof NoSeatsAvailableError) {
    return reply.code(409).send({ error: err.message, reason: err.reason });
  }
  if (err instanceof TrustDeniedError) {
    return reply.code(403).send({ error: err.message, reason: err.reason });
  }
  if (err instanceof NotHostError || err instanceof NotGuestError) {
    return reply.code(403).send({ error: err.message });
  }
  if (err instanceof UpstreamUnavailableError) {
    return reply.code(502).send({ error: err.message });
  }
  return undefined;
}

app.get("/health", async () => makeHealth(SERVICE_NAME));

// --- POST /participation-requests ------------------------------------------
// Gast stellt eine Anfrage. Prüft Trust (can-interact) und die "eine aktive
// Anfrage pro Gast & Topic"-Regel.
app.post<{ Body: { topicId?: string; guestUserId?: string } }>(
  "/participation-requests",
  async (req, reply) => {
    const { topicId, guestUserId } = req.body ?? {};
    if (!topicId || !guestUserId) {
      return reply.code(400).send({ error: "topicId and guestUserId are required" });
    }
    if (!isKnownUser(guestUserId)) {
      return reply.code(400).send({ error: `unknown user: ${guestUserId}` });
    }
    try {
      // Host des Topics ermitteln (auch für den Trust-Check nötig).
      const topic = await fetchTopic(topicId);

      if (topic.hostUserId === guestUserId) {
        return reply.code(400).send({ error: "host cannot request participation in own topic" });
      }
      if (store.hasActiveRequest(topicId, guestUserId)) {
        throw new DuplicateActiveRequestError(topicId, guestUserId);
      }

      // Trust-Check ist Pflicht: kann er nicht erfolgen, wird nicht erstellt.
      const trust = await checkCanInteract(guestUserId, topic.hostUserId);
      if (!trust.canInteract) {
        throw new TrustDeniedError(trust.reason ?? "NOT_ALLOWED");
      }

      const created = store.createRequest(topicId, guestUserId, topic.hostUserId);
      return reply.code(201).send(created);
    } catch (err) {
      if (handleError(reply, err)) return;
      throw err;
    }
  },
);

// --- GET /topics/:topicId/participation-requests ---------------------------
app.get<{ Params: { topicId: string } }>(
  "/topics/:topicId/participation-requests",
  async (req) => store.listByTopic(req.params.topicId),
);

// --- GET /users/:userId/participation-requests -----------------------------
app.get<{ Params: { userId: string } }>(
  "/users/:userId/participation-requests",
  async (req) => store.listByUser(req.params.userId),
);

// --- POST /participation-requests/:id/accept -------------------------------
// Nur der Host. Reserviert einen Platz im Capacity Service; bei "voll" bleibt
// die Anfrage REQUESTED (Antwort 409 NO_SEATS_AVAILABLE).
app.post<{ Params: { id: string }; Body: { actingUserId?: string } }>(
  "/participation-requests/:id/accept",
  async (req, reply) => {
    const actingUserId = req.body?.actingUserId;
    if (!actingUserId) return reply.code(400).send({ error: "actingUserId is required" });

    const request = store.getRequest(req.params.id);
    if (!request) return reply.code(404).send({ error: `request ${req.params.id} not found` });
    if (request.hostUserId !== actingUserId) {
      return handleError(reply, new NotHostError());
    }
    if (request.status !== "REQUESTED") {
      return handleError(reply, new InvalidStateError(request.status, "accept"));
    }

    try {
      // Platz reservieren; wirft NoSeatsAvailableError, wenn voll.
      // Die Request-ID dient als Idempotenz-Schlüssel (sichere Retries).
      const reservation = await reserveSeat(request.topicId, request.guestUserId, request.id);
      const updated = store.updateRequest(request, {
        status: "ACCEPTED",
        reservationId: reservation.id,
      });
      return reply.send(updated);
    } catch (err) {
      // Regel: bei fehlendem Platz bleibt die Anfrage REQUESTED (kein Wechsel).
      if (handleError(reply, err)) return;
      throw err;
    }
  },
);

// --- POST /participation-requests/:id/decline ------------------------------
// Nur der Host. Optionaler Grund.
app.post<{ Params: { id: string }; Body: { actingUserId?: string; reason?: string } }>(
  "/participation-requests/:id/decline",
  async (req, reply) => {
    const actingUserId = req.body?.actingUserId;
    if (!actingUserId) return reply.code(400).send({ error: "actingUserId is required" });

    const request = store.getRequest(req.params.id);
    if (!request) return reply.code(404).send({ error: `request ${req.params.id} not found` });
    if (request.hostUserId !== actingUserId) {
      return handleError(reply, new NotHostError());
    }
    if (request.status !== "REQUESTED") {
      return handleError(reply, new InvalidStateError(request.status, "decline"));
    }

    const updated = store.updateRequest(request, {
      status: "DECLINED",
      declineReason: req.body?.reason ?? "DECLINED_BY_HOST",
    });
    return reply.send(updated);
  },
);

// --- POST /participation-requests/:id/cancel -------------------------------
// Nur der Gast (Ersteller). Gibt bei ACCEPTED die Reservierung frei.
app.post<{ Params: { id: string }; Body: { actingUserId?: string } }>(
  "/participation-requests/:id/cancel",
  async (req, reply) => {
    const actingUserId = req.body?.actingUserId;
    if (!actingUserId) return reply.code(400).send({ error: "actingUserId is required" });

    const request = store.getRequest(req.params.id);
    if (!request) return reply.code(404).send({ error: `request ${req.params.id} not found` });
    if (request.guestUserId !== actingUserId) {
      return handleError(reply, new NotGuestError());
    }
    if (request.status !== "REQUESTED" && request.status !== "ACCEPTED") {
      return handleError(reply, new InvalidStateError(request.status, "cancel"));
    }

    // War die Anfrage akzeptiert, den Platz wieder freigeben (best effort).
    if (request.status === "ACCEPTED" && request.reservationId) {
      try {
        await releaseReservation(request.reservationId);
      } catch (err) {
        req.log.warn({ err }, "failed to release reservation on cancel – cancelling anyway");
      }
    }

    const updated = store.updateRequest(request, { status: "CANCELLED" });
    return reply.send(updated);
  },
);

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
