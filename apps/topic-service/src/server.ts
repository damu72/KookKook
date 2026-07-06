import Fastify from "fastify";
import cors from "@fastify/cors";
import { DEMO_USERS, isKnownUser, makeHealth } from "@kookkook/shared";
import {
  CreateTopicInput,
  TopicStatus,
  ViewerContext,
  allTopics,
  createTopic,
  getTopic,
  seed,
  toPrivateTopicView,
  toPublicTopic,
} from "./topics.js";
import { isAcceptedParticipant } from "./participation.js";

const SERVICE_NAME = "topic-service";
const PORT = Number(process.env.PORT ?? 3001);

const VALID_STATUS: TopicStatus[] = ["draft", "published", "full", "cancelled"];

seed();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => makeHealth(SERVICE_NAME));

app.get("/users", async () => DEMO_USERS);

// --- POST /topics ----------------------------------------------------------
interface CreateTopicBody {
  hostUserId?: string;
  title?: string;
  description?: string;
  cuisine?: string;
  startsAt?: string;
  maxGuests?: number;
  publicLocationLabel?: string;
  privateAddress?: string;
  hostArrivalNote?: string;
  status?: string;
}

app.post<{ Body: CreateTopicBody }>("/topics", async (req, reply) => {
  const body = req.body ?? {};
  const { hostUserId, title } = body;

  if (!hostUserId || !title) {
    return reply.code(400).send({ error: "hostUserId and title are required" });
  }
  if (!isKnownUser(hostUserId)) {
    return reply.code(400).send({ error: `unknown user: ${hostUserId}` });
  }
  if (body.maxGuests !== undefined && (typeof body.maxGuests !== "number" || body.maxGuests < 0)) {
    return reply.code(400).send({ error: "maxGuests must be a non-negative number" });
  }
  if (body.status !== undefined && !VALID_STATUS.includes(body.status as TopicStatus)) {
    return reply.code(400).send({ error: `invalid status: ${body.status}` });
  }

  const input: CreateTopicInput = {
    hostUserId,
    title,
    description: body.description,
    cuisine: body.cuisine,
    startsAt: body.startsAt,
    maxGuests: body.maxGuests,
    publicLocationLabel: body.publicLocationLabel,
    privateAddress: body.privateAddress,
    hostArrivalNote: body.hostArrivalNote,
    status: body.status as TopicStatus | undefined,
  };

  const topic = createTopic(input);
  // Antwort ist die öffentliche Sicht – der Host bekommt die privaten Details
  // gezielt über /topics/:id/private-view.
  return reply.code(201).send(toPublicTopic(topic));
});

// --- GET /topics -----------------------------------------------------------
// Niemals privateAddress / hostArrivalNote.
app.get("/topics", async () => allTopics().map(toPublicTopic));

// --- GET /topics/:topicId --------------------------------------------------
// Niemals privateAddress / hostArrivalNote.
app.get<{ Params: { topicId: string } }>("/topics/:topicId", async (req, reply) => {
  const topic = getTopic(req.params.topicId);
  if (!topic) return reply.code(404).send({ error: "topic not found" });
  return toPublicTopic(topic);
});

// --- GET /topics/:topicId/private-view?viewerUserId=... ---------------------
// privateAddress/hostArrivalNote nur, wenn der Viewer Host ODER akzeptierter
// Teilnehmer ist. Die Teilnehmer-Prüfung läuft (MVP) per HTTP zum
// Participation Service.
app.get<{ Params: { topicId: string }; Querystring: { viewerUserId?: string } }>(
  "/topics/:topicId/private-view",
  async (req, reply) => {
    const topic = getTopic(req.params.topicId);
    if (!topic) return reply.code(404).send({ error: "topic not found" });

    const viewerUserId = req.query.viewerUserId;
    if (!viewerUserId) {
      return reply.code(400).send({ error: "viewerUserId query parameter is required" });
    }

    const isHost = topic.hostUserId === viewerUserId;

    let isAccepted = false;
    if (!isHost) {
      try {
        isAccepted = await isAcceptedParticipant(topic.id, viewerUserId);
      } catch (err) {
        // Fail closed: kann der Teilnahme-Status nicht bestätigt werden,
        // werden KEINE privaten Details ausgeliefert.
        req.log.warn({ err }, "participation check failed – hiding private details");
        isAccepted = false;
      }
    }

    const viewer: ViewerContext = {
      userId: viewerUserId,
      isHost,
      isAcceptedParticipant: isAccepted,
      canSeePrivateDetails: isHost || isAccepted,
    };

    return toPrivateTopicView(topic, viewer);
  },
);

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
