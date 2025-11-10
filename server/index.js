import express from "express";
import cors from "cors";
import { randomUUID, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const DATA_DIR = path.join(process.cwd(), "server", "data");
const DATA_FILE = path.join(DATA_DIR, "emotions.json");
const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL || "https://upload-relay.testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL || "https://aggregator.testnet.walrus.space";
const DEFAULT_EPOCHS = Number(process.env.WALRUS_EPOCHS || 5);

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
  const res = await fetch(`${WALRUS_PUBLISHER_URL}/v1/store?epochs=${epochs}`, {
    method: "PUT",
    body: encryptedData,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Walrus upload failed: ${res.status} ${text}`);
  }
  const result = await res.json();
  let blobId;
  if (result.alreadyCertified) {
    blobId = result.alreadyCertified.blobId;
  } else if (result.newlyCreated) {
    blobId = result.newlyCreated.blobObject.blobId;
  } else {
    throw new Error("Unexpected Walrus response");
  }
  return {
    blobId,
    walrusUrl: `${WALRUS_AGGREGATOR_URL}/v1/${blobId}`,
    suiRef: result.newlyCreated?.blobObject?.id || null,
    raw: result,
  };
}

app.post("/api/emotion", async (req, res) => {
  try {
    const { emotion, intensity, description, encryptedData, isPublic = false, walletAddress = null } = req.body || {};
    if (!emotion || typeof emotion !== "string") return res.status(400).json({ success: false, error: "emotion required" });
    if (typeof intensity !== "number") return res.status(400).json({ success: false, error: "intensity required" });
    if (!description || typeof description !== "string") return res.status(400).json({ success: false, error: "description required" });
    if (!encryptedData || typeof encryptedData !== "string") return res.status(400).json({ success: false, error: "encryptedData required" });

    const payloadHash = createHash("sha256").update(encryptedData).digest("hex");
    const uploaded = await uploadToWalrus(encryptedData, DEFAULT_EPOCHS);

    const record = {
      id: randomUUID(),
      emotion,
      intensity,
      description,
      blob_id: uploaded.blobId,
      walrus_url: uploaded.walrusUrl,
      payload_hash: payloadHash,
      is_public: !!isPublic,
      proof_status: "confirmed",
      sui_ref: uploaded.suiRef,
      wallet_address: walletAddress,
      created_at: new Date().toISOString(),
      version: "1.0.0",
    };

    const list = await readAll();
    list.push(record);
    await writeAll(list);

    res.json({
      success: true,
      record: {
        id: record.id,
        blobId: record.blob_id,
        walrusUrl: record.walrus_url,
        payloadHash: record.payload_hash,
        timestamp: record.created_at,
        proof: { status: record.proof_status, suiRef: record.sui_ref },
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || "Internal error" });
  }
});

app.get("/api/emotions", async (_req, res) => {
  try {
    const list = await readAll();
    res.json({ success: true, records: list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

