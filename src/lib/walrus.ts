/**
 * Walrus Storage Integration
 * Upload encrypted emotion snapshots to Walrus decentralized storage
 */

import { hashData } from "./encryption";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { walrus } from "@mysten/walrus";
import type { Signer } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import type { WalrusClient } from "@mysten/walrus";

// Walrus testnet configuration (new upload relay + aggregator hosts)
const WALRUS_PUBLISHER_URL = "https://upload-relay.testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = "https://aggregator.testnet.walrus.space";
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

type WalrusOwner =
  | { $kind: "AddressOwner"; AddressOwner: string }
  | { $kind: "ObjectOwner"; ObjectOwner: string }
  | { $kind: "Shared"; Shared: { initialSharedVersion: string } }
  | { $kind: "Immutable"; Immutable: true }
  | { $kind: "ConsensusAddressOwner"; ConsensusAddressOwner: { owner: string; startVersion: string } }
  | { $kind: "Unknown"; Unknown?: true };

interface WalrusChangedObject {
  id: string;
  inputState: "Unknown" | "DoesNotExist" | "Exists";
  inputVersion: string | null;
  inputDigest: string | null;
  inputOwner: WalrusOwner | null;
  outputState: "Unknown" | "DoesNotExist" | "ObjectWrite" | "PackageWrite";
  outputVersion: string | null;
  outputDigest: string | null;
  outputOwner: WalrusOwner | null;
  idOperation: "Unknown" | "None" | "Created" | "Deleted";
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
 * Create Walrus client for SDK usage
 * The walrus SDK extends a SuiClient, so we need to create a SuiClient first
 */
function createWalrusClient(): WalrusClient {
  const suiClient = new SuiClient({
    url: getFullnodeUrl("testnet"),
    network: "testnet", // Required for walrus to work correctly
  });
  
  // Extend the SuiClient with walrus functionality
  return suiClient.$extend(walrus()) as WalrusClient;
}

/**
 * Create a signer adapter from dapp-kit wallet
 * This will trigger wallet popup for transaction signing
 */
export function createSignerFromWallet(
  wallet: any,
  accountAddress: string,
  suiClient?: SuiClient
): Signer {
  if (!wallet) {
    throw new Error("Wallet is not connected");
  }

  const clientToUse = suiClient || new SuiClient({
    url: getFullnodeUrl("testnet"),
  });

  // Helper to sign bytes using wallet
  const signBytes = async (bytes: Uint8Array): Promise<Uint8Array> => {
    console.log("[Signer] Attempting to sign transaction bytes...");
    console.log("[Signer] Bytes length:", bytes.length);
    
    // Try wallet-standard format first
    const signFeature = wallet.features?.['sui:signTransactionBlock'];
    if (signFeature && typeof signFeature.signTransactionBlock === 'function') {
      try {
        console.log("[Signer] Using wallet.features['sui:signTransactionBlock']");
        const tx = Transaction.from(bytes);
        const result = await signFeature.signTransactionBlock({
          transactionBlock: tx,
          account: { address: accountAddress },
          chain: 'sui:testnet', // Required: Sui chain identifier
        });
        
        // Convert signature to Uint8Array
        const signature = typeof result.signature === 'string' 
          ? Uint8Array.from(atob(result.signature), c => c.charCodeAt(0))
          : result.signature;
        
        console.log("[Signer] Signature successful via wallet-standard, length:", signature.length);
        return signature;
      } catch (error) {
        console.warn("[Signer] wallet-standard signing failed:", error);
        console.warn("[Signer] Error details:", error instanceof Error ? error.message : String(error));
      }
    }

    // Try legacy format
    if (wallet.features?.sui?.signTransactionBlock && typeof wallet.features.sui.signTransactionBlock === 'function') {
      try {
        console.log("[Signer] Using wallet.features.sui.signTransactionBlock (legacy)");
        const tx = Transaction.from(bytes);
        const result = await wallet.features.sui.signTransactionBlock({
          transactionBlock: tx,
          account: { address: accountAddress },
          chain: 'sui:testnet', // Required: Sui chain identifier
        });
        
        const signature = typeof result.signature === 'string'
          ? Uint8Array.from(atob(result.signature), c => c.charCodeAt(0))
          : result.signature;
        
        console.log("[Signer] Signature successful via legacy format, length:", signature.length);
        return signature;
      } catch (error) {
        console.warn("[Signer] Legacy signing failed:", error);
        console.warn("[Signer] Error details:", error instanceof Error ? error.message : String(error));
      }
    }

    // Try signMessage as last resort (not recommended for transactions, but might work)
    const signMessageFeature = wallet.features?.['sui:signMessage'] || wallet.features?.sui?.signMessage;
    if (signMessageFeature && typeof signMessageFeature.signMessage === 'function') {
      try {
        console.log("[Signer] Attempting to use signMessage as fallback");
        const result = await signMessageFeature.signMessage({
          message: bytes,
          account: { address: accountAddress },
        });
        
        const signature = typeof result.signature === 'string'
          ? Uint8Array.from(atob(result.signature), c => c.charCodeAt(0))
          : result.signature;
        
        console.log("[Signer] Signature successful via signMessage, length:", signature.length);
        return signature;
      } catch (error) {
        console.warn("[Signer] signMessage failed:", error);
      }
    }

    const availableFeatures = Object.keys(wallet.features || {});
    throw new Error(`Wallet does not support transaction signing. Available features: ${JSON.stringify(availableFeatures)}`);
  };

  const signerAdapter: Signer = {
    toSuiAddress: () => accountAddress,
    
    getAddress: async () => accountAddress,
    
    sign: async (bytes: Uint8Array) => {
      const signature = await signBytes(bytes);
      return {
        signature,
      } as any;
    },
    
    signAndExecuteTransaction: async ({ transaction, client: txClient }) => {
      const client = txClient || clientToUse;
      
      console.log("[Signer] signAndExecuteTransaction called - using manual build/sign/execute method");
      
      // Directly use manual build/sign/execute method (most reliable)
      console.log("[Signer] Building transaction...");
      const transactionBytes = await transaction.build({ client });
      console.log("[Signer] Transaction built, bytes length:", transactionBytes.length);
      const signatureBytes = await signBytes(transactionBytes);
      const signatureBase64 = toBase64(signatureBytes);
      
      const response = await client.executeTransactionBlock({
        transactionBlock: transactionBytes,
        signature: signatureBase64,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });
      
      console.log("[Signer] Transaction executed successfully, digest:", response.digest);
      console.log("[Signer] Response effects type:", typeof response.effects);
      console.log("[Signer] Response events type:", typeof response.events);
      console.log("[Signer] Response events isArray:", Array.isArray(response.events));
      
      // executeTransactionBlock returns effects as an object with specific structure
      // Walrus SDK expects the result to have effects and events in a specific format
      // The SDK might call .filter() on effects.created or effects.mutated, so ensure they are arrays
      const result: any = {
        digest: response.digest,
      };
      
      // Ensure effects is properly formatted
      if (response.effects) {
        // response.effects is an object with status, executedEpoch, gasUsed, etc.
        // It also has created, mutated, deleted arrays
        result.effects = {
          ...response.effects,
          // Ensure created, mutated, deleted are arrays (not undefined)
          created: Array.isArray(response.effects.created) ? response.effects.created : [],
          mutated: Array.isArray(response.effects.mutated) ? response.effects.mutated : [],
          deleted: Array.isArray(response.effects.deleted) ? response.effects.deleted : [],
        };

        // Populate changedObjects so Walrus SDK can inspect created IDs
        result.effects.changedObjects = buildChangedObjects(response);
        if (!Array.isArray(result.effects.unchangedConsensusObjects)) {
          result.effects.unchangedConsensusObjects = [];
        }
        if (typeof result.effects.gasObject === "undefined") {
          result.effects.gasObject = null;
        }
      } else {
        // If effects is missing, provide empty structure
        result.effects = {
          created: [],
          mutated: [],
          deleted: [],
          changedObjects: [],
          unchangedConsensusObjects: [],
          gasObject: null,
        };
      }
      
      // Ensure events is an array
      if (response.events) {
        result.events = Array.isArray(response.events) ? response.events : [response.events];
      } else {
        result.events = [];
      }
      
      console.log("[Signer] Returning result with effects.created:", Array.isArray(result.effects.created));
      console.log("[Signer] Returning result with effects.mutated:", Array.isArray(result.effects.mutated));
      console.log("[Signer] Returning result with events:", Array.isArray(result.events));
      
      return result;
    },
    
    getKeyScheme: () => 'ED25519' as const,
    
    getPublicKey: async () => {
      // Return a placeholder Ed25519PublicKey - wallet adapters don't expose public keys
      // Override toSuiAddress to return the actual account address
      const publicKey = new Ed25519PublicKey(new Uint8Array(32));
      return {
        ...publicKey,
        toSuiAddress: () => accountAddress,
      } as any;
    },
  };

  return signerAdapter;
}

function toNullableString(value: unknown): string | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return typeof value === "string" ? value : String(value);
}

