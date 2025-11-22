# Encryption Mechanism Guide

## Overview

This application uses **client-side encryption** to protect user emotion records. All sensitive data is encrypted before leaving the user's device.

## Encryption Flow

### 1. Encryption Algorithm

Uses **AES-GCM 256-bit encryption**:
- **Algorithm**: AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)
- **Key length**: 256 bits (32 bytes)
- **Mode**: GCM mode provides encryption and authentication

### 2. Key Generation

#### Method A: With Wallet Address (Using Argon2id)
```typescript
// Use Argon2id to derive key from wallet address (auto fallback to PBKDF2)
const userKey = await generateUserKey(walletAddress, signature, userPassword);
```

**Process**:
1. Use wallet address as base material
2. Use application-specific salt: `"echoma_key_derivation_v3_argon2"`
3. **Prioritize Argon2id** for key derivation (memory-hard, resistant to ASIC/GPU):
   - Time cost: **3 iterations**
   - Memory cost: **64 MB (65536 KB)**
   - Parallelism: **4 threads**
   - Derive 256-bit key
4. **Automatic Fallback**: If WASM is unavailable, use enhanced PBKDF2:
   - Iterations: **300,000+** (adjusted based on device performance)
   - Hash algorithm: **SHA-256**
   - Derive 256-bit key

#### Method B: Anonymous Users (No Wallet)
```typescript
// Use random UUID as key
const randomKey = crypto.randomUUID();
```

### 3. Encryption Process (Using Argon2id)

```typescript
// 1. Generate random Salt (16 bytes)
const salt = crypto.getRandomValues(new Uint8Array(16));

// 2. Generate random IV (initialization vector, 12 bytes)
const iv = crypto.getRandomValues(new Uint8Array(12));

// 3. Derive encryption key using Argon2id (priority)
const key = await deriveKey(password, salt.buffer, "argon2id");
// Argon2id parameters:
// - Time cost: 3 iterations
// - Memory cost: 64 MB (65536 KB)
// - Parallelism: 4 threads
// - Output: AES-256 key (256 bits)
//
// If WASM is unavailable, auto fallback to enhanced PBKDF2:
// - Iterations: 300,000+
// - Hash: SHA-256
// - Output: AES-256 key

// 4. Encrypt data using AES-GCM
const encryptedBuffer = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv: iv,
    tagLength: 128, // 128 bits authentication tag
  },
  key,
  encoder.encode(data)
);

// 5. Return encrypted result (versioned structure)
return {
  header: {
    v: 2,                  // Encryption schema version
    kdf: "argon2id",       // KDF type used
    kdfParams: {           // KDF parameters
      time: 3,
      mem: 65536,
      parallelism: 4
    },
    salt: bufferToBase64(salt.buffer),  // Salt value
    iv: bufferToBase64(iv.buffer)       // Initialization vector
  },
  ciphertext: bufferToBase64(encryptedBuffer)  // Encrypted data
};
```

### 4. Encrypted Data Structure (Versioned)

```typescript
interface EncryptedData {
  header: EncryptionHeader;  // Versioned encryption header
  ciphertext: string;        // Base64-encoded encrypted data
}

interface EncryptionHeader {
  v: number;                 // Schema version (current: 2)
  kdf: "argon2id" | "pbkdf2"; // Key derivation function type
  kdfParams: KDFParams;      // KDF parameters
  salt: string;              // Base64-encoded salt (≥16 bytes)
  iv: string;                // Base64-encoded initialization vector (12 bytes)
}

interface KDFParams {
  // Argon2id parameters
  time?: number;        // Time cost (iterations)
  mem?: number;         // Memory cost (KB)
  parallelism?: number; // Parallelism
  
  // PBKDF2 parameters
  iterations?: number;  // Iterations
  hash?: string;        // Hash algorithm
}
```

## Security Features

### ✅ Implemented Security Measures

1. **Client-Side Encryption**
   - Data is encrypted before leaving the browser
   - Server cannot see plaintext content

