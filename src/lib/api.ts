import { supabase } from "@/integrations/supabase/client";

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
    const { data, error } = await supabase.functions.invoke('upload-emotion', {
      body: payload,
    });
    
    if (error) {
      console.error("[API] Request failed:", error);
      throw new Error(error.message || "Failed to upload emotion");
    }
    
    if (!data || !data.success) {
      const errorMessage = data?.error || "Request failed";
      console.error("[API] Request failed:", data);
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
    if (error instanceof Error) {
      throw error;
    }
    console.error("[API] Unexpected error:", error);
    throw new Error("Network error. Please check your connection and try again.");
  }
}

export async function getEmotions(accessToken?: string) {
  try {
    const { data, error } = await supabase.functions.invoke('get-emotions', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    
    if (error) {
      console.error("[API] Failed to fetch emotions:", error);
      throw new Error(error.message || "Failed to fetch emotions");
    }
    
    if (!data || !data.success) {
      throw new Error(data?.error || "Failed to fetch");
    }
    
    return data.records as any[];
  } catch (error) {
    console.error("[API] Error fetching emotions:", error);
    throw error;
  }
}

// Get emotions by wallet address (for anonymous users)
export async function getEmotionsByWallet(walletAddress: string) {
  try {
    const { data, error } = await supabase.functions.invoke(
      `get-emotions-by-wallet/${encodeURIComponent(walletAddress)}`,
      { method: 'GET' }
    );
    
    if (error) {
      console.error("[API] Failed to fetch emotions by wallet:", error);
      throw new Error(error.message || "Failed to fetch");
    }
    
    if (!data || !data.success) {
      throw new Error(data?.error || "Failed to fetch");
    }
    
    return data.records as any[];
  } catch (error) {
    console.error("[API] Error fetching emotions by wallet:", error);
    throw error;
  }
}

// Fetch encrypted snapshot from server as Walrus fallback
export async function getEncryptedEmotionByBlob(blobId: string, network?: "testnet" | "mainnet"): Promise<string> {
  try {
    const networkQuery = network ? `?network=${network}` : "";
    const { data, error } = await supabase.functions.invoke(
      `get-encrypted-blob/${encodeURIComponent(blobId)}${networkQuery}`,
      { method: 'GET' }
    );
    
    if (error) {
      console.error("[API] Failed to fetch encrypted blob:", error);
      throw new Error(error.message || "Failed to fetch encrypted data");
    }
    
    if (!data || !data.success || !data.encryptedData) {
      throw new Error(data?.error || "Failed to fetch encrypted data from server.");
    }
    
    return data.encryptedData as string;
  } catch (error) {
    console.error("[API] Error fetching encrypted blob:", error);
    throw error;
  }
}