function normalizeWalrusOwner(owner: any): WalrusOwner | null {
  if (!owner) {
    return null;
  }

  if (owner.$kind) {
    return owner as WalrusOwner;
  }

  if (typeof owner === "string") {
    if (owner === "Immutable") {
      return { $kind: "Immutable", Immutable: true };
    }
    return { $kind: "Unknown" };
  }

  const normalized = Object.entries(owner).reduce<Record<string, any>>((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});

  if ("addressowner" in normalized) {
    return { $kind: "AddressOwner", AddressOwner: String(normalized["addressowner"]) };
  }

  if ("objectowner" in normalized) {
    return { $kind: "ObjectOwner", ObjectOwner: String(normalized["objectowner"]) };
  }

  if ("shared" in normalized) {
    const sharedValue = normalized["shared"] || {};
    const initial =
      sharedValue.initial_shared_version ??
      sharedValue.initialSharedVersion ??
      sharedValue.initialversion ??
      sharedValue.initialVersion ??
      "0";
    return {
      $kind: "Shared",
      Shared: {
        initialSharedVersion: String(initial),
      },
    };
  }

  if ("immutable" in normalized) {
    return { $kind: "Immutable", Immutable: true };
  }

  if ("consensusaddressowner" in normalized) {
    const consensus = normalized["consensusaddressowner"] || {};
    return {
      $kind: "ConsensusAddressOwner",
      ConsensusAddressOwner: {
        owner: String(consensus.owner ?? ""),
        startVersion: String(consensus.startVersion ?? consensus.start_version ?? "0"),
      },
    };
  }

  return { $kind: "Unknown" };
}