2. **Strong Key Derivation (Argon2id)**
   - Prioritize Argon2id (memory-hard, resistant to ASIC/GPU attacks)
   - Parameters: 3 iterations × 64 MB memory × 4 threads
   - Automatic fallback to enhanced PBKDF2 (300,000+ iterations)
   - Effectively prevents brute-force and rainbow table attacks

3. **Random Salt and IV**
   - Each encryption uses new random values
   - Same content produces different encrypted results

4. **AES-GCM Mode**
   - Provides encryption and authentication
   - Prevents data tampering

### ⚠️ Current Limitations

1. **Server-Side Storage**
   - Server-side also stores unencrypted `description` field
   - This is for display convenience but reduces security
   - **Recommendation**: Server should not store plaintext descriptions

2. **Key Management**
   - Keys are derived from wallet address; if wallet is lost, data cannot be recovered
   - Anonymous users use random keys and cannot access across devices

3. **Local Storage**
   - When API fails, data is saved to localStorage (unencrypted)
   - This is a temporary solution and should not be used long-term

## Data Flow

### Flow When Recording Emotion

```
1. User inputs description
   ↓
2. Client validates and cleans input
   ↓
3. Generate encryption key
   - With wallet: Derive from wallet address
   - Without wallet: Use random UUID
   ↓
4. Encrypt data (AES-GCM)
   - Generate random salt and IV
   - Derive key using PBKDF2
   - Encrypt data
   ↓
5. Send to server
   - encryptedData: JSON.stringify(EncryptedData)
   - description: Plaintext (for display, should be removed)
   ↓
6. Server saves
   - Save encryptedData to Walrus or local file
   - Save description to local file (should be removed)
```

### Flow When Viewing Records

```
1. Get records from server
   ↓
2. Check is_public status
   ↓
3. If public record
   - Display description (plaintext)
   ↓
4. If private record
   - Do not display description
   - Display "Encrypted and saved" message
   - (Future: Requires decryption to view)
```

## Improvement Suggestions

### 1. Remove Server-Side Plaintext Storage
```javascript
// Server should not save description
const record = {
  // ... other fields
  // description,  // ❌ Remove this
  encryptedData,  // ✅ Only save encrypted data
};
```

### 2. Implement Decryption Function
```typescript
// Add decrypt button in Timeline page
async function decryptDescription(record: EmotionRecord) {
  const encryptedData = JSON.parse(record.encryptedData);
  const userKey = await generateUserKey(currentAccount.address);
  const decrypted = await decryptData(encryptedData, userKey);
  return decrypted;
}
```

### 3. Improve Key Management
- Consider using improved versions of key derivation functions (KDF)
- Support key backup and recovery mechanisms
- Support multi-device sync (requires secure key sharing)

## Technical Details

### Key Derivation Function (KDF)

#### Argon2id Parameters (Priority)
- **Algorithm**: Argon2id (memory-hard password hashing function)
- **Time cost**: 3 iterations
- **Memory cost**: 64 MB (65536 KB)
- **Parallelism**: 4 threads
- **Output length**: 256 bits (32 bytes)
- **Advantages**:
  - Memory-hard, resistant to GPU/ASIC attacks
  - Combines advantages of Argon2i and Argon2d
  - Modern KDF recommended by OWASP and NIST
  - Suitable for password storage and key derivation

#### PBKDF2 Parameters (Fallback)
- **Algorithm**: PBKDF2 (Password-Based Key Derivation Function 2)
- **Iterations**: 300,000+ (automatically adjusted based on device performance)
- **Hash function**: SHA-256
- **Output length**: 256 bits
- **Use case**: Automatic fallback when Argon2id WASM is unavailable

### AES-GCM Parameters
- **Algorithm**: AES (Advanced Encryption Standard)
- **Mode**: GCM (Galois/Counter Mode)
- **Key length**: 256 bits
- **IV length**: 12 bytes (96 bits)
- **Authentication tag**: 16 bytes (automatically included in GCM mode)

### Encoding
- **Input/Output**: UTF-8 strings
- **Storage format**: Base64 encoding
- **Transmission format**: JSON strings

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [PBKDF2](https://en.wikipedia.org/wiki/PBKDF2)
