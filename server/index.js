import express from "express";
import cors from "cors";
import { randomUUID, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3001;

// Lazy initialization of Supabase client for JWT verification
let supabaseClient = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

/**
 * Error codes for client-facing error messages
 * Prevents exposure of technical details
 */
const ERROR_CODES = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
};

/**
 * User-friendly error messages mapped to error codes
 */
const ERROR_MESSAGES = {
  [ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred. Please try again later.',
  [ERROR_CODES.STORAGE_ERROR]: 'Failed to save your emotion record. Please try again.',
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Invalid request data. Please check your input.',
  [ERROR_CODES.AUTH_ERROR]: 'Authentication failed. Please sign in again.',
};

/**
 * Determine error code from error object
 * Maps technical errors to safe error codes
 */
function getErrorCode(error) {
  if (!error) {
    return ERROR_CODES.INTERNAL_ERROR;
  }

  const message = error.message || '';
  const lowerMessage = message.toLowerCase();

  // Network-related errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('timeout')
  ) {
    return ERROR_CODES.NETWORK_ERROR;
  }

  // Storage/Walrus errors
  if (
    lowerMessage.includes('walrus') ||
    lowerMessage.includes('storage') ||
    lowerMessage.includes('upload') ||
    lowerMessage.includes('blob')
  ) {
    return ERROR_CODES.STORAGE_ERROR;
  }

  // Validation errors (these are usually safe to show)
  if (
    lowerMessage.includes('required') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('must be')
  ) {
    return ERROR_CODES.VALIDATION_ERROR;
  }

  // Default to internal error for unknown errors
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Create safe error response for client
 * Logs full error details server-side but only returns error code to client
 */
function createErrorResponse(error, statusCode = 500) {
  const errorCode = getErrorCode(error);
  const userMessage = ERROR_MESSAGES[errorCode];

  // Log full error details server-side for debugging
  console.error('[Error Response]', {
    errorCode,
    statusCode,
    originalError: error?.message,
    stack: error?.stack,
    name: error?.name,
  });

  return {
    success: false,
    error: userMessage,
    errorCode,
  };
}

/**
 * Authentication middleware - verifies JWT token from Supabase
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.AUTH_ERROR],
        errorCode: ERROR_CODES.AUTH_ERROR,
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token with Supabase
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('[Auth] Token verification failed:', error?.message);
      return res.status(401).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.AUTH_ERROR],
        errorCode: ERROR_CODES.AUTH_ERROR,
      });
    }
    
    // Attach user to request object for use in route handlers
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth] Unexpected error during authentication:', error);
    const errorResponse = createErrorResponse(error, 500);
    return res.status(500).json(errorResponse);
  }
}

const DATA_DIR = path.join(process.cwd(), "server", "data");
const DATA_FILE = path.join(DATA_DIR, "emotions.json");
const DEFAULT_WALRUS_NETWORK = process.env.WALRUS_NETWORK === "mainnet" ? "mainnet" : "testnet";
const WALRUS_NETWORK_CONFIGS = {
  testnet: {
    publisher: process.env.WALRUS_PUBLISHER_TESTNET_URL || "https://upload-relay.testnet.walrus.space",
    aggregator: process.env.WALRUS_AGGREGATOR_TESTNET_URL || "https://aggregator.testnet.walrus.space",
  },
  mainnet: {
    publisher: process.env.WALRUS_PUBLISHER_MAINNET_URL || "https://upload-relay.mainnet.walrus.space",
    aggregator: process.env.WALRUS_AGGREGATOR_MAINNET_URL || "https://aggregator.mainnet.walrus.space",
  },
};

// Legacy single-network env vars for backward compatibility
if (process.env.WALRUS_PUBLISHER_URL) {
  WALRUS_NETWORK_CONFIGS[DEFAULT_WALRUS_NETWORK].publisher = process.env.WALRUS_PUBLISHER_URL;
}
if (process.env.WALRUS_AGGREGATOR_URL) {
  WALRUS_NETWORK_CONFIGS[DEFAULT_WALRUS_NETWORK].aggregator = process.env.WALRUS_AGGREGATOR_URL;
}

function resolveWalrusNetwork(networkParam) {
  return networkParam === "mainnet" ? "mainnet" : "testnet";
}

function getWalrusConfig(networkParam) {
  const network = resolveWalrusNetwork(networkParam);
  return { ...WALRUS_NETWORK_CONFIGS[network], network };
}

const DEFAULT_WALRUS_CONFIG = getWalrusConfig(DEFAULT_WALRUS_NETWORK);
const DEFAULT_WALRUS_PUBLISHER_URL = DEFAULT_WALRUS_CONFIG.publisher;
const DEFAULT_WALRUS_AGGREGATOR_URL = DEFAULT_WALRUS_CONFIG.aggregator;
const DEFAULT_EPOCHS = Number(process.env.WALRUS_EPOCHS || 200); // 200 epochs (~200 days on testnet)
const WALRUS_ENABLED = process.env.WALRUS_ENABLED !== "false"; // Default to true, can be disabled via env var
const BLOB_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 10; // Maximum requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

// In-memory rate limit store: Map<userId, Array<timestamp>>
const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 * Tracks requests per user and blocks if limit exceeded
 */
function rateLimitMiddleware(req, res, next) {
  // Only apply rate limiting to authenticated routes
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Get or initialize user's request timestamps
  let userRequests = rateLimitStore.get(userId) || [];
  
  // Filter out requests outside the current window
  userRequests = userRequests.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (userRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestRequest = userRequests[0];
    const resetAt = oldestRequest + RATE_LIMIT_WINDOW_MS;
    const retryAfter = Math.ceil((resetAt - now) / 1000);
    
    console.warn(`[Rate Limit] User ${userId} exceeded rate limit. Retry after ${retryAfter}s`);
    
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    });
  }

  // Add current request timestamp
  userRequests.push(now);
  rateLimitStore.set(userId, userRequests);

  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
    'X-RateLimit-Remaining': (RATE_LIMIT_MAX_REQUESTS - userRequests.length).toString(),
    'X-RateLimit-Reset': new Date(now + RATE_LIMIT_WINDOW_MS).toISOString(),
  });

  // Clean up old entries periodically (every 5 minutes)
  if (Math.random() < 0.01) { // 1% chance on each request
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    for (const [uid, timestamps] of rateLimitStore.entries()) {
      const filtered = timestamps.filter(ts => ts > cutoff);
      if (filtered.length === 0) {
        rateLimitStore.delete(uid);
      } else {
        rateLimitStore.set(uid, filtered);
      }
    }
  }

  next();
}

