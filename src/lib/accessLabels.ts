// src/lib/accessLabels.ts
// 管理授权地址的角色标签（本地存储）

import type { SuiNetwork } from "./networkConfig";

const getLabelStorageKey = (entryNftId: string, address: string, network: SuiNetwork) =>
  `access_label_${network}_${entryNftId}_${address}`;

/**
 * 保存地址的角色标签
 */
export function saveAccessLabel(
  entryNftId: string,
  address: string,
  label: string,
  network: SuiNetwork
): void {
  if (typeof window === "undefined") return;
  try {
    const key = getLabelStorageKey(entryNftId, address, network);
    localStorage.setItem(key, label);
  } catch (error) {
    console.warn("[accessLabels] Failed to save label:", error);
  }
}

/**
 * 获取地址的角色标签
 */
export function getAccessLabel(
  entryNftId: string,
  address: string,
  network: SuiNetwork
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = getLabelStorageKey(entryNftId, address, network);
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("[accessLabels] Failed to get label:", error);
    return null;
  }
}

/**
 * 删除地址的角色标签
 */
export function deleteAccessLabel(
  entryNftId: string,
  address: string,
  network: SuiNetwork
): void {
  if (typeof window === "undefined") return;
  try {
    const key = getLabelStorageKey(entryNftId, address, network);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("[accessLabels] Failed to delete label:", error);
  }
}





