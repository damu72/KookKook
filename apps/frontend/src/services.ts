export const SERVICES = {
  topic: "http://localhost:3001",
  participation: "http://localhost:3002",
  capacity: "http://localhost:3003",
  trust: "http://localhost:3004",
} as const;

export type ServiceKey = keyof typeof SERVICES;

export async function getJson<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
