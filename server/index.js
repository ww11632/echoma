import express from "express";
import cors from "cors";
import { randomUUID, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client for JWT verification
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/**
 * Authentication middleware - verifies JWT token from Supabase
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Missing or invalid authorization header' 
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('[Auth] Token verification failed:', error?.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Invalid or expired token' 
      });
    }
    
    // Attach user to request object for use in route handlers
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth] Unexpected error during authentication:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error during authentication' 
    });
  }
}

const DATA_DIR = path.join(process.cwd(), "server", "data");
const DATA_FILE = path.join(DATA_DIR, "emotions.json");
const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL || "https://upload-relay.testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL || "https://aggregator.testnet.walrus.space";
const DEFAULT_EPOCHS = Number(process.env.WALRUS_EPOCHS || 5);
const WALRUS_ENABLED = process.env.WALRUS_ENABLED !== "false"; // Default to true, can be disabled via env var

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

async function uploadToWalrus(encryptedData, epochs = DEFAULT_EPOCHS) {
  const url = `${WALRUS_PUBLISHER_URL}/v1/store?epochs=${epochs}`;
  console.log(`[Walrus] Uploading to ${url}, data size: ${encryptedData.length} bytes, epochs: ${epochs}`);
  
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
        throw new Error(`Walrus service endpoint not found. Please check if the service is available at ${WALRUS_PUBLISHER_URL}`);
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
      walrusUrl: `${WALRUS_AGGREGATOR_URL}/v1/${blobId}`,
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

app.post("/api/emotion", requireAuth, async (req, res) => {
  try {
    console.log(`[API] POST /api/emotion - Authenticated request from user: ${req.user.id}`);
    const { emotion, intensity, description, encryptedData, isPublic = false, walletAddress = null } = req.body || {};
    
    // Validate inputs
    if (!emotion || typeof emotion !== "string") {
      console.error(`[API] Validation error: emotion required`);
      return res.status(400).json({ success: false, error: "emotion required" });
    }
    if (typeof intensity !== "number") {
      console.error(`[API] Validation error: intensity required`);
      return res.status(400).json({ success: false, error: "intensity required" });
    }
    if (!description || typeof description !== "string") {
      console.error(`[API] Validation error: description required`);
      return res.status(400).json({ success: false, error: "description required" });
    }
    if (!encryptedData || typeof encryptedData !== "string") {
      console.error(`[API] Validation error: encryptedData required`);
      return res.status(400).json({ success: false, error: "encryptedData required" });
    }

    console.log(`[API] Validated inputs - emotion: ${emotion}, intensity: ${intensity}, description length: ${description.length}, encryptedData length: ${encryptedData.length}`);

    const payloadHash = createHash("sha256").update(encryptedData).digest("hex");
    console.log(`[API] Payload hash calculated: ${payloadHash.slice(0, 16)}...`);
    
    // Try to upload to Walrus, but fallback to local storage if it fails
    let uploaded;
    let walrusUploadFailed = false;
    
    if (WALRUS_ENABLED) {
      try {
        console.log(`[API] Starting Walrus upload...`);
        uploaded = await uploadToWalrus(encryptedData, DEFAULT_EPOCHS);
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
      description,
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
    console.error(`[API] Error in POST /api/emotion:`, {
      message: e?.message,
      stack: e?.stack,
      name: e?.name,
    });
    const errorMessage = e?.message || "Internal error";
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

app.get("/api/emotions", requireAuth, async (req, res) => {
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
    res.status(500).json({ success: false, error: e?.message || "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

