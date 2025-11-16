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
  try {
    const value = window.localStorage.getItem(ANON_USER_ID_STORAGE_KEY);
    if (!value || !UUID_REGEX.test(value)) {
      return null;
    }
    return value;
  } catch (error) {
    console.warn("[anonymousIdentity] Failed to read anonymous user ID from localStorage:", error);
    return null;
  }
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
  try {
    window.localStorage.setItem(ANON_USER_ID_STORAGE_KEY, newId);
  } catch (error: any) {
    console.warn("[anonymousIdentity] Failed to save anonymous user ID to localStorage:", error);
    // 如果是配额超出错误，尝试清理旧数据后重试
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      try {
        window.localStorage.removeItem(ANON_USER_ID_STORAGE_KEY);
        window.localStorage.setItem(ANON_USER_ID_STORAGE_KEY, newId);
      } catch (retryError) {
        console.error("[anonymousIdentity] Failed to save anonymous user ID after cleanup:", retryError);
        // 即使保存失败，也返回生成的 ID（在内存中使用）
      }
    }
  }
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
  try {
    window.localStorage.removeItem(ANON_USER_ID_STORAGE_KEY);
  } catch (error) {
    console.warn("[anonymousIdentity] Failed to clear anonymous user ID from localStorage:", error);
  }
}