function isValidWalrusBlobId(blobId) {
  return typeof blobId === "string" && BLOB_ID_PATTERN.test(blobId);
}

// Simple health and root routes for quick checks
app.get("/", (_req, res) => {
  res.type("text/plain").send("Walrus API server is running. Try GET /api/emotions or POST /api/emotion");
});
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "walrus-api", port: PORT, time: new Date().toISOString() });
});

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]), "utf-8");
  }
}

async function readAll() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
}

async function uploadToWalrus(encryptedData, epochs = DEFAULT_EPOCHS, networkParam = null) {
  // 根据网络参数选择正确的 Walrus 端点
  const network = resolveWalrusNetwork(networkParam);
  const walrusConfig = getWalrusConfig(network);
  const publisherUrl = walrusConfig.publisher;
  const aggregatorUrl = walrusConfig.aggregator;
  
  const url = `${publisherUrl}/v1/store?epochs=${epochs}`;
  console.log(`[Walrus] Uploading to ${url} on ${network}, data size: ${encryptedData.length} bytes, epochs: ${epochs}`);
  
  try {
    const res = await fetch(url, {
      method: "PUT",
      body: encryptedData,
      headers: { "Content-Type": "application/octet-stream" },
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`[Walrus] Upload failed:`, {
        status: res.status,
        statusText: res.statusText,
        url,
        errorBody: text,
        dataSize: encryptedData.length,
      });
      
      // Provide more specific error messages based on status code
      if (res.status === 404) {
        throw new Error(`Walrus service endpoint not found. Please check if the service is available at ${publisherUrl}`);
      } else if (res.status === 413) {
        throw new Error(`Data too large (${encryptedData.length} bytes). Maximum size exceeded.`);
      } else if (res.status >= 500) {
        throw new Error(`Walrus service error (${res.status}). Please try again later.`);
      } else {
        throw new Error(`Walrus upload failed: ${res.status} ${text || res.statusText}`);
      }
    }
    
    const result = await res.json();
    console.log(`[Walrus] Upload successful, response:`, JSON.stringify(result, null, 2));
    
    let blobId;
    if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
      console.log(`[Walrus] Blob already certified: ${blobId}`);
    } else if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
      console.log(`[Walrus] New blob created: ${blobId}`);
    } else {
      console.error(`[Walrus] Unexpected response format:`, JSON.stringify(result, null, 2));
      throw new Error("Unexpected Walrus response format");
    }
    
    return {
      blobId,
      walrusUrl: `${aggregatorUrl}/v1/${blobId}`,
      suiRef: result.newlyCreated?.blobObject?.id || null,
      raw: result,
    };
  } catch (error) {
    // Re-throw if it's already our formatted error
    if (error.message && error.message.startsWith("Walrus")) {
      throw error;
    }
    // Handle network errors
    console.error(`[Walrus] Network error:`, error);
    throw new Error(`Failed to connect to Walrus service: ${error.message}`);
  }
}