function buildChangedObjectsFromObjectChanges(response: any): WalrusChangedObject[] {
  const objectChanges = Array.isArray(response?.objectChanges) ? response.objectChanges : [];
  const changedObjects: WalrusChangedObject[] = [];

  for (const change of objectChanges) {
    if (!change || typeof change !== "object") {
      continue;
    }

    switch (change.type) {
      case "created":
        changedObjects.push({
          id: change.objectId,
          inputState: "DoesNotExist",
          inputVersion: null,
          inputDigest: null,
          inputOwner: null,
          outputState: "ObjectWrite",
          outputVersion: toNullableString(change.version),
          outputDigest: change.digest ?? null,
          outputOwner: normalizeWalrusOwner(change.owner),
          idOperation: "Created",
        });
        break;
      case "mutated":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: toNullableString(change.previousVersion ?? change.version),
          inputDigest: change.digest ?? null,
          inputOwner: normalizeWalrusOwner(change.owner),
          outputState: "ObjectWrite",
          outputVersion: toNullableString(change.version),
          outputDigest: change.digest ?? null,
          outputOwner: normalizeWalrusOwner(change.owner),
          idOperation: "None",
        });
        break;
      case "transferred":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: toNullableString(change.version),
          inputDigest: change.digest ?? null,
          inputOwner: {
            $kind: "AddressOwner",
            AddressOwner: String(change.sender ?? ""),
          },
          outputState: "ObjectWrite",
          outputVersion: toNullableString(change.version),
          outputDigest: change.digest ?? null,
          outputOwner: normalizeWalrusOwner(change.recipient),
          idOperation: "None",
        });
        break;
      case "deleted":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: toNullableString(change.version),
          inputDigest: null,
          inputOwner: null,
          outputState: "DoesNotExist",
          outputVersion: null,
          outputDigest: null,
          outputOwner: null,
          idOperation: "Deleted",
        });
        break;
      case "wrapped":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: toNullableString(change.version),
          inputDigest: null,
          inputOwner: {
            $kind: "AddressOwner",
            AddressOwner: String(change.sender ?? ""),
          },
          outputState: "ObjectWrite",
          outputVersion: toNullableString(change.version),
          outputDigest: null,
          outputOwner: {
            $kind: "ObjectOwner",
            ObjectOwner: String(change.sender ?? ""),
          },
          idOperation: "None",
        });
        break;
      case "published":
        changedObjects.push({
          id: change.packageId,
          inputState: "DoesNotExist",
          inputVersion: null,
          inputDigest: null,
          inputOwner: null,
          outputState: "PackageWrite",
          outputVersion: toNullableString(change.version),
          outputDigest: change.digest ?? null,
          outputOwner: null,
          idOperation: "Created",
        });
        break;
      default:
        break;
    }
  }

  return changedObjects;
}

