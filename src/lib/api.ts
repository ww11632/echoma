const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export async function postEmotion(payload: {
  emotion: string;
  intensity: number;
  description: string;
  encryptedData: string;
  isPublic: boolean;
  walletAddress?: string | null;
}) {
  try {
    const res = await fetch(`${API_BASE}/api/emotion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    let data;
    try {
      data = await res.json();
    } catch (parseError) {
      // If response is not JSON, read as text
      const text = await res.text();
      console.error("[API] Failed to parse response as JSON:", text);
      throw new Error(`Server error (${res.status}): ${res.statusText || "Invalid response"}`);
    }
    
    if (!res.ok || !data.success) {
      const errorMessage = data.error || `Request failed with status ${res.status}`;
      console.error("[API] Request failed:", {
        status: res.status,
        error: errorMessage,
        data,
      });
      throw new Error(errorMessage);
    }
    
    return data as {
      success: true;
      warning?: string;
      record: {
        id: string;
        blobId: string;
        walrusUrl: string;
        payloadHash: string;
        timestamp: string;
        proof: { status: string; suiRef: string | null };
      };
    };
  } catch (error) {
    // Re-throw if it's already an Error with a message
    if (error instanceof Error) {
      throw error;
    }
    // Handle other types of errors
    console.error("[API] Unexpected error:", error);
    throw new Error("Network error. Please check your connection and try again.");
  }
}

export async function getEmotions() {
  const res = await fetch(`${API_BASE}/api/emotions`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch");
  }
  return data.records as any[];
}


