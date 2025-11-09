/**
 * Walrus Storage Integration
 * Upload encrypted emotion snapshots to Walrus decentralized storage
 */

import { hashData } from "./encryption";

// Walrus testnet configuration
const WALRUS_PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";
const DEFAULT_EPOCHS = 5; // Store for 5 epochs (~1 year on testnet)

export interface WalrusUploadResult {
  blobId: string;
  suiRef: string | null;
  alreadyCertified?: {
    blobId: string;
    endEpoch: number;
  };
  newlyCreated?: {
    blobObject: {
      id: string;
      storedEpoch: number;
      blobId: string;
      size: number;
      erasureCodeType: string;
      certifiedEpoch: number;
      storage: {
        id: string;
        startEpoch: number;
        endEpoch: number;
        storageSize: number;
      };
    };
    encodedSize: number;
    cost: number;
  };
}

export interface EmotionSnapshot {
  emotion: string;
  intensity: number;
  description: string;
  timestamp: number;
  walletAddress: string;
  version: string;
}

/**
 * Upload encrypted data to Walrus storage
 */
export async function uploadToWalrus(
  encryptedData: string,
  epochs: number = DEFAULT_EPOCHS
): Promise<WalrusUploadResult> {
  // Validate epochs parameter
  if (epochs < 1 || epochs > 100) {
    throw new Error("Invalid storage duration");
  }

  try {
    const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/store?epochs=${epochs}`, {
      method: "PUT",
      body: encryptedData,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });

    if (!response.ok) {
      // Log detailed error server-side only
      const errorText = await response.text();
      console.error("[INTERNAL] Walrus upload error:", {
        status: response.status,
        error: errorText,
      });

      // Show generic error to user
      if (response.status >= 500) {
        throw new Error("Storage service temporarily unavailable. Please try again later.");
      } else if (response.status === 413) {
        throw new Error("Data too large. Please reduce the size of your entry.");
      } else if (response.status === 400) {
        throw new Error("Invalid data format. Please try again.");
      } else {
        throw new Error("Storage upload failed. Please try again.");
      }
    }

    const result = await response.json();
    
    // Extract blob ID from response
    let blobId: string;
    if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
    } else if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
    } else {
      throw new Error("Unexpected storage response format");
    }

    // Validate the returned blob ID
    if (!isValidBlobId(blobId)) {
      throw new Error("Received invalid blob ID from storage service");
    }

    return {
      ...result,
      blobId,
      suiRef: result.newlyCreated?.blobObject?.id || null,
    };
  } catch (error) {
    // Don't expose internal errors
    if (error instanceof Error) {
      // If it's already a user-friendly error, re-throw it
      if (error.message.includes("Storage service") ||
          error.message.includes("Data too large") ||
          error.message.includes("Invalid data") ||
          error.message.includes("Storage upload failed") ||
          error.message.includes("Invalid storage duration") ||
          error.message.includes("Received invalid blob ID")) {
        throw error;
      }
      
      // Network errors
      if (error.message.includes("fetch") || error.message.includes("network")) {
        throw new Error("Network error. Check your connection and try again.");
      }
    }
    
    // Generic fallback
    throw new Error("Upload failed. Please try again later.");
  }
}

/**
 * Validate blob ID format
 */
export function isValidBlobId(blobId: string): boolean {
  // Walrus blob IDs are typically base64 or hex encoded hashes
  // Adjust regex based on actual Walrus blob ID format
  const blobIdPattern = /^[A-Za-z0-9_-]{32,128}$/;
  return blobIdPattern.test(blobId) && blobId.length <= 128;
}

/**
 * Read data from Walrus storage
 */
export async function readFromWalrus(blobId: string): Promise<string> {
  // Validate blob ID format
  if (!isValidBlobId(blobId)) {
    throw new Error("Invalid blob ID format");
  }

  // Sanitize blob ID to prevent URL manipulation
  const sanitizedBlobId = encodeURIComponent(blobId);

  try {
    const response = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/${sanitizedBlobId}`);

    if (!response.ok) {
      // Log detailed error server-side only
      const errorText = await response.text();
      console.error("[INTERNAL] Walrus read error:", {
        status: response.status,
        blobId: blobId.slice(0, 8) + "...", // Only log partial blob ID
        error: errorText,
      });

      // Show generic error to user
      if (response.status === 404) {
        throw new Error("Data not found. It may have expired or been removed.");
      } else if (response.status >= 500) {
        throw new Error("Storage service temporarily unavailable. Please try again later.");
      } else {
        throw new Error("Failed to retrieve data. Please try again.");
      }
    }

    return await response.text();
  } catch (error) {
    // Don't expose internal errors
    if (error instanceof Error) {
      // If it's already a user-friendly error, re-throw it
      if (error.message.includes("Invalid blob ID") || 
          error.message.includes("not found") ||
          error.message.includes("unavailable") ||
          error.message.includes("Failed to retrieve")) {
        throw error;
      }
      
      // Network errors
      if (error.message.includes("fetch") || error.message.includes("network")) {
        throw new Error("Network error. Check your connection and try again.");
      }
    }
    
    // Generic fallback
    throw new Error("Failed to retrieve data. Please try again later.");
  }
}

/**
 * Generate Walrus URL for a blob
 */
export function getWalrusUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR_URL}/v1/${blobId}`;
}

/**
 * Prepare emotion snapshot for storage
 * Validates and sanitizes inputs before creating snapshot
 */
export function prepareEmotionSnapshot(
  emotion: string,
  intensity: number,
  description: string,
  walletAddress: string
): EmotionSnapshot {
  // Import validation at runtime to avoid circular dependencies
  // Basic validation
  if (!emotion || typeof emotion !== "string") {
    throw new Error("Invalid emotion type");
  }

  if (typeof intensity !== "number" || intensity < 0 || intensity > 100) {
    throw new Error("Intensity must be between 0 and 100");
  }

  if (!description || typeof description !== "string") {
    throw new Error("Description is required");
  }

  if (!walletAddress || typeof walletAddress !== "string") {
    throw new Error("Wallet address is required");
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{64}$/.test(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  return {
    emotion,
    intensity: Math.round(intensity), // Ensure integer
    description,
    timestamp: Date.now(),
    walletAddress,
    version: "1.0.0",
  };
}

/**
 * Complete workflow: Encrypt and upload emotion snapshot
 */
export async function storeEmotionSnapshot(
  snapshot: EmotionSnapshot,
  encryptedData: string
): Promise<{
  blobId: string;
  walrusUrl: string;
  payloadHash: string;
  suiRef: string | null;
}> {
  // Calculate hash of encrypted data for on-chain verification
  const payloadHash = await hashData(encryptedData);
  
  // Upload to Walrus
  const uploadResult = await uploadToWalrus(encryptedData);
  
  return {
    blobId: uploadResult.blobId,
    walrusUrl: getWalrusUrl(uploadResult.blobId),
    payloadHash,
    suiRef: uploadResult.suiRef,
  };
}
