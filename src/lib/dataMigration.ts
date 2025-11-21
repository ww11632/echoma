/**
 * Data Migration Utilities
 * Handles re-encryption of data when password changes or key version updates
 */

import { encryptData, decryptData, generateUserKey, generateUserKeyFromId, PUBLIC_SEAL_KEY } from "./encryption";
import type { EmotionRecord } from "./dataSchema";

const ENCRYPTED_LOCAL_KEY = "echoma_encrypted_mvp_records";
const ENCRYPTED_PUBLIC_KEY = "echoma_encrypted_public_records";

export interface MigrationResult {
  success: boolean;
  privateRecordsProcessed: number;
  publicRecordsProcessed: number;
  errors: string[];
}

/**
 * Re-encrypt all local data with a new password
 * Used when user changes their encryption password
 * 
 * @param oldPassword - The old encryption password
 * @param newPassword - The new encryption password
 * @param walletAddress - Optional wallet address for wallet-based encryption
 * @param userId - Optional user ID for user-based encryption
 * @returns Migration result with counts and any errors
 */
export async function reEncryptAllData(
  oldPassword: string,
  newPassword: string,
  walletAddress?: string | null,
  userId?: string | null
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    privateRecordsProcessed: 0,
    publicRecordsProcessed: 0,
    errors: [],
  };

  try {
    // Step 1: Generate old and new encryption keys
    let oldKey: string;
    let newKey: string;

    if (walletAddress) {
      oldKey = await generateUserKey(walletAddress, undefined, oldPassword);
      newKey = await generateUserKey(walletAddress, undefined, newPassword);
    } else if (userId) {
      oldKey = await generateUserKeyFromId(userId, oldPassword);
      newKey = await generateUserKeyFromId(userId, newPassword);
    } else {
      // Anonymous mode - use passwords directly as keys
      oldKey = oldPassword;
      newKey = newPassword;
    }

    // Step 2: Decrypt and re-encrypt private records
    try {
      const privateEncryptedData = localStorage.getItem(ENCRYPTED_LOCAL_KEY);
      if (privateEncryptedData) {
        // Decrypt with old key
        const privateDecrypted = await decryptData(JSON.parse(privateEncryptedData), oldKey);
        const privateRecords: EmotionRecord[] = JSON.parse(privateDecrypted);

        // Re-encrypt with new key
        const privateReEncrypted = await encryptData(JSON.stringify(privateRecords), newKey);
        localStorage.setItem(ENCRYPTED_LOCAL_KEY, JSON.stringify(privateReEncrypted));

        result.privateRecordsProcessed = privateRecords.length;
        console.log(`[dataMigration] Re-encrypted ${privateRecords.length} private records`);
      }
    } catch (error: any) {
      const errorMsg = `Failed to re-encrypt private records: ${error.message}`;
      console.error(`[dataMigration] ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    // Step 3: Decrypt and re-encrypt public records (if any use user-specific key)
    // Note: Public records usually use PUBLIC_SEAL_KEY, but we check anyway
    try {
      const publicEncryptedData = localStorage.getItem(ENCRYPTED_PUBLIC_KEY);
      if (publicEncryptedData) {
        // Try to decrypt with old key first (in case it was encrypted with user key)
        try {
          const publicDecrypted = await decryptData(JSON.parse(publicEncryptedData), oldKey);
          const publicRecords: EmotionRecord[] = JSON.parse(publicDecrypted);

          // Re-encrypt with new key
          const publicReEncrypted = await encryptData(JSON.stringify(publicRecords), newKey);
          localStorage.setItem(ENCRYPTED_PUBLIC_KEY, JSON.stringify(publicReEncrypted));

          result.publicRecordsProcessed = publicRecords.length;
          console.log(`[dataMigration] Re-encrypted ${publicRecords.length} public records`);
        } catch {
          // If decryption with old key fails, it might be using PUBLIC_SEAL_KEY
          // No need to re-encrypt in this case
          console.log(`[dataMigration] Public records use PUBLIC_SEAL_KEY, no re-encryption needed`);
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to re-encrypt public records: ${error.message}`;
      console.warn(`[dataMigration] ${errorMsg}`);
      // Don't add to errors as public records might intentionally use PUBLIC_SEAL_KEY
    }

    // Step 4: Mark migration as successful if at least one type was processed
    if (result.privateRecordsProcessed > 0 || result.publicRecordsProcessed > 0) {
      result.success = true;
    } else if (result.errors.length === 0) {
      // No records found, but no errors either
      result.success = true;
      console.log(`[dataMigration] No encrypted records found to migrate`);
    }

    return result;
  } catch (error: any) {
    console.error(`[dataMigration] Migration failed:`, error);
    result.errors.push(error.message || "Unknown migration error");
    return result;
  }
}

/**
 * Migrate data from old key version to new key version
 * This is used when the encryption key derivation method changes
 * 
 * @param oldKeyVersion - The old key version number
 * @param newKeyVersion - The new key version number
 * @param password - User password (if available)
 * @param walletAddress - Optional wallet address
 * @param userId - Optional user ID
 * @returns Migration result
 */
