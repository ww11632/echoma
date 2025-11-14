import type { EmotionRecord } from "./dataSchema";
import { encryptData, decryptDataWithMigration, type EncryptedData } from "./encryption";

export interface StorageAdapter {
  save(record: EmotionRecord): Promise<void>;
  list(): Promise<EmotionRecord[]>;
  get(id: string): Promise<EmotionRecord | null>;
  clear?(): Promise<void>;
}

const LOCAL_KEY = "echoma_mvp_records";
const ENCRYPTED_LOCAL_KEY = "echoma_encrypted_mvp_records";

export class LocalJsonAdapter implements StorageAdapter {
  async save(record: EmotionRecord): Promise<void> {
      // Validate record before saving
      if (!record.id || !record.timestamp || !record.emotion) {
        const error = new Error("INVALID_RECORD_DATA");
        (error as any).errorCode = "INVALID_RECORD_DATA";
        throw error;
      }
      // Check note is not empty (after trimming whitespace)
      if (!record.note || typeof record.note !== "string" || record.note.trim().length === 0) {
        const error = new Error("EMPTY_RECORD_NOTE");
        (error as any).errorCode = "EMPTY_RECORD_NOTE";
        throw error;
      }
    
    const list = await this.list();
    
    // Check for duplicate ID (prevent accidental duplicates)
    const existingIndex = list.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      console.warn(`[LocalJsonAdapter] Record with ID ${record.id} already exists, updating instead of creating duplicate`);
      // Update existing record instead of creating duplicate
      list[existingIndex] = record;
    } else {
      list.push(record);
    }
    
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  }

  async list(): Promise<EmotionRecord[]> {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as EmotionRecord[];
      if (!Array.isArray(parsed)) {
        console.error("[LocalJsonAdapter] Stored data is not an array, resetting");
        // Clear corrupted data
        localStorage.removeItem(LOCAL_KEY);
        return [];
      }
      // Filter out invalid records
      return parsed.filter((r) => 
        r && 
        typeof r === "object" && 
        r.id && 
        r.timestamp && 
        r.emotion && 
        r.note
      );
    } catch (error) {
      console.error("[LocalJsonAdapter] Failed to parse stored data:", error);
      // Clear corrupted data to prevent future errors
      try {
        localStorage.removeItem(LOCAL_KEY);
      } catch {
        // Ignore cleanup errors
      }
      return [];
    }
  }

  async get(id: string): Promise<EmotionRecord | null> {
    const list = await this.list();
    return list.find((r) => r.id === id) ?? null;
  }

  async clear(): Promise<void> {
    localStorage.removeItem(LOCAL_KEY);
  }
}

/**
 * Encrypted storage adapter for anonymous users
 * Encrypts data before storing in localStorage
 */
export class EncryptedLocalAdapter implements StorageAdapter {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  async save(record: EmotionRecord): Promise<void> {
    try {
      // Validate record before saving
      if (!record.id || !record.timestamp || !record.emotion) {
        const error = new Error("INVALID_RECORD_DATA");
        (error as any).errorCode = "INVALID_RECORD_DATA";
        throw error;
      }
      // Check note is not empty (after trimming whitespace)
      if (!record.note || typeof record.note !== "string" || record.note.trim().length === 0) {
        const error = new Error("EMPTY_RECORD_NOTE");
        (error as any).errorCode = "EMPTY_RECORD_NOTE";
        throw error;
      }
      
      const list = await this.list();
      
      // Check for duplicate ID (prevent accidental duplicates)
      const existingIndex = list.findIndex(r => r.id === record.id);
      if (existingIndex >= 0) {
        console.warn(`[EncryptedLocalAdapter] Record with ID ${record.id} already exists, updating instead of creating duplicate`);
        // Update existing record instead of creating duplicate
        list[existingIndex] = record;
      } else {
        list.push(record);
      }
      
      // Encrypt the entire list before storing
      const listJson = JSON.stringify(list);
      const encrypted = await encryptData(listJson, this.encryptionKey);
      
      // Try to save to localStorage
      try {
        localStorage.setItem(ENCRYPTED_LOCAL_KEY, JSON.stringify(encrypted));
      } catch (storageError: any) {
        // Handle localStorage quota exceeded
        if (storageError.name === 'QuotaExceededError' || storageError.code === 22) {
          const error = new Error("STORAGE_QUOTA_EXCEEDED");
          (error as any).errorCode = "STORAGE_QUOTA_EXCEEDED";
          throw error;
        }
        throw storageError;
      }
    } catch (error) {
      console.error("[EncryptedLocalAdapter] Failed to save record:", error);
      // Re-throw with more context
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("保存記錄失敗：" + (error as any)?.message || "未知錯誤");
    }
  }

