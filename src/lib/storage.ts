/**
 * Secure localStorage utilities
 * Encrypts sensitive data before storing in localStorage
 */

import { encryptData, decryptData, decryptDataWithMigration, type EncryptedData } from "./encryption";

const STORAGE_KEY_PREFIX = "echoma_encrypted_";
const RECORDS_KEY = "emotionRecords";

/**
 * Encrypt and store data in localStorage
 */
export async function setEncryptedItem(
  key: string,
  value: string,
  encryptionKey: string
): Promise<void> {
  try {
    const encrypted = await encryptData(value, encryptionKey);
    const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
    localStorage.setItem(storageKey, JSON.stringify(encrypted));
  } catch (error) {
    console.error("Failed to encrypt and store data:", error);
    throw new Error("Failed to save data securely");
  }
}

/**
 * Retrieve and decrypt data from localStorage
 */
export async function getEncryptedItem(
  key: string,
  encryptionKey: string
): Promise<string | null> {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
    const encryptedDataStr = localStorage.getItem(storageKey);
    
    if (!encryptedDataStr) {
      return null;
    }

    const encryptedData: EncryptedData = JSON.parse(encryptedDataStr);
    // Use decryptDataWithMigration to support legacy format
    const decrypted = await decryptDataWithMigration(encryptedData, encryptionKey);
    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt stored data:", error);
    // If decryption fails, the data might be corrupted or key changed
    // Return null to allow graceful handling
    return null;
  }
}

/**
 * Store emotion records securely
 * Only stores minimal metadata (blobId, timestamp) - not the full snapshot
 */
export async function storeEmotionRecordMetadata(
  record: {
    blobId: string;
    walrusUrl: string;
    payloadHash: string;
    timestamp: number;
    emotion: string;
    intensity: number;
  },
  encryptionKey: string
): Promise<void> {
  try {
    // Get existing records
    const existingRecordsStr = await getEncryptedItem(RECORDS_KEY, encryptionKey);
    const existingRecords = existingRecordsStr 
      ? JSON.parse(existingRecordsStr)
      : [];

    // Add new record (only metadata, not full snapshot)
    existingRecords.push({
      blobId: record.blobId,
      walrusUrl: record.walrusUrl,
      payloadHash: record.payloadHash,
      timestamp: record.timestamp,
      emotion: record.emotion,
      intensity: record.intensity,
    });

    // Store encrypted
    await setEncryptedItem(RECORDS_KEY, JSON.stringify(existingRecords), encryptionKey);
  } catch (error) {
    console.error("Failed to store emotion record metadata:", error);
    throw new Error("Failed to save emotion record");
  }
}

/**
 * Retrieve emotion records metadata
 */
export async function getEmotionRecordsMetadata(
  encryptionKey: string
): Promise<Array<{
  blobId: string;
  walrusUrl: string;
  payloadHash: string;
  timestamp: number;
  emotion: string;
  intensity: number;
}>> {
  try {
    const recordsStr = await getEncryptedItem(RECORDS_KEY, encryptionKey);
    if (!recordsStr) {
      return [];
    }
    return JSON.parse(recordsStr);
  } catch (error) {
    console.error("Failed to retrieve emotion records:", error);
    return [];
  }
}

/**
 * Clear all encrypted storage
 */
export function clearEncryptedStorage(): void {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

