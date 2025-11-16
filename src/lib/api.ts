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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/get-emotions-by-wallet?walletAddress=${encodeURIComponent(walletAddress)}`;
    
    const res = await fetch(functionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await res.json();
    
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to fetch");
    }
    
    return data.records as any[];
  } catch (error) {
    console.error("[API] Error fetching emotions by wallet:", error);
    throw error;
  }
}

// Fetch encrypted snapshot from server as Walrus fallback
export async function getEncryptedEmotionByBlob(
  blobId: string, 
  network?: "testnet" | "mainnet",
  accessToken?: string
): Promise<string> {
  try {
    const headers: Record<string, string> = {};
    
    // Add auth header if we have an access token
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Build the full URL with query parameters
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/get-encrypted-blob?blobId=${encodeURIComponent(blobId)}${network ? `&network=${network}` : ''}`;
    
    const res = await fetch(functionUrl, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await res.json();
    
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to fetch encrypted data");
    }
    
    // If encryptedData is null, it means data is on Walrus only (not in DB backup)
    // The caller should fetch directly from Walrus instead
    if (!data.encryptedData) {
      throw new Error("Data not available in database backup - fetch from Walrus instead");
    }
    
    return data.encryptedData as string;
  } catch (error) {
    console.error("[API] Error fetching encrypted blob:", error);
    throw error;
  }
}

