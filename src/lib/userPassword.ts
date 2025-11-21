/**
 * User Password Management
 * Manages user-defined encryption passwords with secure storage practices
 * 
 * Security Notes:
 * - Passwords are NEVER stored directly
 * - Only password hints and metadata are stored in localStorage
 * - Passwords must be provided by users for encryption/decryption operations
 * - Version control ensures compatibility across updates
 */

const PASSWORD_HINT_KEY = "echoma_password_hint";
const PASSWORD_SETUP_KEY = "echoma_password_setup_complete";
const PASSWORD_VERSION_KEY = "echoma_password_version";
const CURRENT_PASSWORD_VERSION = 1;

/**
 * Password configuration interface
 */
export interface PasswordConfig {
  hint?: string;
  setupComplete: boolean;
  version: number;
}

/**
 * Check if user has completed password setup
 */
export function hasPasswordSetup(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const setup = localStorage.getItem(PASSWORD_SETUP_KEY);
    return setup === "true";
  } catch {
    return false;
  }
}

/**
 * Get password configuration
 */
export function getPasswordConfig(): PasswordConfig {
  if (typeof window === "undefined") {
    return {
      setupComplete: false,
      version: CURRENT_PASSWORD_VERSION,
    };
  }
  
  try {
    const setupComplete = localStorage.getItem(PASSWORD_SETUP_KEY) === "true";
    const hint = localStorage.getItem(PASSWORD_HINT_KEY) || undefined;
    const versionStr = localStorage.getItem(PASSWORD_VERSION_KEY);
    const version = versionStr ? parseInt(versionStr, 10) : CURRENT_PASSWORD_VERSION;
    
    return {
      hint,
      setupComplete,
      version,
    };
  } catch (error) {
    console.warn("[userPassword] Failed to read password config:", error);
    return {
      setupComplete: false,
      version: CURRENT_PASSWORD_VERSION,
    };
  }
}

/**
 * Save password configuration
 * Note: This does NOT save the password itself, only metadata
 */
export function savePasswordConfig(hint?: string): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(PASSWORD_SETUP_KEY, "true");
    localStorage.setItem(PASSWORD_VERSION_KEY, String(CURRENT_PASSWORD_VERSION));
    
    if (hint) {
      localStorage.setItem(PASSWORD_HINT_KEY, hint);
    } else {
      localStorage.removeItem(PASSWORD_HINT_KEY);
    }
    
    console.log("[userPassword] Password config saved successfully");
  } catch (error) {
    console.error("[userPassword] Failed to save password config:", error);
    throw new Error("無法保存密碼配置，請檢查瀏覽器儲存空間");
  }
}

/**
 * Clear password configuration
 * Used when user wants to reset their password setup
 */
export function clearPasswordConfig(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(PASSWORD_SETUP_KEY);
    localStorage.removeItem(PASSWORD_HINT_KEY);
    localStorage.removeItem(PASSWORD_VERSION_KEY);
    console.log("[userPassword] Password config cleared");
  } catch (error) {
    console.warn("[userPassword] Failed to clear password config:", error);
  }
}

/**
 * Validate password strength
 * Returns error message if password is weak, undefined if strong enough
 */
export function validatePasswordStrength(password: string): string | undefined {
  if (!password || password.length === 0) {
    return "密碼不能為空";
  }
  
  if (password.length < 8) {
    return "密碼長度至少需要 8 個字符";
  }
  
  if (password.length > 128) {
    return "密碼長度不能超過 128 個字符";
  }
  
  // Check for at least one letter and one number or symbol
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  if (!hasLetter || !hasNumberOrSymbol) {
    return "密碼應包含字母和數字/符號的組合";
  }
  
  return undefined;
}

/**
 * Session password cache (in-memory only, cleared on page refresh)
 * This is used to avoid asking for password multiple times in the same session
 */
class PasswordCache {
  private cache: Map<string, { password: string; timestamp: number }> = new Map();
  private readonly CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  
  /**
   * Cache password for a specific context (wallet address, user ID, or "anonymous")
   */
  set(context: string, password: string): void {
    this.cache.set(context, {
      password,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Get cached password for a specific context
   * Returns undefined if not cached or expired
   */
  get(context: string): string | undefined {
    const cached = this.cache.get(context);
    
    if (!cached) {
      return undefined;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_DURATION_MS) {
      this.cache.delete(context);
      return undefined;
    }
    
    return cached.password;
  }
  
  /**
   * Clear cached password for a specific context
   */
  clear(context: string): void {
    this.cache.delete(context);
  }
  
  /**
   * Clear all cached passwords
   */
  clearAll(): void {
    this.cache.clear();
  }
}

export const passwordCache = new PasswordCache();

/**
 * Get context key for password cache
 * This identifies which password to use based on current user state
 */
export function getPasswordContext(
  walletAddress?: string | null,
  userId?: string | null
): string {
  if (walletAddress) {
    return `wallet_${walletAddress}`;
  }
  if (userId) {
    return `user_${userId}`;
  }
  return "anonymous";
}

