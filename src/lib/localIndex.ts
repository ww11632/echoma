import type { EmotionRecord } from "./dataSchema";
import { StorageService, LocalJsonAdapter, EncryptedLocalAdapter } from "./storageService";
import { generateUserKey, generateUserKeyFromId } from "./encryption";
import { getAnonymousUserKey } from "./anonymousIdentity";
import { supabase } from "@/integrations/supabase/client";

// Simple local index built on top of local storage
// Use plain adapter for backward compatibility
const plainService = new StorageService(new LocalJsonAdapter());

// Encrypted service (will be initialized with encryption key when needed)
let encryptedService: StorageService | null = null;
let currentEncryptionKey: string | null = null;

// Cache for performance optimization
interface CacheEntry {
  records: EmotionRecord[];
  timestamp: number;
  context: string; // Context identifier (wallet address + session state)
}

let recordsCache: CacheEntry | null = null;
const CACHE_TTL = 5000; // 5 seconds cache TTL
const KEY_CACHE = new Map<string, { key: string; type: string }>();

/**
 * Initialize encrypted storage with encryption key
 * Should be called before using encrypted storage functions
 * If a different key is provided and data exists, it will attempt to read with the new key
 */
export function initializeEncryptedStorage(encryptionKey: string): void {
  // If already initialized with the same key, no need to recreate
  if (encryptedService && currentEncryptionKey === encryptionKey) {
    return;
  }
  
  // If initialized with a different key, warn but allow (user might have changed accounts)
  if (encryptedService && currentEncryptionKey !== encryptionKey) {
    console.warn("[localIndex] Encryption key changed. Previous data may not be accessible.");
    // Clear cache when key changes to avoid using stale data
    recordsCache = null;
  }
  
  currentEncryptionKey = encryptionKey;
  encryptedService = new StorageService(new EncryptedLocalAdapter(encryptionKey));
}

/**
 * Check if encrypted storage is initialized
 */
export function isEncryptedStorageInitialized(): boolean {
  return encryptedService !== null;
}

/**
 * Add emotion record (uses encrypted storage if initialized, otherwise plain storage)
 * Before saving, tries to load existing records with all possible keys to avoid data loss
 */
export async function addEmotionRecord(
  record: EmotionRecord,
  currentWalletAddress?: string | null
): Promise<void> {
  if (encryptedService && currentEncryptionKey) {
    // Clear cache before loading to ensure we get the latest data
    recordsCache = null;
    
    // Before saving, try to load existing records with all possible keys
    // This prevents overwriting data encrypted with different keys
    const existingRecords = await listEmotionRecordsWithAllKeys(currentWalletAddress);
    
    // Check if there's a decryption warning (data exists but can't be decrypted)
    const hasDecryptionWarning = (existingRecords as any).__decryptionWarning === true;
    if (hasDecryptionWarning) {
      // CRITICAL: Don't save if we can't decrypt existing data
      // This prevents data loss when user switches accounts
      const ENCRYPTED_LOCAL_KEY = "echoma_encrypted_mvp_records";
      const hasEncryptedStorage = localStorage.getItem(ENCRYPTED_LOCAL_KEY) !== null;
      if (hasEncryptedStorage) {
        // Create an error with a code that can be translated in the UI layer
        const error = new Error("SAVE_BLOCKED_DECRYPTION_ERROR");
        // Attach flags to indicate this is a recoverable error
        (error as any).isDecryptionError = true;
        (error as any).canForceClear = true;
        (error as any).errorCode = "SAVE_BLOCKED_DECRYPTION_ERROR";
        throw error;
      }
    }
    
    // Remove the warning flag if present (it's not part of the actual records)
    const cleanRecords = existingRecords.filter(r => !(r as any).__decryptionWarning);
    
    // Check if record already exists (update instead of duplicate)
    const existingIndex = cleanRecords.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      cleanRecords[existingIndex] = record;
    } else {
      cleanRecords.push(record);
    }
    
    // Ensure we're using the correct encryption key for the current context
    // Use cached keys when possible to improve performance
    let saveKey = currentEncryptionKey;
    const { data: { session } } = await supabase.auth.getSession();
    
    // Verify the key matches the current context (use cached keys when possible)
    if (currentWalletAddress) {
      const cacheKey = `wallet_${currentWalletAddress}`;
      let expectedKey: string;
      if (KEY_CACHE.has(cacheKey)) {
        expectedKey = KEY_CACHE.get(cacheKey)!.key;
      } else {
        expectedKey = await generateUserKey(currentWalletAddress);
      }
      if (expectedKey !== currentEncryptionKey) {
        // Key mismatch - use the expected key and re-initialize
        saveKey = expectedKey;
        initializeEncryptedStorage(saveKey);
      }
    } else if (session?.user?.id) {
      const cacheKey = `supabase_${session.user.id}`;
      let expectedKey: string;
      if (KEY_CACHE.has(cacheKey)) {
        expectedKey = KEY_CACHE.get(cacheKey)!.key;
      } else {
        expectedKey = await generateUserKeyFromId(session.user.id);
      }
      if (expectedKey !== currentEncryptionKey) {
        // Key mismatch - use the expected key and re-initialize
        saveKey = expectedKey;
        initializeEncryptedStorage(saveKey);
      }
    }
    
    // Save all records (merged) with the correct encryption key
    // Note: This will re-encrypt all records with the current key
    // Records encrypted with other keys will be lost if we can't decrypt them
    // But we've already loaded them above, so they're preserved
    const listJson = JSON.stringify(cleanRecords);
    const { encryptData } = await import("./encryption");
    const encrypted = await encryptData(listJson, saveKey);
    const ENCRYPTED_LOCAL_KEY = "echoma_encrypted_mvp_records";
    
    try {
      localStorage.setItem(ENCRYPTED_LOCAL_KEY, JSON.stringify(encrypted));
      // Clear cache after successful save to ensure next load gets fresh data
      recordsCache = null;
    } catch (storageError: any) {
      // Handle localStorage quota exceeded
      if (storageError.name === 'QuotaExceededError' || storageError.code === 22) {
        const error = new Error("STORAGE_QUOTA_EXCEEDED");
        (error as any).errorCode = "STORAGE_QUOTA_EXCEEDED";
        throw error;
      }
      throw storageError;
    }
  } else {
    // Clear cache for plain storage as well
    recordsCache = null;
    await plainService.save(record);
  }
}

