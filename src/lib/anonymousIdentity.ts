import { generateUserKeyFromId } from "./encryption";

const ANON_USER_ID_STORAGE_KEY = "echoma_anon_user_id_v1";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredId(): string | null {
  if (!isBrowser()) {
    return null;
  }
  const value = window.localStorage.getItem(ANON_USER_ID_STORAGE_KEY);
  if (!value || !UUID_REGEX.test(value)) {
    return null;
  }
  return value;
}

export function getOrCreateAnonymousUserId(): string {
  if (!isBrowser()) {
    throw new Error("Anonymous identity is only available in browser environments");
  }

  const existing = readStoredId();
  if (existing) {
    return existing;
  }

  const newId = crypto.randomUUID();
  window.localStorage.setItem(ANON_USER_ID_STORAGE_KEY, newId);
  return newId;
}

export function getAnonymousUserId(): string | null {
  return readStoredId();
}

export async function getAnonymousUserKey(): Promise<string | null> {
  const anonId = getAnonymousUserId();
  if (!anonId) {
    return null;
  }
  return generateUserKeyFromId(anonId);
}

export async function getOrCreateAnonymousUserKey(): Promise<string> {
  const anonId = getOrCreateAnonymousUserId();
  return generateUserKeyFromId(anonId);
}

export function clearAnonymousIdentity(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(ANON_USER_ID_STORAGE_KEY);
}
