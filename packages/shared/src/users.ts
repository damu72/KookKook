export interface User {
  id: string;
  name: string;
  displayName: string;
}

/**
 * Demo users shared across all services. In-memory only, no auth yet.
 */
export const DEMO_USERS: User[] = [
  { id: "anna", name: "anna", displayName: "Anna" },
  { id: "ben", name: "ben", displayName: "Ben" },
  { id: "clara", name: "clara", displayName: "Clara" },
  { id: "david", name: "david", displayName: "David" },
];

export const DEMO_USER_IDS = DEMO_USERS.map((u) => u.id);

export function isKnownUser(id: string): boolean {
  return DEMO_USER_IDS.includes(id);
}
