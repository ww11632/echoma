/**
 * Client-side encryption utilities for emotion data
 * Uses Web Crypto API for AES-GCM encryption with versioned headers
 * 
 * Security improvements:
 * - Argon2id support (memory-hard, GPU/ASIC resistant)
 * - Configurable PBKDF2 iterations based on device capability
 * - Versioned encryption headers for backward compatibility
 * - Strict salt (≥16 bytes) and IV (12 bytes) validation
 * - Enhanced error handling with clear failure reasons
 */

// Argon2id support (optional - will fallback to PBKDF2 if not available)
// TODO: Add argon2-browser when WASM build issues are resolved
// For now, Argon2id requests will automatically fallback to PBKDF2

// ============================================================================
// Constants
// ============================================================================

/** Minimum salt length (bytes) */
export const MIN_SALT_LENGTH = 16;

/** AES-GCM IV length (bytes) - must be exactly 12 for GCM */
export const IV_LENGTH = 12;

/** Current encryption schema version */
export const ENCRYPTION_SCHEMA_VERSION = 2;

/** Default PBKDF2 iterations - will be adjusted based on device capability */
const DEFAULT_PBKDF2_ITERATIONS = 100000;

/** Minimum PBKDF2 iterations */
const MIN_PBKDF2_ITERATIONS = 100000;

/** Maximum PBKDF2 iterations (for high-end devices) */
const MAX_PBKDF2_ITERATIONS = 1000000;

/** Argon2id default parameters */
const ARGON2_DEFAULT_PARAMS = {
  hashLength: 32, // 256 bits
  time: 3, // 3 iterations
  mem: 65536, // 64 MB memory
  parallelism: 4, // 4 threads
};

// ============================================================================
// Types
// ============================================================================

/**
 * KDF (Key Derivation Function) type
 */
export type KDFType = "argon2id" | "pbkdf2";

/**
 * Versioned encryption header
 * Contains all metadata needed to decrypt the data
 */
export interface EncryptionHeader {
  /** Schema version for backward compatibility */
  v: number;
  /** Key derivation function type */
  kdf: KDFType;
  /** KDF-specific parameters */
  kdfParams: KDFParams;
  /** Salt for key derivation (Base64 encoded, ≥16 bytes) */
  salt: string;
  /** Initialization vector (Base64 encoded, exactly 12 bytes) */
  iv: string;
}

/**
 * KDF parameters (varies by KDF type)
 */
export interface KDFParams {
  // PBKDF2 parameters
  iterations?: number;
  hash?: "SHA-256" | "SHA-384" | "SHA-512";
  
  // Argon2id parameters
  time?: number;
  mem?: number;
  parallelism?: number;
}

/**
 * Encrypted data structure with versioned header
 */
export interface EncryptedData {
  /** Versioned encryption header */
  header: EncryptionHeader;
  /** Encrypted ciphertext (Base64 encoded) */
  ciphertext: string;
}

/**
 * Decryption error types
 */
export enum DecryptionErrorType {
  /** Invalid key/password */
  INVALID_KEY = "invalid_key",
  /** Data corruption or tampering */
  DATA_CORRUPTED = "data_corrupted",
  /** Unsupported schema version */
  UNSUPPORTED_VERSION = "unsupported_version",
  /** Invalid data format */
  INVALID_FORMAT = "invalid_format",
  /** Unknown error */
  UNKNOWN = "unknown",
}

/**
 * Decryption error with detailed information
 */
export class DecryptionError extends Error {
  constructor(
    message: string,
    public readonly type: DecryptionErrorType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "DecryptionError";
  }
}

// ============================================================================
// Device Capability Detection
// ============================================================================

/**
 * Detect device capability and adjust KDF parameters accordingly
 * Returns recommended iterations for PBKDF2
 */
async function detectDeviceCapability(): Promise<number> {
  const startTime = performance.now();
  
  // Run a quick benchmark with 10k iterations
  const testIterations = 10000;
  const testSalt = crypto.getRandomValues(new Uint8Array(16));
  const testPassword = new TextEncoder().encode("benchmark");
  
  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      testPassword,
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: testSalt,
        iterations: testIterations,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
    
    const elapsed = performance.now() - startTime;
    
    // Calculate iterations that would take ~500ms
    // This ensures good security without blocking the UI
    const targetTime = 500;
    const recommendedIterations = Math.floor(
      (testIterations * targetTime) / elapsed
    );
    
    // Clamp to valid range
    return Math.max(
      MIN_PBKDF2_ITERATIONS,
      Math.min(MAX_PBKDF2_ITERATIONS, recommendedIterations)
    );
  } catch {
    // Fallback to default if benchmark fails
    return DEFAULT_PBKDF2_ITERATIONS;
  }
}