/**
 * List emotion records (uses encrypted storage if initialized, otherwise plain storage)
 */
export async function listEmotionRecords(): Promise<EmotionRecord[]> {
  const records = encryptedService 
    ? await encryptedService.list()
    : await plainService.list();
  // Most recent first
  return records.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/**
 * Get all possible encryption keys for the current user context
 * Uses caching to avoid repeated key generation
 */
async function getAllPossibleKeys(currentWalletAddress?: string | null): Promise<Array<{ key: string; type: string }>> {
  const { data: { session } } = await supabase.auth.getSession();
  const possibleKeys: Array<{ key: string; type: string }> = [];

  try {
    // 1. Try Supabase session (if logged in)
    if (session?.user?.id) {
      const cacheKey = `supabase_${session.user.id}`;
      if (KEY_CACHE.has(cacheKey)) {
        possibleKeys.push(KEY_CACHE.get(cacheKey)!);
      } else {
        const supabaseKey = await generateUserKeyFromId(session.user.id);
        const keyEntry = { key: supabaseKey, type: 'Supabase User' };
        possibleKeys.push(keyEntry);
        KEY_CACHE.set(cacheKey, keyEntry);
      }
    }

    // 2. Try anonymous key (if exists)
    const anonymousKey = await getAnonymousUserKey();
    if (anonymousKey) {
      const cacheKey = 'anonymous';
      if (KEY_CACHE.has(cacheKey)) {
        possibleKeys.push(KEY_CACHE.get(cacheKey)!);
      } else {
        const keyEntry = { key: anonymousKey, type: 'Anonymous' };
        possibleKeys.push(keyEntry);
        KEY_CACHE.set(cacheKey, keyEntry);
      }
    }

    // 3. Try current wallet address (if connected)
    if (currentWalletAddress) {
      const cacheKey = `wallet_${currentWalletAddress}`;
      if (KEY_CACHE.has(cacheKey)) {
        possibleKeys.push(KEY_CACHE.get(cacheKey)!);
      } else {
        const walletKey = await generateUserKey(currentWalletAddress);
        const keyEntry = { key: walletKey, type: 'Wallet Address' };
        possibleKeys.push(keyEntry);
        KEY_CACHE.set(cacheKey, keyEntry);
      }
    }
  } catch (keyError) {
    console.error("[localIndex] Failed to generate possible keys:", keyError);
  }

  return possibleKeys;
}

/**
 * Clear key cache (useful when user logs out or switches accounts)
 */
export function clearKeyCache(): void {
  KEY_CACHE.clear();
  recordsCache = null;
}

/**
 * Try to list emotion records using all possible encryption keys
 * This is useful when user switches between accounts (wallet/anonymous/Supabase)
 * Returns merged records from all successful keys, or empty array if all fail
 * Uses caching to improve performance
 */
export async function listEmotionRecordsWithAllKeys(
  currentWalletAddress?: string | null
): Promise<EmotionRecord[]> {
  // Check cache first
  const { data: { session } } = await supabase.auth.getSession();
  const contextKey = `${currentWalletAddress || 'no-wallet'}_${session?.user?.id || 'no-session'}`;
  
  if (recordsCache && 
      recordsCache.context === contextKey && 
      Date.now() - recordsCache.timestamp < CACHE_TTL) {
    return recordsCache.records;
  }
  
  // First, try plain storage (for backward compatibility)
  const plainRecords = await plainService.list();
  
  // Get all possible keys (uses internal caching)
  const possibleKeys = await getAllPossibleKeys(currentWalletAddress);
  
  // Try each key and collect all successful records
  const allRecordsMap = new Map<string, EmotionRecord>(); // Use Map to deduplicate by ID
  
  // Add plain records first
  for (const record of plainRecords) {
    if (record.id) {
      allRecordsMap.set(record.id, record);
    }
  }
  
  // Try each key and merge records
  let workingKey: string | null = null;
  let workingKeyType: string | null = null;
  let hasEncryptedData = false;
  
  for (const { key, type } of possibleKeys) {
    try {
      const tempService = new StorageService(new EncryptedLocalAdapter(key));
      const records = await tempService.list();
      if (records.length > 0) {
        hasEncryptedData = true;
        console.log(`[localIndex] Successfully loaded ${records.length} records using ${type} key`);
        // Merge records (deduplicate by ID)
        for (const record of records) {
          if (record.id) {
            allRecordsMap.set(record.id, record);
          }
        }
        // Remember the first working key for future operations
        if (!workingKey) {
          workingKey = key;
          workingKeyType = type;
        }
      }
    } catch (error) {
      // Key didn't work, try next one
      console.log(`[localIndex] Failed to decrypt with ${type} key, trying next...`);
      continue;
    }
  }
  
  // Check if there's encrypted data but we couldn't decrypt it
  const ENCRYPTED_LOCAL_KEY = "echoma_encrypted_mvp_records";
  const hasEncryptedStorage = localStorage.getItem(ENCRYPTED_LOCAL_KEY) !== null;
  // If encrypted data exists but we couldn't decrypt it with any available key, set warning
  // This includes cases where:
  // 1. We have keys to try but none worked (possibleKeys.length > 0 && !workingKey)
  // 2. We have encrypted data but no keys to try (hasEncryptedStorage && possibleKeys.length === 0)
  const couldNotDecrypt = hasEncryptedStorage && !workingKey;
  
  // Initialize with the first working key if found
  if (workingKey) {
    currentEncryptionKey = workingKey;
    encryptedService = new StorageService(new EncryptedLocalAdapter(workingKey));
    console.log(`[localIndex] Initialized encrypted storage with ${workingKeyType} key`);
  }
  
  // Convert map to array and sort
  const allRecords = Array.from(allRecordsMap.values());
  const sortedRecords = allRecords.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  
  // Return result with metadata about decryption status
  if (couldNotDecrypt) {
    // Attach metadata to indicate potential data loss
    (sortedRecords as any).__decryptionWarning = true;
    console.warn("[localIndex] Could not decrypt local records - encrypted data exists but no working key found");
  }
  
  // Create a clean copy for caching (without metadata flags)
  const cleanRecords = sortedRecords.filter(r => !(r as any).__decryptionWarning);
  
  // Cache the results (only if cache is not explicitly cleared)
  if (recordsCache === null) {
    recordsCache = {
      records: cleanRecords,
      timestamp: Date.now(),
      context: contextKey,
    };
  }
  
  return sortedRecords;
}

/**
 * Clear emotion records (clears both encrypted and plain storage)
 */
export async function clearEmotionRecords(): Promise<void> {
  if (encryptedService) {
    await encryptedService.clear();
  }
  await plainService.clear();
  // Clear cache when clearing records
  clearKeyCache();
}

/**
 * Force clear encrypted storage (useful when data cannot be decrypted)
 * This will remove all encrypted data, allowing user to start fresh
 */
export function forceClearEncryptedStorage(): void {
  const ENCRYPTED_LOCAL_KEY = "echoma_encrypted_mvp_records";
  const LOCAL_KEY = "echoma_mvp_records";
  localStorage.removeItem(ENCRYPTED_LOCAL_KEY);
  localStorage.removeItem(LOCAL_KEY);
  // Clear cache and reset service
  clearKeyCache();
  encryptedService = null;
  currentEncryptionKey = null;
}


