// src/lib/policyRegistry.ts
// PolicyRegistry ID 配置和管理

import { getCurrentNetwork, type SuiNetwork } from "./networkConfig";
import { getClientForNetwork } from "./suiClient";
import { getPackageId } from "./mintContract";

// PolicyRegistry ID 存储键（基于网络）
const getPolicyRegistryStorageKey = (network: SuiNetwork) => 
  `sui_policy_registry_${network}`;

// 预设的 PolicyRegistry ID（部署后需要更新）
const PRESET_POLICY_REGISTRY_IDS: Record<SuiNetwork, string | null> = {
  testnet: "0x5ccbee5d26bf641ce8a3352d00896f17c1e5c73aa7aa9e67c5df5a8fbca8ec9a", // 部署后更新
  mainnet: null, // 部署后更新
};

/**
 * 获取 PolicyRegistry ID
 * 优先级：
 * 1. 本地存储中的 ID
 * 2. 预设的 ID
 * 3. 从链上查询（如果合约已部署）
 */
export async function getPolicyRegistryId(
  network?: SuiNetwork
): Promise<string | null> {
  const targetNetwork = network || getCurrentNetwork();

  // 1. 尝试从本地存储获取
  if (typeof window !== "undefined") {
    const key = getPolicyRegistryStorageKey(targetNetwork);
    const stored = localStorage.getItem(key);
    if (stored) {
      // 验证 registry 是否仍然存在
      try {
        const client = getClientForNetwork(targetNetwork);
        const registry = await client.getObject({
          id: stored,
          options: { showType: true },
        });
        if (registry.data) {
          const packageId = getPackageId(targetNetwork);
          const expectedType = `${packageId}::seal_access_policies::PolicyRegistry`;
          if (registry.data.type === expectedType) {
            return stored;
          }
        }
      } catch {
        // Registry 不存在，清除存储
        localStorage.removeItem(key);
      }
    }
  }

  // 2. 尝试使用预设的 ID
  if (PRESET_POLICY_REGISTRY_IDS[targetNetwork]) {
    return PRESET_POLICY_REGISTRY_IDS[targetNetwork];
  }

  // 3. 从链上查询（需要合约支持查询）
  // 目前合约没有提供查询 PolicyRegistry 的函数
  // 需要从部署交易的事件中获取，或手动配置

  return null;
}

/**
 * 保存 PolicyRegistry ID 到本地存储
 */
export function savePolicyRegistryId(registryId: string, network?: SuiNetwork): void {
  if (typeof window === "undefined") return;
  
  const targetNetwork = network || getCurrentNetwork();
  const key = getPolicyRegistryStorageKey(targetNetwork);
  localStorage.setItem(key, registryId);
}

/**
 * 清除 PolicyRegistry ID
 */
export function clearPolicyRegistryId(network?: SuiNetwork): void {
  if (typeof window === "undefined") return;
  
  const targetNetwork = network || getCurrentNetwork();
  const key = getPolicyRegistryStorageKey(targetNetwork);
  localStorage.removeItem(key);
}

/**
 * 设置预设的 PolicyRegistry ID（用于部署后配置）
 */
export function setPresetPolicyRegistryId(
  registryId: string,
  network: SuiNetwork
): void {
  PRESET_POLICY_REGISTRY_IDS[network] = registryId;
  savePolicyRegistryId(registryId, network);
}

