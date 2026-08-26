"use client";

import { useSyncExternalStore } from "react";
import { getMockSession, type MockSession } from "@/lib/auth/mock-session";

export type MockSessionState =
  | { status: "authenticated"; session: MockSession }
  | { status: "unauthenticated"; session: null };

function subscribe(onStoreChange: () => void): () => void {
  // Fires on changes made from *other* tabs/windows. Same-tab updates are
  // picked up because login/register/logout trigger a navigation, which
  // remounts the reading component and re-evaluates the snapshot.
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getServerSnapshot(): MockSession | null {
  return null;
}

/**
 * Reads the placeholder mock session.
 *
 * Uses useSyncExternalStore (rather than useState + useEffect) so reading
 * localStorage is safe during hydration: the server snapshot is always
 * "no session", and React reconciles it with the real client value without
 * a manual setState-in-effect step.
 */
export function useMockSession(): MockSessionState {
  const session = useSyncExternalStore(
    subscribe,
    getMockSession,
    getServerSnapshot,
  );

  return session
    ? { status: "authenticated", session }
    : { status: "unauthenticated", session: null };
}
