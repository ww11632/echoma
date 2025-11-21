/**
 * Access Control Labels Synchronization
 * Syncs labels between localStorage and cloud storage (Supabase)
 */

import { supabase } from "@/integrations/supabase/client";
import type { SuiNetwork } from "@/lib/networkConfig";

interface AccessLabelRecord {
  id?: string;
  user_id: string;
  nft_id: string;
  address: string;
  label: string;
  network: SuiNetwork;
  created_at?: string;
  updated_at?: string;
}

/**
 * Save label to cloud storage (Supabase)
 * This will automatically sync with localStorage
 */
export async function saveAccessLabelToCloud(
  entryNftId: string,
  address: string,
  label: string,
  network: SuiNetwork
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn("[accessLabelsSync] No authenticated user, skipping cloud sync");
      return;
    }

    // Check if label already exists
    const { data: existing } = await supabase
      .from("access_labels")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("nft_id", entryNftId)
      .eq("address", address)
      .eq("network", network)
      .single();

    if (existing) {
      // Update existing label
      const { error } = await supabase
        .from("access_labels")
        .update({
          label,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      // Insert new label
      const { error } = await supabase
        .from("access_labels")
        .insert({
          user_id: session.user.id,
          nft_id: entryNftId,
          address,
          label,
          network,
        });

      if (error) throw error;
    }

    console.log(`[accessLabelsSync] Label synced to cloud for ${address.slice(0, 10)}...`);
  } catch (error) {
    console.error("[accessLabelsSync] Failed to sync label to cloud:", error);
    // Don't throw error - local storage already has the label
  }
}

/**
 * Get label from cloud storage
 */
export async function getAccessLabelFromCloud(
  entryNftId: string,
  address: string,
  network: SuiNetwork
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return null;
    }

    const { data, error } = await supabase
      .from("access_labels")
      .select("label")
      .eq("user_id", session.user.id)
      .eq("nft_id", entryNftId)
      .eq("address", address)
      .eq("network", network)
      .single();

    if (error || !data) {
      return null;
    }

    return data.label;
  } catch (error) {
    console.error("[accessLabelsSync] Failed to get label from cloud:", error);
    return null;
  }
}

/**
 * Delete label from cloud storage
 */
export async function deleteAccessLabelFromCloud(
  entryNftId: string,
  address: string,
  network: SuiNetwork
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return;
    }

    const { error } = await supabase
      .from("access_labels")
      .delete()
      .eq("user_id", session.user.id)
      .eq("nft_id", entryNftId)
      .eq("address", address)
      .eq("network", network);

    if (error) throw error;

    console.log(`[accessLabelsSync] Label deleted from cloud for ${address.slice(0, 10)}...`);
  } catch (error) {
    console.error("[accessLabelsSync] Failed to delete label from cloud:", error);
    // Don't throw error - local storage is already updated
  }
}

/**
 * Get all labels for an NFT from cloud storage
 */
export async function getAllAccessLabelsFromCloud(
  entryNftId: string,
  network: SuiNetwork
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return labels;
    }

    const { data, error } = await supabase
      .from("access_labels")
      .select("address, label")
      .eq("user_id", session.user.id)
      .eq("nft_id", entryNftId)
      .eq("network", network);

    if (error) throw error;

    if (data) {
      data.forEach(item => {
        labels.set(item.address, item.label);
      });
    }

    return labels;
  } catch (error) {
    console.error("[accessLabelsSync] Failed to get all labels from cloud:", error);
    return labels;
  }
}

/**
 * Sync all labels from cloud to localStorage on app start
 */
export async function syncLabelsFromCloud(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return;
    }

    const { data, error } = await supabase
      .from("access_labels")
      .select("*")
      .eq("user_id", session.user.id);

    if (error) throw error;

    if (data) {
      // Import saveAccessLabel from accessLabels.ts
      const { saveAccessLabel } = await import("./accessLabels");
      
      data.forEach((item: AccessLabelRecord) => {
        saveAccessLabel(item.nft_id, item.address, item.label, item.network);
      });

      console.log(`[accessLabelsSync] Synced ${data.length} labels from cloud to localStorage`);
    }
  } catch (error) {
    console.error("[accessLabelsSync] Failed to sync labels from cloud:", error);
  }
}