function buildChangedObjectsFromEffects(effects: any): WalrusChangedObject[] {
  const changedObjects: WalrusChangedObject[] = [];
  if (!effects || typeof effects !== "object") {
    return changedObjects;
  }

  const addEntry = (entry: any, overrides: Partial<WalrusChangedObject>) => {
    if (!entry) return;
    const objectId = entry.reference?.objectId ?? entry.objectId;
    if (!objectId) return;

    changedObjects.push({
      id: objectId,
      inputState: "Unknown",
      inputVersion: null,
      inputDigest: null,
      inputOwner: null,
      outputState: "Unknown",
      outputVersion: null,
      outputDigest: null,
      outputOwner: null,
      idOperation: "Unknown",
      ...overrides,
    });
  };

  const created = Array.isArray(effects.created) ? effects.created : [];
  for (const entry of created) {
    addEntry(entry, {
      inputState: "DoesNotExist",
      outputState: "ObjectWrite",
      outputVersion: toNullableString(entry.reference?.version ?? entry.version),
      outputDigest: entry.reference?.digest ?? entry.digest ?? null,
      outputOwner: normalizeWalrusOwner(entry.owner),
      idOperation: "Created",
    });
  }

  const mutated = Array.isArray(effects.mutated) ? effects.mutated : [];
  for (const entry of mutated) {
    const version = toNullableString(entry.reference?.version ?? entry.version);
    addEntry(entry, {
      inputState: "Exists",
      inputVersion: version,
      inputOwner: normalizeWalrusOwner(entry.owner),
      outputState: "ObjectWrite",
      outputVersion: version,
      outputDigest: entry.reference?.digest ?? entry.digest ?? null,
      outputOwner: normalizeWalrusOwner(entry.owner),
      idOperation: "None",
    });
  }

  const deleted = Array.isArray(effects.deleted) ? effects.deleted : [];
  for (const entry of deleted) {
    addEntry(entry, {
      inputState: "Exists",
      inputVersion: toNullableString(entry.version ?? entry.reference?.version),
      outputState: "DoesNotExist",
      idOperation: "Deleted",
    });
  }

  const wrapped = Array.isArray(effects.wrapped) ? effects.wrapped : [];
  for (const entry of wrapped) {
    addEntry(entry, {
      inputState: "Exists",
      inputVersion: toNullableString(entry.version ?? entry.reference?.version),
      inputOwner: normalizeWalrusOwner(entry.owner),
      outputState: "ObjectWrite",
      outputVersion: toNullableString(entry.version ?? entry.reference?.version),
      outputDigest: entry.reference?.digest ?? entry.digest ?? null,
      outputOwner: normalizeWalrusOwner(entry.owner),
      idOperation: "None",
    });
  }

  return changedObjects;
}