  async list(): Promise<EmotionRecord[]> {
    const encryptedStr = localStorage.getItem(ENCRYPTED_LOCAL_KEY);
    if (!encryptedStr) return [];
    
    try {
      // Try to decrypt
      let encryptedData: EncryptedData;
      try {
        encryptedData = JSON.parse(encryptedStr);
      } catch (parseError) {
        console.error("[EncryptedLocalAdapter] Failed to parse encrypted data JSON:", parseError);
        // Clear corrupted encrypted data
        try {
          localStorage.removeItem(ENCRYPTED_LOCAL_KEY);
        } catch {
          // Ignore cleanup errors
        }
        return [];
      }
      
      const decryptedJson = await decryptDataWithMigration(encryptedData, this.encryptionKey);
      
      let parsed: EmotionRecord[];
      try {
        parsed = JSON.parse(decryptedJson) as EmotionRecord[];
      } catch (parseError) {
        console.error("[EncryptedLocalAdapter] Failed to parse decrypted data JSON:", parseError);
        // Decrypted data is corrupted, clear it
        try {
          localStorage.removeItem(ENCRYPTED_LOCAL_KEY);
        } catch {
          // Ignore cleanup errors
        }
        return [];
      }
      
      if (!Array.isArray(parsed)) {
        console.error("[EncryptedLocalAdapter] Decrypted data is not an array, resetting");
        try {
          localStorage.removeItem(ENCRYPTED_LOCAL_KEY);
        } catch {
          // Ignore cleanup errors
        }
        return [];
      }
      
      // Filter out invalid records
      return parsed.filter((r) => 
        r && 
        typeof r === "object" && 
        r.id && 
        r.timestamp && 
        r.emotion && 
        r.note
      );
    } catch (error) {
      console.error("[EncryptedLocalAdapter] Failed to decrypt records:", error);
      
      // Check if this is a key mismatch error (most common case)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isKeyError = errorMessage.includes("Invalid key") || 
                        errorMessage.includes("bad") || 
                        errorMessage.includes("decrypt");
      
      if (isKeyError) {
        console.warn("[EncryptedLocalAdapter] Decryption failed - possible key mismatch. Data may be encrypted with a different key.");
        // Don't try to migrate if it's a key error - the data is encrypted with a different key
        // Return empty array to avoid showing corrupted data
        return [];
      }
      
      // If decryption fails for other reasons, try to read legacy unencrypted data for migration
      const legacyRaw = localStorage.getItem(LOCAL_KEY);
      if (legacyRaw) {
        try {
          const legacyParsed = JSON.parse(legacyRaw) as EmotionRecord[];
          if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
            // Migrate legacy data to encrypted storage
            console.log("[EncryptedLocalAdapter] Migrating legacy unencrypted records to encrypted storage");
            const listJson = JSON.stringify(legacyParsed);
            const encrypted = await encryptData(listJson, this.encryptionKey);
            localStorage.setItem(ENCRYPTED_LOCAL_KEY, JSON.stringify(encrypted));
            // Remove legacy data after successful migration
            localStorage.removeItem(LOCAL_KEY);
            console.log("[EncryptedLocalAdapter] Legacy data migrated and removed");
            return legacyParsed;
          }
        } catch (migrationError) {
          console.error("[EncryptedLocalAdapter] Legacy migration failed:", migrationError);
          // Ignore legacy migration errors, return empty array
        }
      }
      
      // Return empty array if all attempts failed
      return [];
    }
  }

  async get(id: string): Promise<EmotionRecord | null> {
    const list = await this.list();
    return list.find((r) => r.id === id) ?? null;
  }

  async clear(): Promise<void> {
    localStorage.removeItem(ENCRYPTED_LOCAL_KEY);
    // Also clear public records storage
    const ENCRYPTED_PUBLIC_KEY = "echoma_encrypted_public_records";
    localStorage.removeItem(ENCRYPTED_PUBLIC_KEY);
    // Also clear legacy unencrypted data if exists
    localStorage.removeItem(LOCAL_KEY);
  }
}

export class StorageService {
  private adapter: StorageAdapter;
  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }
  save(record: EmotionRecord) {
    return this.adapter.save(record);
  }
  list() {
    return this.adapter.list();
  }
  get(id: string) {
    return this.adapter.get(id);
  }
  clear() {
    return this.adapter.clear?.() ?? Promise.resolve();
  }
}


