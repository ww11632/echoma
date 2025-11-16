const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export async function postEmotion(payload: {
  emotion: string;
  intensity: number;
  description: string;
  encryptedData: string;
  isPublic: boolean;
  walletAddress?: string | null;
  epochs?: number;
  network?: "testnet" | "mainnet";
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

export async function getEmotions(accessToken?: string) {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  
  // 如果有access token，添加到请求头
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  const res = await fetch(`${API_BASE}/api/emotions`, {
    headers,
  });
  
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch");
  }
  return data.records as any[];
}

// Get emotions by wallet address (for anonymous users)
export async function getEmotionsByWallet(walletAddress: string) {
  const res = await fetch(`${API_BASE}/api/emotions/by-wallet/${encodeURIComponent(walletAddress)}`, {
    headers: { "Content-Type": "application/json" },
  });
  
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch");
  }
  return data.records as any[];
}

// Fetch encrypted snapshot from server as Walrus fallback
export async function getEncryptedEmotionByBlob(blobId: string, network?: "testnet" | "mainnet"): Promise<string> {
  const networkQuery = network ? `?network=${network}` : "";
  const res = await fetch(`${API_BASE}/api/emotions/blob/${encodeURIComponent(blobId)}${networkQuery}`);
  const data = await res.json();
  if (!res.ok || !data.success || !data.encryptedData) {
    throw new Error(data.error || "Failed to fetch encrypted data from server.");
  }
  return data.encryptedData as string;
}

