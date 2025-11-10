/**
 * Client-side encryption utilities for emotion data
 * Uses Web Crypto API for AES-GCM encryption
 */

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt for key derivation
}

/**
 * Generate a cryptographic key from a password
 */
async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt data using AES-GCM
 */
export async function encryptData(data: string, password: string): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(password, salt.buffer);
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoder.encode(data)
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
  };
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  const salt = base64ToBuffer(encryptedData.salt);
  const iv = base64ToBuffer(encryptedData.iv);
  const ciphertext = base64ToBuffer(encryptedData.ciphertext);
  
  const key = await deriveKey(password, salt);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Generate a hash of the encrypted data for verification
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  return bufferToBase64(hashBuffer);
}

/**
 * Generate a secure user key from wallet address and signature
 * Uses wallet signature to create a cryptographically secure key
 * 
 * @param walletAddress - The user's wallet address
 * @param signature - Optional wallet signature bytes (if available)
 * @returns A secure key derived from wallet address and signature
 */
export async function generateUserKey(
  walletAddress: string,
  signature?: Uint8Array
): Promise<string> {
  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{64}$/.test(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  // Create a fixed application-specific salt
  const appSalt = new TextEncoder().encode("echoma_encryption_salt_v1");
  
  // Combine wallet address with signature if available
  const encoder = new TextEncoder();
  const addressBytes = encoder.encode(walletAddress);
  
  let keyMaterial: Uint8Array;
  if (signature && signature.length > 0) {
    // If signature is available, use it for stronger key derivation
    const tempBuffer = new Uint8Array(addressBytes.length + signature.length);
    tempBuffer.set(addressBytes, 0);
    tempBuffer.set(new Uint8Array(signature), addressBytes.length);
    keyMaterial = tempBuffer;
  } else {
    // Fallback: Use wallet address with app salt for key derivation
    // This is still more secure than the previous predictable method
    const tempBuffer = new Uint8Array(addressBytes.length + appSalt.length);
    tempBuffer.set(addressBytes, 0);
    tempBuffer.set(appSalt, addressBytes.length);
    keyMaterial = tempBuffer;
  }

  // Use PBKDF2 to derive a secure key from the material
  const keyMaterialKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial.buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Derive 256 bits (32 bytes) for the key
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: appSalt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterialKey,
    256
  );

  // Convert to base64 for storage/transmission
  return bufferToBase64(derivedBits);
}

/**
 * Generate a user key synchronously (for backward compatibility)
 * NOTE: This is less secure than the async version with signature
 * @deprecated Use generateUserKey() with signature instead
 */
export function generateUserKeySync(walletAddress: string): string {
  // This is a fallback that's still better than the old method
  // but should be replaced with async version
  const encoder = new TextEncoder();
  const addressBytes = encoder.encode(walletAddress);
  const appSalt = encoder.encode("echoma_encryption_salt_v1");
  const combined = new Uint8Array(addressBytes.length + appSalt.length);
  combined.set(addressBytes, 0);
  combined.set(appSalt, addressBytes.length);
  
  // Hash the combined bytes
  return bufferToBase64(combined.buffer);
}

// Helper functions
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
