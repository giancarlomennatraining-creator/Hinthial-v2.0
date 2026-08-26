/**
 * PLACEHOLDER Identity layer for FASE 1 (App shell).
 *
 * This is a client-only, unauthenticated "mock session" used solely to let
 * the app shell be navigated end-to-end (registrazione -> login -> logout,
 * protezione delle route) before real authentication exists.
 *
 * It intentionally does NOT:
 * - verify credentials against anything;
 * - store passwords (only email + display name are kept);
 * - provide any security guarantee.
 *
 * It will be fully replaced by Supabase Auth in FASE 2 --- Auth + database.
 * Nothing here should be treated as, or extended into, a real auth system.
 */

export interface MockSession {
  email: string;
  displayName: string;
}

const STORAGE_KEY = "hinthial.mock-session.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseSession(raw: string | null): MockSession | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "email" in parsed &&
      "displayName" in parsed &&
      typeof (parsed as MockSession).email === "string" &&
      typeof (parsed as MockSession).displayName === "string"
    ) {
      return parsed as MockSession;
    }
    return null;
  } catch {
    return null;
  }
}

// Caches the last parsed session keyed by the raw storage string, so
// getMockSession returns a referentially stable value when the underlying
// data hasn't changed. This matters because getMockSession is used as the
// getSnapshot for useSyncExternalStore, which requires a stable reference
// across calls when nothing changed --- otherwise React treats every call
// as "changed" and re-renders in an infinite loop.
let cachedRaw: string | null = null;
let cachedSession: MockSession | null = null;

/** Reads the current mock session, or null if signed out / on the server. */
export function getMockSession(): MockSession | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parseSession(raw);
  }
  return cachedSession;
}

/** Creates (or replaces) the mock session --- stands in for register/login. */
export function createMockSession(input: MockSession): MockSession {
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  }
  return input;
}

/** Clears the mock session --- stands in for logout. */
export function clearMockSession(): void {
  if (isBrowser()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