export async function migrateKeyVersion(
  oldKeyVersion: number,
  newKeyVersion: number,
  password: string | null,
  walletAddress?: string | null,
  userId?: string | null
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    privateRecordsProcessed: 0,
    publicRecordsProcessed: 0,
    errors: [],
  };

  try {
    console.log(`[dataMigration] Migrating from key version ${oldKeyVersion} to ${newKeyVersion}`);

    // Generate keys for both versions
    let oldKey: string;
    let newKey: string;

    if (oldKeyVersion === 1 && newKeyVersion === 2) {
      // v1: Without user password, v2: With user password
      if (walletAddress) {
        oldKey = await generateUserKey(walletAddress, undefined, undefined); // v1: no password
        newKey = await generateUserKey(walletAddress, undefined, password || undefined); // v2: with password
      } else if (userId) {
        oldKey = await generateUserKeyFromId(userId, undefined); // v1: no password
        newKey = await generateUserKeyFromId(userId, password || undefined); // v2: with password
      } else {
        result.errors.push("Cannot migrate anonymous key versions");
        return result;
      }

      // If password is not provided, keys will be the same - no migration needed
      if (!password) {
        result.success = true;
        console.log(`[dataMigration] No password provided, keys unchanged`);
        return result;
      }

      // Re-encrypt data with new key
      return await reEncryptWithNewKey(oldKey, newKey);
    } else {
      result.errors.push(`Unsupported key version migration: ${oldKeyVersion} -> ${newKeyVersion}`);
      return result;
    }
  } catch (error: any) {
    console.error(`[dataMigration] Version migration failed:`, error);
    result.errors.push(error.message || "Unknown version migration error");
    return result;
  }
}

/**
 * Re-encrypt data with a new key (internal helper)
 */
async function reEncryptWithNewKey(
  oldKey: string,
  newKey: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    privateRecordsProcessed: 0,
    publicRecordsProcessed: 0,
    errors: [],
  };

  // Re-encrypt private records
  try {
    const privateEncryptedData = localStorage.getItem(ENCRYPTED_LOCAL_KEY);
    if (privateEncryptedData) {
      const privateDecrypted = await decryptData(JSON.parse(privateEncryptedData), oldKey);
      const privateRecords: EmotionRecord[] = JSON.parse(privateDecrypted);

      const privateReEncrypted = await encryptData(JSON.stringify(privateRecords), newKey);
      localStorage.setItem(ENCRYPTED_LOCAL_KEY, JSON.stringify(privateReEncrypted));

      result.privateRecordsProcessed = privateRecords.length;
      console.log(`[dataMigration] Migrated ${privateRecords.length} private records`);
    }
  } catch (error: any) {
    const errorMsg = `Failed to migrate private records: ${error.message}`;
    console.error(`[dataMigration] ${errorMsg}`);
    result.errors.push(errorMsg);
  }

  // Re-encrypt public records (if using user key)
  try {
    const publicEncryptedData = localStorage.getItem(ENCRYPTED_PUBLIC_KEY);
    if (publicEncryptedData) {
      try {
        const publicDecrypted = await decryptData(JSON.parse(publicEncryptedData), oldKey);
        const publicRecords: EmotionRecord[] = JSON.parse(publicDecrypted);

        const publicReEncrypted = await encryptData(JSON.stringify(publicRecords), newKey);
        localStorage.setItem(ENCRYPTED_PUBLIC_KEY, JSON.stringify(publicReEncrypted));

        result.publicRecordsProcessed = publicRecords.length;
        console.log(`[dataMigration] Migrated ${publicRecords.length} public records`);
      } catch {
        // Public records might use PUBLIC_SEAL_KEY, no migration needed
        console.log(`[dataMigration] Public records don't need migration`);
      }
    }
  } catch (error: any) {
    // Non-critical error for public records
    console.warn(`[dataMigration] Public records migration skipped:`, error);
  }

  if (result.privateRecordsProcessed > 0 || result.publicRecordsProcessed > 0) {
    result.success = true;
  } else if (result.errors.length === 0) {
    result.success = true;
  }

  return result;
}

/**
 * Verify data integrity after migration
 * Attempts to decrypt data with the new key to ensure migration was successful
 * 
 * @param newKey - The new encryption key to test
 * @returns True if data can be decrypted, false otherwise
 */
export async function verifyDataIntegrity(newKey: string): Promise<boolean> {
  try {
    const privateEncryptedData = localStorage.getItem(ENCRYPTED_LOCAL_KEY);
    if (privateEncryptedData) {
      await decryptData(JSON.parse(privateEncryptedData), newKey);
      console.log(`[dataMigration] Data integrity verified: private records OK`);
    }

    const publicEncryptedData = localStorage.getItem(ENCRYPTED_PUBLIC_KEY);
    if (publicEncryptedData) {
      try {
        await decryptData(JSON.parse(publicEncryptedData), newKey);
        console.log(`[dataMigration] Data integrity verified: public records OK`);
      } catch {
        // Public records might use PUBLIC_SEAL_KEY
        await decryptData(JSON.parse(publicEncryptedData), PUBLIC_SEAL_KEY);
        console.log(`[dataMigration] Data integrity verified: public records use PUBLIC_SEAL_KEY`);
      }
    }

    return true;
  } catch (error) {
    console.error(`[dataMigration] Data integrity check failed:`, error);
    return false;
  }
}