function buildChangedObjects(response: any): WalrusChangedObject[] {
  const fromObjectChanges = buildChangedObjectsFromObjectChanges(response);
  if (fromObjectChanges.length > 0) {
    return fromObjectChanges;
  }
  return buildChangedObjectsFromEffects(response?.effects);
}

/** 
 * Upload to Walrus using SDK (will trigger wallet transaction popup)
 */
export async function uploadToWalrusWithSDK(
  encryptedData: string,
  signer: Signer,
  epochs: number = DEFAULT_EPOCHS
): Promise<{
  blobId: string;
  walrusUrl: string;
  suiRef: string | null;
}> {
  if (epochs < 1 || epochs > 100) {
    throw new Error("Invalid storage duration");
  }

  try {
    console.log("[Walrus SDK] Creating client...");
    const client = createWalrusClient();
    
    const blob = new TextEncoder().encode(encryptedData);
    console.log("[Walrus SDK] Data size:", blob.length, "bytes");
    console.log("[Walrus SDK] Epochs:", epochs);
    console.log("[Walrus SDK] Calling writeBlob - THIS WILL TRIGGER WALLET POPUP");
    console.log("[Walrus SDK] Client type:", typeof client);
    console.log("[Walrus SDK] Client has walrus:", 'walrus' in client);
    
    // The walrus extension adds methods to client.walrus
    if (!('walrus' in client) || !(client as any).walrus) {
      throw new Error("Walrus client not properly initialized. Check client setup.");
    }
    
    const result = await (client as any).walrus.writeBlob({
      blob,
      deletable: false,
      epochs,
      signer,
    });
    
    console.log("[Walrus SDK] WriteBlob result:", result);
    console.log("[Walrus SDK] WriteBlob result keys:", Object.keys(result || {}));
    console.log("[Walrus SDK] WriteBlob result type:", typeof result);
    console.log("[Walrus SDK] WriteBlob result.digest:", result?.digest);
    console.log("[Walrus SDK] WriteBlob result.effects:", result?.effects);
    console.log("[Walrus SDK] WriteBlob result.events:", result?.events);
    
    // walrus SDK's writeBlob may return the transaction result first
    // We need to extract blobId from the transaction effects/events
    let blobId: string | undefined = result?.blobId;
    let suiRef: string | null = result?.objectId || result?.blobObject?.id || null;
    
    // If blobId is not directly in result, try to extract from transaction effects/events
    if (!blobId) {
      console.log("[Walrus SDK] BlobId not in result, extracting from transaction effects/events...");
      console.log("[Walrus SDK] Transaction digest:", result.digest);
      
      // Try to get blobId from effects or events
      if (result.effects) {
        console.log("[Walrus SDK] Effects:", result.effects);
        console.log("[Walrus SDK] Effects type:", typeof result.effects);
        console.log("[Walrus SDK] Effects isArray:", Array.isArray(result.effects));
        
        // executeTransactionBlock returns effects as an object with created/mutated arrays
        if (result.effects && typeof result.effects === 'object' && !Array.isArray(result.effects)) {
          // Check effects.created (array of created objects)
          if (result.effects.created && Array.isArray(result.effects.created)) {
            for (const created of result.effects.created) {
              if (created.reference?.objectId) {
                suiRef = created.reference.objectId;
                console.log("[Walrus SDK] Found Sui object ID from effects.created:", suiRef);
              }
            }
          }
          // Check effects.mutated (array of mutated objects)
          if (result.effects.mutated && Array.isArray(result.effects.mutated)) {
            for (const mutated of result.effects.mutated) {
              if (mutated.reference?.objectId) {
                suiRef = mutated.reference.objectId;
                console.log("[Walrus SDK] Found Sui object ID from effects.mutated:", suiRef);
              }
            }
          }
        }
      }
      
      // Try to get blobId from events
      if (result.events && Array.isArray(result.events)) {
        console.log("[Walrus SDK] Events:", result.events);
        console.log("[Walrus SDK] Events count:", result.events.length);
        for (const event of result.events) {
          console.log("[Walrus SDK] Event type:", event.type);
          console.log("[Walrus SDK] Event parsedJson:", event.parsedJson);
          console.log("[Walrus SDK] Event full object:", JSON.stringify(event, null, 2));
          
          // Look for blob creation events - check various event types
          if (event.parsedJson) {
            const parsed = event.parsedJson;
            console.log("[Walrus SDK] Parsed JSON keys:", Object.keys(parsed));
            // Try different possible field names
            if (parsed.blob_id || parsed.blobId || parsed.id || parsed.blob_id_hash || parsed.blob_hash) {
              blobId = parsed.blob_id || parsed.blobId || parsed.id || parsed.blob_id_hash || parsed.blob_hash;
              console.log("[Walrus SDK] ✅ Found blobId from event.parsedJson:", blobId);
              break;
            }
          }
          
          // Check event.bcs (base64 encoded data)
          if ((event as any).bcs) {
            console.log("[Walrus SDK] Event has bcs field:", (event as any).bcs);
          }
          
          // Also check event.type for blob-related types
          if (event.type && (event.type.includes('Blob') || event.type.includes('blob') || event.type.includes('walrus'))) {
            console.log("[Walrus SDK] Event type contains 'blob' or 'walrus'");
            // Try to extract from the event object itself
            if ((event as any).blob_id || (event as any).blobId) {
              blobId = (event as any).blob_id || (event as any).blobId;
              console.log("[Walrus SDK] ✅ Found blobId from event object:", blobId);
              break;
            }
            // Also check parsedJson again for blob-related events
            if (event.parsedJson) {
              const parsed = event.parsedJson as any;
              if (parsed.blob_id || parsed.blobId || parsed.id) {
                blobId = parsed.blob_id || parsed.blobId || parsed.id;
                console.log("[Walrus SDK] ✅ Found blobId from blob-related event:", blobId);
                break;
              }
            }
          }
        }
      }
    }
    
    // If still no blobId and digest is valid, try to query the transaction to get the blobId
    // Skip querying if digest is invalid (coin type)
    if (!blobId && result?.digest && typeof result.digest === 'string' && !result.digest.includes('::')) {
      // Validate digest format before querying
      const digest = result.digest;
      if (digest.length >= 20) {
        try {
          console.log("[Walrus SDK] Querying transaction to get blobId...");
          console.log("[Walrus SDK] Using digest:", digest);
          const txDetails = await client.getTransactionBlock({
            digest: digest,
            options: {
              showEffects: true,
              showEvents: true,
              showInput: false,
            },
          });
          
          console.log("[Walrus SDK] Transaction details:", txDetails);
          console.log("[Walrus SDK] Transaction events:", txDetails.events);
          
          // Extract blobId from transaction events
          if (txDetails.events && Array.isArray(txDetails.events)) {
            for (const event of txDetails.events) {
              console.log("[Walrus SDK] Query event type:", event.type);
              console.log("[Walrus SDK] Query event parsedJson:", event.parsedJson);
              if (event.type && event.parsedJson) {
                const parsed = event.parsedJson;
                if (parsed.blob_id || parsed.blobId || parsed.id || parsed.blob_hash) {
                  blobId = parsed.blob_id || parsed.blobId || parsed.id || parsed.blob_hash;
                  console.log("[Walrus SDK] ✅ Found blobId from queried transaction events:", blobId);
                  break;
                }
              }
            }
          }
        } catch (queryError) {
          console.warn("[Walrus SDK] Failed to query transaction:", queryError);
          console.warn("[Walrus SDK] Query error details:", queryError instanceof Error ? queryError.message : String(queryError));
        }
      } else {
        console.warn("[Walrus SDK] Invalid digest format, cannot query transaction:", digest);
      }
    }
    
    // If blobId is still not found but transaction succeeded, try to query the transaction
    if (!blobId && result?.digest && typeof result.digest === 'string' && result.digest.length >= 20 && !result.digest.includes('::')) {
      console.log("[Walrus SDK] BlobId not found in result, but transaction succeeded. Querying transaction...");
      try {
        const txDetails = await client.getTransactionBlock({
          digest: result.digest,
          options: {
            showEffects: true,
            showEvents: true,
            showInput: false,
          },
        });
        
        // Extract blobId from queried transaction events
        if (txDetails.events && Array.isArray(txDetails.events)) {
          for (const event of txDetails.events) {
            if (event.type && event.parsedJson) {
              const parsed = event.parsedJson;
              if (parsed.blob_id || parsed.blobId || parsed.id || parsed.blob_hash) {
                blobId = parsed.blob_id || parsed.blobId || parsed.id || parsed.blob_hash;
                console.log("[Walrus SDK] ✅ Found blobId from queried transaction events:", blobId);
                break;
              }
            }
          }
        }
      } catch (queryError) {
        console.warn("[Walrus SDK] Failed to query transaction:", queryError);
      }
    }
    
    // Only throw error if transaction failed or blobId is still missing after all attempts
    if (!blobId) {
      // Check if transaction actually succeeded
      if (result?.digest && typeof result.digest === 'string' && result.digest.length >= 20 && !result.digest.includes('::')) {
        console.warn("[Walrus SDK] Transaction succeeded but blobId could not be extracted. This may be a temporary issue.");
        console.warn("[Walrus SDK] Transaction digest:", result.digest);
        // Don't throw error if transaction succeeded - let the caller handle it
        // Return a placeholder blobId based on the transaction digest
        blobId = `pending_${result.digest.slice(0, 16)}`;
        console.warn("[Walrus SDK] Using placeholder blobId:", blobId);
      } else {
        console.error("[Walrus SDK] Transaction failed or invalid result:", result);
        throw new Error("上傳失敗：交易執行失敗或結果無效");
      }
    }
    
    // Only validate blobId if it's not a placeholder
    if (!blobId.startsWith('pending_') && !isValidBlobId(blobId)) {
      throw new Error(`Received invalid blob ID from storage service: ${blobId}`);
    }

    console.log("[Walrus SDK] Extracted values:", { blobId, suiRef });

    return {
      blobId,
      walrusUrl: getWalrusUrl(blobId),
      suiRef,
    };
  } catch (error: any) {
    console.error("[Walrus SDK] Upload error:", error);
    
    const errorMsg = error?.message || String(error);
    
    if (errorMsg.includes("insufficient") || errorMsg.includes("balance") || errorMsg.includes("not enough")) {
      throw new Error("餘額不足。請確保你有足夠的 SUI 和 WAL 測試網代幣。");
    } else if (errorMsg.includes("signature") || errorMsg.includes("sign")) {
      throw new Error("錢包簽名失敗。請重試。");
    } else if (errorMsg.includes("user rejected") || errorMsg.includes("user cancelled")) {
      throw new Error("交易已取消。");
    }
    
    throw new Error(`上傳失敗: ${errorMsg}`);
  }
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
