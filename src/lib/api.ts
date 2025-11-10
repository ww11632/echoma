const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export async function postEmotion(payload: {
  emotion: string;
  intensity: number;
  description: string;
  encryptedData: string;
  isPublic: boolean;
  walletAddress?: string | null;
}) {
  const res = await fetch(`${API_BASE}/api/emotion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to upload");
  }
  return data as {
    success: true;
    record: {
      id: string;
      blobId: string;
      walrusUrl: string;
      payloadHash: string;
      timestamp: string;
      proof: { status: string; suiRef: string | null };
    };
  };
}

export async function getEmotions() {
  const res = await fetch(`${API_BASE}/api/emotions`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch");
  }
  return data.records as any[];
}


