export type TopicStatus = "draft" | "published" | "full" | "cancelled";

export interface Topic {
  id: string;
  hostUserId: string;
  title: string;
  description: string;
  cuisine: string;
  startsAt: string; // ISO 8601
  maxGuests: number;
  publicLocationLabel: string;
  // --- sensible Felder: niemals über öffentliche Endpunkte ausliefern ---
  privateAddress: string;
  hostArrivalNote: string;
  // ----------------------------------------------------------------------
  status: TopicStatus;
}

/** Öffentliche Sicht: garantiert ohne die sensiblen Felder. */
export type PublicTopic = Omit<Topic, "privateAddress" | "hostArrivalNote">;

export interface ViewerContext {
  userId: string;
  isHost: boolean;
  isAcceptedParticipant: boolean;
  canSeePrivateDetails: boolean;
}

/** Private Sicht: sensible Felder nur gefüllt, wenn der Viewer berechtigt ist. */
export interface PrivateTopicView extends PublicTopic {
  privateAddress: string | null;
  hostArrivalNote: string | null;
  viewer: ViewerContext;
}

/**
 * Reduziert ein Topic auf die öffentliche Sicht. Dies ist der EINZIGE Weg,
 * über den GET /topics und GET /topics/:id ein Topic nach außen geben –
 * so können privateAddress und hostArrivalNote strukturell nicht leaken.
 */
export function toPublicTopic(topic: Topic): PublicTopic {
  // Bewusst Feld für Feld, kein Spread von `topic`, damit neue sensible
  // Felder nicht versehentlich mit ausgeliefert werden.
  return {
    id: topic.id,
    hostUserId: topic.hostUserId,
    title: topic.title,
    description: topic.description,
    cuisine: topic.cuisine,
    startsAt: topic.startsAt,
    maxGuests: topic.maxGuests,
    publicLocationLabel: topic.publicLocationLabel,
    status: topic.status,
  };
}

/**
 * Baut die private Sicht. `canSeePrivateDetails` entscheidet, ob die
 * sensiblen Felder gefüllt werden – andernfalls bleiben sie null.
 */
export function toPrivateTopicView(topic: Topic, viewer: ViewerContext): PrivateTopicView {
  return {
    ...toPublicTopic(topic),
    privateAddress: viewer.canSeePrivateDetails ? topic.privateAddress : null,
    hostArrivalNote: viewer.canSeePrivateDetails ? topic.hostArrivalNote : null,
    viewer,
  };
}

// --- In-memory store -------------------------------------------------------
const topics = new Map<string, Topic>();
let nextId = 1;

export function allTopics(): Topic[] {
  return Array.from(topics.values());
}

export function getTopic(id: string): Topic | undefined {
  return topics.get(id);
}

export interface CreateTopicInput {
  hostUserId: string;
  title: string;
  description?: string;
  cuisine?: string;
  startsAt?: string;
  maxGuests?: number;
  publicLocationLabel?: string;
  privateAddress?: string;
  hostArrivalNote?: string;
  status?: TopicStatus;
}

export function createTopic(input: CreateTopicInput): Topic {
  const id = String(nextId++);
  const topic: Topic = {
    id,
    hostUserId: input.hostUserId,
    title: input.title,
    description: input.description ?? "",
    cuisine: input.cuisine ?? "",
    startsAt: input.startsAt ?? new Date().toISOString(),
    maxGuests: input.maxGuests ?? 0,
    publicLocationLabel: input.publicLocationLabel ?? "",
    privateAddress: input.privateAddress ?? "",
    hostArrivalNote: input.hostArrivalNote ?? "",
    status: input.status ?? "published",
  };
  topics.set(id, topic);
  return topic;
}

export function seed(): void {
  createTopic({
    hostUserId: "anna",
    title: "Pasta-Abend",
    description: "Wir machen frische Pasta von Grund auf.",
    cuisine: "Italienisch",
    startsAt: "2026-07-10T18:30:00.000Z",
    maxGuests: 6,
    publicLocationLabel: "Prenzlauer Berg, Berlin",
    privateAddress: "Kastanienallee 12, 3. OG, 10435 Berlin",
    hostArrivalNote: "Klingel 'Schmidt', bitte pünktlich – der Teig wartet nicht.",
    status: "published",
  });
  createTopic({
    hostUserId: "ben",
    title: "Sushi-Workshop",
    description: "Maki und Nigiri selbst rollen.",
    cuisine: "Japanisch",
    startsAt: "2026-07-12T19:00:00.000Z",
    maxGuests: 4,
    publicLocationLabel: "Neukölln, Berlin",
    privateAddress: "Weserstraße 200, Hinterhaus, 12047 Berlin",
    hostArrivalNote: "Code am Tor: 4711. Schuhe bitte ausziehen.",
    status: "published",
  });
  createTopic({
    hostUserId: "clara",
    title: "Veganer Brunch",
    description: "Gemütlicher Brunch, alles pflanzlich.",
    cuisine: "Vegan",
    startsAt: "2026-07-13T11:00:00.000Z",
    maxGuests: 8,
    publicLocationLabel: "Kreuzberg, Berlin",
    privateAddress: "Bergmannstraße 5, 10961 Berlin",
    hostArrivalNote: "2. Stock, Tür mit dem grünen Kranz.",
    status: "published",
  });
}
