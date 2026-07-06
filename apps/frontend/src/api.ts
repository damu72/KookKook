// Zentrale Basis-URLs der Services. 127.0.0.1 statt localhost, um IPv6-Auflösung
// (::1) zu vermeiden – die Services lauschen auf IPv4.
export const API = {
  topic: "http://127.0.0.1:3001",
  participation: "http://127.0.0.1:3002",
  capacity: "http://127.0.0.1:3003",
};

// --- Typen (Spiegel der Service-Antworten) ---------------------------------
export type TopicStatus = "draft" | "published" | "full" | "cancelled";

export interface Topic {
  id: string;
  hostUserId: string;
  title: string;
  description: string;
  cuisine: string;
  startsAt: string;
  maxGuests: number;
  publicLocationLabel: string;
  status: TopicStatus;
}

export interface PrivateTopicView extends Topic {
  privateAddress: string | null;
  hostArrivalNote: string | null;
  viewer: {
    userId: string;
    isHost: boolean;
    isAcceptedParticipant: boolean;
    canSeePrivateDetails: boolean;
  };
}

export type ParticipationStatus = "REQUESTED" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export interface ParticipationRequest {
  id: string;
  topicId: string;
  guestUserId: string;
  hostUserId: string;
  status: ParticipationStatus;
  declineReason: string | null;
  reservationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Capacity {
  topicId: string;
  maxGuests: number;
  reservedSeats: number;
  availableSeats: number;
}

// --- Fetch-Helfer ----------------------------------------------------------
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public reason?: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    throw new ApiError(0, "Service nicht erreichbar. Läuft der Backend-Service?");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? res.statusText, data?.reason);
  }
  return data as T;
}

// --- Topic Service ---------------------------------------------------------
export const listTopics = () => request<Topic[]>(`${API.topic}/topics`);
export const getTopic = (id: string) => request<Topic>(`${API.topic}/topics/${id}`);
export const getPrivateView = (id: string, viewerUserId: string) =>
  request<PrivateTopicView>(
    `${API.topic}/topics/${id}/private-view?viewerUserId=${encodeURIComponent(viewerUserId)}`,
  );

export interface CreateTopicInput {
  hostUserId: string;
  title: string;
  description: string;
  cuisine: string;
  startsAt: string;
  maxGuests: number;
  publicLocationLabel: string;
  privateAddress: string;
  hostArrivalNote: string;
}

/**
 * Legt ein Topic an UND direkt die passende Kapazität, damit der komplette
 * Flow (anfragen → akzeptieren → Platz reservieren) für neue Kochabende
 * funktioniert.
 */
export async function createTopicWithCapacity(input: CreateTopicInput): Promise<Topic> {
  const topic = await request<Topic>(`${API.topic}/topics`, {
    method: "POST",
    body: JSON.stringify({ ...input, status: "published" }),
  });
  await request<Capacity>(`${API.capacity}/capacities`, {
    method: "POST",
    body: JSON.stringify({ topicId: topic.id, maxGuests: input.maxGuests }),
  });
  return topic;
}

// --- Participation Service -------------------------------------------------
export const createRequest = (topicId: string, guestUserId: string) =>
  request<ParticipationRequest>(`${API.participation}/participation-requests`, {
    method: "POST",
    body: JSON.stringify({ topicId, guestUserId }),
  });

export const listRequestsByTopic = (topicId: string) =>
  request<ParticipationRequest[]>(`${API.participation}/topics/${topicId}/participation-requests`);

export const listRequestsByUser = (userId: string) =>
  request<ParticipationRequest[]>(`${API.participation}/users/${userId}/participation-requests`);

export const acceptRequest = (id: string, actingUserId: string) =>
  request<ParticipationRequest>(`${API.participation}/participation-requests/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({ actingUserId }),
  });

export const declineRequest = (id: string, actingUserId: string, reason?: string) =>
  request<ParticipationRequest>(`${API.participation}/participation-requests/${id}/decline`, {
    method: "POST",
    body: JSON.stringify({ actingUserId, reason }),
  });

export const cancelRequest = (id: string, actingUserId: string) =>
  request<ParticipationRequest>(`${API.participation}/participation-requests/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ actingUserId }),
  });

// --- Capacity Service ------------------------------------------------------
export const getCapacity = (topicId: string) =>
  request<Capacity>(`${API.capacity}/capacities/${topicId}`);
