/**
 * Key Versioning System
 * Ensures encryption key compatibility across updates and provides migration paths
 * 
 * Version History:
 * - v1: Initial version (wallet address / user ID only)
 * - v2: Enhanced version (wallet address / user ID + user password)
 */

const KEY_VERSION_KEY = "echoma_key_version";
const KEY_PARAMS_KEY = "echoma_key_params";
const CURRENT_KEY_VERSION = 2;

export interface KeyParams {
  version: number;
  hasUserPassword: boolean;
  createdAt: number;
  lastUsedAt: number;
  context: string; // "wallet", "user", or "anonymous"
}

/**
 * Get current key version from storage
 */
export function getKeyVersion(): number {
  if (typeof window === "undefined") return CURRENT_KEY_VERSION;
  
  try {
    const stored = localStorage.getItem(KEY_VERSION_KEY);
    return stored ? parseInt(stored, 10) : CURRENT_KEY_VERSION;
  } catch {
    return CURRENT_KEY_VERSION;
  }
}

/**
 * Set key version in storage
 */
export function setKeyVersion(version: number): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(KEY_VERSION_KEY, String(version));
  } catch (error) {
    console.warn("[keyVersioning] Failed to set key version:", error);
  }
}

/**
 * Get key parameters for a specific context
 */
export function getKeyParams(context: string): KeyParams | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = localStorage.getItem(`${KEY_PARAMS_KEY}_${context}`);
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch (error) {
    console.warn("[keyVersioning] Failed to get key params:", error);
    return null;
  }
}

/**
 * Save key parameters for a specific context
 */
export function saveKeyParams(context: string, params: Partial<KeyParams>): void {
  if (typeof window === "undefined") return;
  
  try {
    const existing = getKeyParams(context);
    const updated: KeyParams = {
      version: params.version ?? CURRENT_KEY_VERSION,
      hasUserPassword: params.hasUserPassword ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
      lastUsedAt: Date.now(),
      context,
    };
    
    localStorage.setItem(`${KEY_PARAMS_KEY}_${context}`, JSON.stringify(updated));
  } catch (error) {
    console.warn("[keyVersioning] Failed to save key params:", error);
  }
}

/**
 * Check if key needs migration
 * Returns true if the stored key version is older than current version
 */
export function needsKeyMigration(context: string): boolean {
  const params = getKeyParams(context);
  if (!params) return false;
  
  return params.version < CURRENT_KEY_VERSION;
}

/**
 * Clean up old key parameters (older than 90 days)
 */
export function cleanupOldKeyParams(): void {
  if (typeof window === "undefined") return;
  
  try {
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const keys = Object.keys(localStorage);
    
    keys.forEach((key) => {
      if (key.startsWith(KEY_PARAMS_KEY)) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const params: KeyParams = JSON.parse(value);
            if (params.lastUsedAt < ninetyDaysAgo) {
              console.log(`[keyVersioning] Removing old key params: ${key}`);
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          console.warn(`[keyVersioning] Failed to clean up key: ${key}`, error);
        }
      }
    });
  } catch (error) {
    console.warn("[keyVersioning] Failed to cleanup old key params:", error);
  }
}

/**
 * Auto-cleanup: runs on app initialization
 * Removes old key parameters that haven't been used in 90 days
 */
export function initializeKeyVersioning(): void {
  // Set current version if not set
  const currentVersion = getKeyVersion();
  if (currentVersion < CURRENT_KEY_VERSION) {
    console.log(`[keyVersioning] Upgrading key version from ${currentVersion} to ${CURRENT_KEY_VERSION}`);
    setKeyVersion(CURRENT_KEY_VERSION);
  }
  
  // Cleanup old key parameters
  cleanupOldKeyParams();
}

/**
 * Get migration instructions for a specific context
 */
export function getMigrationInstructions(context: string): string | null {
  const params = getKeyParams(context);
  if (!params || !needsKeyMigration(context)) {
    return null;
  }
  
  if (params.version === 1 && CURRENT_KEY_VERSION === 2) {
    return params.hasUserPassword
      ? "您的加密密鑰版本需要更新。請重新輸入您的密碼以遷移數據。"
      : "建議您設置加密密碼以增強數據安全性。舊數據仍可正常訪問。";
  }
  
  return null;
}

