import { useEffect, useState } from "react";

export interface DemoUser {
  id: string;
  displayName: string;
}

export const DEMO_USERS: DemoUser[] = [
  { id: "anna", displayName: "Anna" },
  { id: "ben", displayName: "Ben" },
  { id: "clara", displayName: "Clara" },
  { id: "david", displayName: "David" },
];

const STORAGE_KEY = "kookkook.currentUser";

/** Aktueller Demo-User (kein echtes Auth) – merkt sich die Auswahl. */
export function useCurrentUser(): [string, (id: string) => void] {
  const [userId, setUserId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? DEMO_USERS[0].id,
  );
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userId);
  }, [userId]);
  return [userId, setUserId];
}

export function displayName(id: string): string {
  return DEMO_USERS.find((u) => u.id === id)?.displayName ?? id;
}
