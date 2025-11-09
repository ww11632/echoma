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
  try {
    const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/store?epochs=${epochs}`, {
      method: "PUT",
      body: encryptedData,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Walrus upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extract blob ID from response
    let blobId: string;
    if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
    } else if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
    } else {
      throw new Error("Unexpected Walrus response format");
    }

    return {
      ...result,
      blobId,
      suiRef: result.newlyCreated?.blobObject?.id || null,
    };
  } catch (error) {
    console.error("Walrus upload error:", error);
    throw error;
  }
}

/**
 * Read data from Walrus storage
 */
export async function readFromWalrus(blobId: string): Promise<string> {
  try {
    const response = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/${blobId}`);

    if (!response.ok) {
      throw new Error(`Walrus read failed: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error("Walrus read error:", error);
    throw error;
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
 */
export function prepareEmotionSnapshot(
  emotion: string,
  intensity: number,
  description: string,
  walletAddress: string
): EmotionSnapshot {
  return {
    emotion,
    intensity,
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