app.post("/api/emotion", requireAuth, rateLimitMiddleware, async (req, res) => {
  try {
    console.log(`[API] POST /api/emotion - Authenticated request from user: ${req.user.id}`);
    const { emotion, intensity, description, encryptedData, isPublic = false, walletAddress = null, epochs, network } = req.body || {};
    
    // Validate inputs
    if (!emotion || typeof emotion !== "string") {
      console.error(`[API] Validation error: emotion required`);
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (typeof intensity !== "number") {
      console.error(`[API] Validation error: intensity required`);
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!description || typeof description !== "string") {
      console.error(`[API] Validation error: description required`);
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!encryptedData || typeof encryptedData !== "string") {
      console.error(`[API] Validation error: encryptedData required`);
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    // Validate epochs if provided
    let validEpochs = DEFAULT_EPOCHS;
    if (epochs !== undefined) {
      const epochsNum = Number(epochs);
      if (isNaN(epochsNum) || epochsNum < 1 || epochsNum > 1000) {
        console.error(`[API] Validation error: epochs must be between 1 and 1000, got: ${epochs}`);
        return res.status(400).json({
          success: false,
          error: "Invalid epochs value. Must be between 1 and 1000.",
          errorCode: ERROR_CODES.VALIDATION_ERROR,
        });
      }
      validEpochs = epochsNum;
    }

    console.log(`[API] Validated inputs - emotion: ${emotion}, intensity: ${intensity}, description length: ${description.length}, encryptedData length: ${encryptedData.length}, epochs: ${validEpochs}`);

    const payloadHash = createHash("sha256").update(encryptedData).digest("hex");
    console.log(`[API] Payload hash calculated: ${payloadHash.slice(0, 16)}...`);
    
    // Try to upload to Walrus, but fallback to local storage if it fails
    let uploaded;
    let walrusUploadFailed = false;
    
    if (WALRUS_ENABLED) {
      try {
        console.log(`[API] Starting Walrus upload with ${validEpochs} epochs on network: ${network || 'default'}...`);
        uploaded = await uploadToWalrus(encryptedData, validEpochs, network);
        console.log(`[API] Walrus upload completed - blobId: ${uploaded.blobId}`);
      } catch (walrusError) {
        console.warn(`[API] Walrus upload failed, falling back to local storage:`, walrusError.message);
        walrusUploadFailed = true;
        // Generate a local blob ID based on the payload hash
        const localBlobId = `local_${payloadHash.slice(0, 32)}`;
        uploaded = {
          blobId: localBlobId,
          walrusUrl: `local://${localBlobId}`,
          suiRef: null,
        };
      }
    } else {
      console.log(`[API] Walrus upload disabled, using local storage only`);
      const localBlobId = `local_${payloadHash.slice(0, 32)}`;
      uploaded = {
        blobId: localBlobId,
        walrusUrl: `local://${localBlobId}`,
        suiRef: null,
      };
      walrusUploadFailed = true;
    }

    const record = {
      id: randomUUID(),
      user_id: req.user.id, // Add user_id for access control
      emotion,
      intensity,
      // Do not store plaintext description - it's encrypted in Walrus or database fallback
      description: null,
      blob_id: uploaded.blobId,
      walrus_url: uploaded.walrusUrl,
      payload_hash: payloadHash,
      is_public: !!isPublic,
      proof_status: walrusUploadFailed ? "pending" : "confirmed",
      sui_ref: uploaded.suiRef,
      wallet_address: walletAddress,
      created_at: new Date().toISOString(),
      version: "1.0.0",
      walrus_upload_failed: walrusUploadFailed, // Track if Walrus upload failed
      encrypted_data: encryptedData,
    };

    console.log(`[API] Saving record to local storage...`);
    const list = await readAll();
    list.push(record);
    await writeAll(list);
    console.log(`[API] Record saved successfully - id: ${record.id}`);

    const response = {
      success: true,
      record: {
        id: record.id,
        blobId: record.blob_id,
        walrusUrl: record.walrus_url,
        payloadHash: record.payload_hash,
        timestamp: record.created_at,
        proof: { status: record.proof_status, suiRef: record.sui_ref },
      },
    };
    
    // Add warning if Walrus upload failed
    if (walrusUploadFailed) {
      response.warning = "Walrus upload failed. Data saved locally only.";
      console.log(`[API] Warning: Record saved locally due to Walrus upload failure`);
    }
    
    res.json(response);
  } catch (e) {
    const errorResponse = createErrorResponse(e, 500);
    res.status(500).json(errorResponse);
  }
});

// Proxy endpoint to fetch Walrus blobs server-side (avoids browser CORS limits)
app.get("/api/walrus/:blobId", async (req, res) => {
  try {
    const blobId = req.params.blobId;
    
    if (!isValidWalrusBlobId(blobId)) {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    
    const network = resolveWalrusNetwork(req.query.network);
    const { aggregator } = getWalrusConfig(network);
    
    const sanitizedBlobId = encodeURIComponent(blobId);
    const walrusResponse = await fetch(`${aggregator}/v1/${sanitizedBlobId}`);
    
    if (!walrusResponse.ok) {
      const errorText = await walrusResponse.text();
      console.error("[Walrus Proxy] Aggregator error:", {
        status: walrusResponse.status,
        blobId: `${blobId.slice(0, 8)}...`,
        network,
        error: errorText,
      });
      
      let message;
      if (walrusResponse.status === 404) {
        message = "Data not found. It may have expired or been removed.";
      } else if (walrusResponse.status >= 500) {
        message = `Storage service temporarily unavailable (${walrusResponse.status}). Please try again later.`;
      } else {
        message = `Failed to retrieve data (${walrusResponse.status}). Please try again.`;
      }
      
      return res.status(walrusResponse.status).json({
        success: false,
        error: message,
        status: walrusResponse.status,
        network,
      });
    }
    
    const payload = await walrusResponse.text();
    res.setHeader("Content-Type", walrusResponse.headers.get("Content-Type") || "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Walrus-Proxy", "true");
    res.setHeader("X-Walrus-Network", network);
    return res.status(200).send(payload);
  } catch (error) {
    console.error("[Walrus Proxy] Unexpected error:", error);
    const errorResponse = createErrorResponse(error, 500);
    return res.status(500).json(errorResponse);
  }
});

app.get("/api/emotions", requireAuth, rateLimitMiddleware, async (req, res) => {
  try {
    console.log(`[API] GET /api/emotions - Authenticated request from user: ${req.user.id}`);
    const list = await readAll();
    
    // Filter records to only show the authenticated user's records
    // For privacy, users should only see their own emotion records
    const userRecords = list.filter(record => {
      // If record has a user_id field, check if it matches
      // Otherwise, for backward compatibility, return all records
      return !record.user_id || record.user_id === req.user.id;
    });
    
    console.log(`[API] Returning ${userRecords.length} records for user ${req.user.id}`);
    res.json({ success: true, records: userRecords.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) });
  } catch (e) {
    const errorResponse = createErrorResponse(e, 500);
    res.status(500).json(errorResponse);
  }
});

// Fetch encrypted payload for a blob ID (used as Walrus fallback)
app.get("/api/emotions/blob/:blobId", async (req, res) => {
  try {
    const blobId = req.params.blobId;
    if (!blobId || !isValidWalrusBlobId(blobId)) {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const list = await readAll();
    const record = list.find(r => r.blob_id === blobId);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Encrypted data not found for this blob ID.",
      });
    }

    if (!record.encrypted_data) {
      try {
        const network = resolveWalrusNetwork(req.query.network);
        const { aggregator } = getWalrusConfig(network);
        const walrusResponse = await fetch(`${aggregator}/v1/${encodeURIComponent(blobId)}`);
        if (!walrusResponse.ok) {
          const errorText = await walrusResponse.text();
          return res.status(walrusResponse.status).json({
            success: false,
            error: errorText || `Failed to fetch encrypted data from Walrus (${walrusResponse.status}).`,
            network,
          });
        }
        const payload = await walrusResponse.text();
        record.encrypted_data = payload;
        await writeAll(list);
        return res.json({
          success: true,
          encryptedData: payload,
          network,
        });
      } catch (walrusError) {
        console.error("[API] Failed to fetch Walrus backup:", walrusError);
        const errorResponse = createErrorResponse(walrusError, 500);
        return res.status(500).json(errorResponse);
      }
    }

    return res.json({
      success: true,
      encryptedData: record.encrypted_data,
    });
  } catch (error) {
    console.error("[API] Failed to fetch encrypted data:", error);
    const errorResponse = createErrorResponse(error, 500);
    res.status(500).json(errorResponse);
  }
});

// New endpoint: Get emotions by wallet address (for anonymous users)
// This allows wallet-connected anonymous users to see their Walrus records
app.get("/api/emotions/by-wallet/:walletAddress", async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    
    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    
    console.log(`[API] GET /api/emotions/by-wallet - Request for wallet: ${walletAddress}`);
    const list = await readAll();
    
    // Filter records by wallet address
    // Only return records that match the wallet address
    const walletRecords = list.filter(record => {
      return record.wallet_address && record.wallet_address.toLowerCase() === walletAddress.toLowerCase();
    });
    
    console.log(`[API] Returning ${walletRecords.length} records for wallet ${walletAddress}`);
    res.json({ 
      success: true, 
      records: walletRecords.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) 
    });
  } catch (e) {
    const errorResponse = createErrorResponse(e, 500);
    res.status(500).json(errorResponse);
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