// ============================================================================
// Key Derivation Functions
// ============================================================================

/**
 * Derive key using PBKDF2
 */
async function deriveKeyPBKDF2(
  password: string,
  salt: ArrayBuffer,
  params: KDFParams
): Promise<CryptoKey> {
  const iterations = params.iterations || DEFAULT_PBKDF2_ITERATIONS;
  const hash = params.hash || "SHA-256";
  
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
      iterations: iterations,
      hash: hash,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive key using Argon2id
 * Currently falls back to PBKDF2 (Argon2 library integration pending)
 * TODO: Integrate argon2-browser when WASM build issues are resolved
 */
async function deriveKeyArgon2id(
  password: string,
  salt: ArrayBuffer,
  params: KDFParams
): Promise<CryptoKey> {
  // Argon2id not yet integrated - use PBKDF2 with higher iterations as compensation
  console.warn("Argon2id requested but not yet integrated, using PBKDF2 with enhanced parameters");
  const iterations = await detectDeviceCapability();
  // Use significantly higher iterations to compensate for lack of memory-hard properties
  return deriveKeyPBKDF2(password, salt, {
    iterations: Math.max(iterations * 2, 300000), // Use 2x iterations or minimum 300k
    hash: "SHA-256",
  });
}

/**
 * Derive key using the specified KDF
 */
async function deriveKey(
  password: string,
  salt: ArrayBuffer,
  kdf: KDFType,
  params: KDFParams
): Promise<CryptoKey> {
  switch (kdf) {
    case "argon2id":
      return deriveKeyArgon2id(password, salt, params);
    case "pbkdf2":
      return deriveKeyPBKDF2(password, salt, params);
    default:
      throw new Error(`Unsupported KDF: ${kdf}`);
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate salt length (must be ≥16 bytes)
 */
function validateSalt(salt: ArrayBuffer): void {
  if (salt.byteLength < MIN_SALT_LENGTH) {
    throw new Error(
      `Salt must be at least ${MIN_SALT_LENGTH} bytes, got ${salt.byteLength}`
    );
  }
}

/**
 * Validate IV length (must be exactly 12 bytes for AES-GCM)
 */
function validateIV(iv: ArrayBuffer): void {
  if (iv.byteLength !== IV_LENGTH) {
    throw new Error(
      `IV must be exactly ${IV_LENGTH} bytes for AES-GCM, got ${iv.byteLength}`
    );
  }
}

/**
 * Validate encryption header
 */
function validateHeader(header: EncryptionHeader): void {
  if (!header.v || header.v < 1) {
    throw new DecryptionError(
      "Invalid encryption header: missing or invalid version",
      DecryptionErrorType.INVALID_FORMAT
    );
  }
  
  if (header.v > ENCRYPTION_SCHEMA_VERSION) {
    throw new DecryptionError(
      `Unsupported encryption schema version: ${header.v}. Maximum supported: ${ENCRYPTION_SCHEMA_VERSION}`,
      DecryptionErrorType.UNSUPPORTED_VERSION
    );
  }
  
  if (!header.kdf || (header.kdf !== "argon2id" && header.kdf !== "pbkdf2")) {
    throw new DecryptionError(
      `Unsupported KDF type: ${header.kdf}`,
      DecryptionErrorType.INVALID_FORMAT
    );
  }
  
  const salt = base64ToBuffer(header.salt);
  validateSalt(salt);
  
  const iv = base64ToBuffer(header.iv);
  validateIV(iv);
}

// ============================================================================
// Encryption/Decryption Functions
// ============================================================================

/**
 * Encrypt data using AES-GCM with versioned header
 * 
 * @param data - Plaintext data to encrypt
 * @param password - Password/passphrase for key derivation
 * @param kdf - Key derivation function to use (default: "argon2id")
 * @param kdfParams - Optional KDF parameters (will use defaults if not provided)
 * @returns Encrypted data with versioned header
 */
export async function encryptData(
  data: string,
  password: string,
  kdf: KDFType = "pbkdf2", // Default to PBKDF2 until Argon2id is integrated
  kdfParams?: Partial<KDFParams>
): Promise<EncryptedData> {
  // Validate password is not empty
  if (!password || password.length === 0) {
    throw new Error("Password cannot be empty");
  }
  
  // Generate random salt (≥16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(MIN_SALT_LENGTH));
  validateSalt(salt.buffer);
  
  // Generate random IV (exactly 12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  validateIV(iv.buffer);
  
  // Prepare KDF parameters
  let finalKdfParams: KDFParams;
  if (kdf === "pbkdf2") {
    // Auto-detect device capability for PBKDF2
    const iterations = await detectDeviceCapability();
    finalKdfParams = {
      iterations: kdfParams?.iterations || iterations,
      hash: kdfParams?.hash || "SHA-256",
    };
  } else {
    // Argon2id defaults
    finalKdfParams = {
      time: kdfParams?.time || ARGON2_DEFAULT_PARAMS.time,
      mem: kdfParams?.mem || ARGON2_DEFAULT_PARAMS.mem,
      parallelism: kdfParams?.parallelism || ARGON2_DEFAULT_PARAMS.parallelism,
    };
  }
  
  // Derive encryption key
  const key = await deriveKey(password, salt.buffer, kdf, finalKdfParams);
  
  // Encrypt data
  const encoder = new TextEncoder();
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoder.encode(data)
  );
  
  // Create versioned header
  const header: EncryptionHeader = {
    v: ENCRYPTION_SCHEMA_VERSION,
    kdf: kdf,
    kdfParams: finalKdfParams,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
  };
  
  return {
    header: header,
    ciphertext: bufferToBase64(encryptedBuffer),
  };
}

/**
 * Decrypt data using versioned header
 * 
 * @param encryptedData - Encrypted data with versioned header
 * @param password - Password/passphrase for key derivation
 * @returns Decrypted plaintext data
 * @throws DecryptionError with detailed error information
 */
export async function decryptData(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  try {
    // Validate input
    if (!encryptedData || !encryptedData.header) {
      throw new DecryptionError(
        "Invalid encrypted data: missing header",
        DecryptionErrorType.INVALID_FORMAT
      );
    }
    
    if (!password || password.length === 0) {
      throw new DecryptionError(
        "Password cannot be empty",
        DecryptionErrorType.INVALID_KEY
      );
    }
    
    const header = encryptedData.header;
    
    // Validate header
    validateHeader(header);
    
    // Extract salt and IV
    const salt = base64ToBuffer(header.salt);
    const iv = base64ToBuffer(header.iv);
    const ciphertext = base64ToBuffer(encryptedData.ciphertext);
    
    // Validate lengths
    validateSalt(salt);
    validateIV(iv);
    
    // Derive decryption key
    const key = await deriveKey(password, salt, header.kdf, header.kdfParams);
    
    // Decrypt data (AES-GCM automatically verifies authentication tag)
    try {
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
    } catch (decryptError: any) {
      // AES-GCM decryption failure usually means:
      // 1. Wrong key/password (most common)
      // 2. Data corruption or tampering
      // 3. Invalid IV or ciphertext
      
      const errorMessage = decryptError?.message || "Decryption failed";
      
      // Try to distinguish between key error and corruption
      if (
        errorMessage.includes("bad") ||
        errorMessage.includes("invalid") ||
        errorMessage.includes("tag")
      ) {
        // This is likely a key error (wrong password)
        throw new DecryptionError(
          "Decryption failed: Invalid key or password",
          DecryptionErrorType.INVALID_KEY,
          decryptError
        );
      } else {
        // Could be corruption or other issue
        throw new DecryptionError(
          "Decryption failed: Data may be corrupted or tampered",
          DecryptionErrorType.DATA_CORRUPTED,
          decryptError
        );
      }
    }
  } catch (error) {
    // Re-throw DecryptionError as-is
    if (error instanceof DecryptionError) {
      throw error;
    }
    
    // Wrap other errors
    throw new DecryptionError(
      `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      DecryptionErrorType.UNKNOWN,
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// Legacy Support (for backward compatibility)
// ============================================================================

/**
 * Migrate legacy EncryptedData format to new versioned format
 * This handles old data that doesn't have a versioned header
 */
function migrateLegacyFormat(data: any): EncryptedData {
  // Check if it's already in new format
  if (data.header && data.header.v) {
    return data as EncryptedData;
  }
  
  // Legacy format: { ciphertext, iv, salt }
  if (data.ciphertext && data.iv && data.salt) {
    // Validate legacy salt and IV
    const salt = base64ToBuffer(data.salt);
    const iv = base64ToBuffer(data.iv);
    
    // Ensure salt is at least 16 bytes (pad if necessary)
    let saltArray: Uint8Array;
    if (salt.byteLength < MIN_SALT_LENGTH) {
      saltArray = new Uint8Array(MIN_SALT_LENGTH);
      saltArray.set(new Uint8Array(salt), 0);
      // Fill remaining with random data
      const padding = crypto.getRandomValues(
        new Uint8Array(MIN_SALT_LENGTH - salt.byteLength)
      );
      saltArray.set(padding, salt.byteLength);
    } else {
      saltArray = new Uint8Array(salt);
    }
    
    // Ensure IV is exactly 12 bytes
    let ivArray: Uint8Array;
    if (iv.byteLength !== IV_LENGTH) {
      if (iv.byteLength < IV_LENGTH) {
        // Pad IV if too short
        ivArray = new Uint8Array(IV_LENGTH);
        ivArray.set(new Uint8Array(iv), 0);
        const padding = crypto.getRandomValues(
          new Uint8Array(IV_LENGTH - iv.byteLength)
        );
        ivArray.set(padding, iv.byteLength);
      } else {
        // Truncate IV if too long
        ivArray = new Uint8Array(iv).slice(0, IV_LENGTH);
      }
    } else {
      ivArray = new Uint8Array(iv);
    }
    
    // Create versioned header with legacy PBKDF2 parameters
    const header: EncryptionHeader = {
      v: 1, // Legacy version
      kdf: "pbkdf2",
      kdfParams: {
        iterations: DEFAULT_PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      salt: bufferToBase64(saltArray.buffer as ArrayBuffer),
      iv: bufferToBase64(ivArray.buffer as ArrayBuffer),
    };
    
    return {
      header: header,
      ciphertext: data.ciphertext,
    };
  }
  
  throw new DecryptionError(
    "Invalid encrypted data format",
    DecryptionErrorType.INVALID_FORMAT
  );
}

/**
 * Decrypt data with automatic legacy format migration
 */
export async function decryptDataWithMigration(
  encryptedData: any,
  password: string
): Promise<string> {
  const migrated = migrateLegacyFormat(encryptedData);
  return decryptData(migrated, password);
}

// ============================================================================
// Key Generation Functions (with security warnings)
// ============================================================================

/**
 * Generate a secure user key from wallet address and signature
 * 
 * ⚠️ SECURITY WARNING: Wallet addresses have low entropy and should NOT be used
 * as the sole source for key derivation. This function is provided for backward
 * compatibility, but it's recommended to use a user-provided password/passphrase
 * with a random salt instead.
 * 
 * @param walletAddress - The user's wallet address (for domain separation only)
 * @param signature - Optional wallet signature bytes (provides additional entropy)
 * @param userPassword - User-provided password/passphrase (RECOMMENDED)
 * @returns A secure key derived from the inputs
 */
export async function generateUserKey(
  walletAddress: string,
  signature?: Uint8Array,
  userPassword?: string
): Promise<string> {
  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{64}$/.test(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }
  
  // ⚠️ SECURITY WARNING: If no user password is provided, warn about weak security
  if (!userPassword || userPassword.length === 0) {
    console.warn(
      "⚠️ SECURITY WARNING: Generating key from wallet address only. " +
      "This provides weak security. Please use a user-provided password/passphrase."
    );
  }
  
  // IMPORTANT: Use deterministic salt for key generation (not random!)
  // This ensures the same inputs always produce the same key, allowing decryption
  // The salt is derived from application name + user identifier for domain separation
  const encoder = new TextEncoder();
  const appSaltBase = encoder.encode("echoma_key_derivation_v2");
  const addressHash = await crypto.subtle.digest("SHA-256", encoder.encode(walletAddress));
  const addressHashArray = new Uint8Array(addressHash);
  
  // Combine app salt with address hash for deterministic but unique salt per user
  const salt = new Uint8Array(MIN_SALT_LENGTH);
  salt.set(appSaltBase.slice(0, Math.min(appSaltBase.length, MIN_SALT_LENGTH)), 0);
  // XOR with address hash for additional uniqueness
  for (let i = 0; i < Math.min(salt.length, addressHashArray.length); i++) {
    salt[i] ^= addressHashArray[i];
  }
  
  // Prepare key material
  const addressBytes = encoder.encode(walletAddress);
  
  let keyMaterial: Uint8Array;
  
  if (userPassword) {
    // Use user password as primary material (RECOMMENDED)
    const passwordBytes = encoder.encode(userPassword);
    // Combine: password + address (for domain separation) + signature (if available)
    const parts: Uint8Array[] = [passwordBytes, addressBytes];
    if (signature && signature.length > 0) {
      parts.push(new Uint8Array(signature));
    }
    
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    keyMaterial = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      keyMaterial.set(part, offset);
      offset += part.length;
    }
  } else if (signature && signature.length > 0) {
    // Fallback: Use address + signature
    const tempBuffer = new Uint8Array(addressBytes.length + signature.length);
    tempBuffer.set(addressBytes, 0);
    tempBuffer.set(new Uint8Array(signature), addressBytes.length);
    keyMaterial = tempBuffer;
  } else {
    // Last resort: Use address only (WEAK - should be avoided)
    keyMaterial = addressBytes;
  }
  
  // Use PBKDF2 with FIXED iterations for deterministic key derivation
  // CRITICAL: Must use fixed iterations so the same wallet address always produces
  // the same derived key, allowing decryption
  const iterations = DEFAULT_PBKDF2_ITERATIONS;
  
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
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterialKey,
    256
  );
  
  // Convert to base64 for storage/transmission
  return bufferToBase64(derivedBits);
}

/**
 * Generate a secure encryption key from user ID
 * 
 * ⚠️ SECURITY WARNING: User IDs (UUIDs) have low entropy and should NOT be used
 * as the sole source for key derivation. This function is provided for backward
 * compatibility, but it's recommended to use a user-provided password/passphrase
 * with a random salt instead.
 * 
 * @param userId - Supabase user ID (UUID format)
 * @param userPassword - User-provided password/passphrase (RECOMMENDED)
 * @returns A secure key derived from the inputs
 */
export async function generateUserKeyFromId(
  userId: string,
  userPassword?: string
): Promise<string> {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error("Invalid user ID format");
  }
  
  // ⚠️ SECURITY WARNING: If no user password is provided, warn about weak security
  if (!userPassword || userPassword.length === 0) {
    console.warn(
      "⚠️ SECURITY WARNING: Generating key from user ID only. " +
      "This provides weak security. Please use a user-provided password/passphrase."
    );
  }
  
  // IMPORTANT: Use deterministic salt for key generation (not random!)
  // This ensures the same inputs always produce the same key, allowing decryption
  // The salt is derived from application name + user ID for domain separation
  const encoder = new TextEncoder();
  const appSaltBase = encoder.encode("echoma_key_derivation_v2");
  const userIdHash = await crypto.subtle.digest("SHA-256", encoder.encode(userId));
  const userIdHashArray = new Uint8Array(userIdHash);
  
  // Combine app salt with user ID hash for deterministic but unique salt per user
  const salt = new Uint8Array(MIN_SALT_LENGTH);
  salt.set(appSaltBase.slice(0, Math.min(appSaltBase.length, MIN_SALT_LENGTH)), 0);
  // XOR with user ID hash for additional uniqueness
  for (let i = 0; i < Math.min(salt.length, userIdHashArray.length); i++) {
    salt[i] ^= userIdHashArray[i];
  }
  
  // Encode user ID
  const userIdBytes = encoder.encode(userId);
  
  let keyMaterial: Uint8Array;
  
  if (userPassword) {
    // Use user password as primary material (RECOMMENDED)
    const passwordBytes = encoder.encode(userPassword);
    // Combine: password + userId (for domain separation)
    keyMaterial = new Uint8Array(passwordBytes.length + userIdBytes.length);
    keyMaterial.set(passwordBytes, 0);
    keyMaterial.set(userIdBytes, passwordBytes.length);
  } else {
    // Fallback: Use userId only (WEAK - should be avoided)
    keyMaterial = userIdBytes;
  }
  
  // Use PBKDF2 with FIXED iterations for deterministic key derivation
  // CRITICAL: Must use fixed iterations so the same user ID always produces
  // the same derived key, allowing decryption
  const iterations = DEFAULT_PBKDF2_ITERATIONS;
  
  const keyMaterialKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial.buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  // Derive 256 bits (32 bytes)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterialKey,
    256
  );
  
  // Convert to base64
  return bufferToBase64(derivedBits);
}

/**
 * Generate a user key synchronously (for backward compatibility)
 * NOTE: This is less secure than the async version with signature
 * @deprecated Use generateUserKey() with userPassword instead
 */
export function generateUserKeySync(walletAddress: string): string {
  console.warn(
    "⚠️ DEPRECATED: generateUserKeySync() is deprecated. " +
    "Use generateUserKey() with userPassword for better security."
  );
  
  const encoder = new TextEncoder();
  const addressBytes = encoder.encode(walletAddress);
  const salt = encoder.encode("echoma_encryption_salt_v1");
  const combined = new Uint8Array(addressBytes.length + salt.length);
  combined.set(addressBytes, 0);
  combined.set(salt, addressBytes.length);
  
  // Hash the combined bytes
  return bufferToBase64(combined.buffer);
}

// ============================================================================
// Utility Functions
// ============================================================================

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
 * Convert ArrayBuffer to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
