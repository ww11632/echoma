// src/lib/suiClient.ts
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { getCurrentNetwork, getNetworkConfig, type SuiNetwork } from "./networkConfig";

const clientCache: Partial<Record<SuiNetwork, SuiClient>> = {};

function createClient(network: SuiNetwork) {
  const config = getNetworkConfig(network);
  return new SuiClient({
    url: config.rpcUrl || getFullnodeUrl(network),
    network,
  });
}

/**
 * 获取指定网络的客户端
 * 注意：Walrus/Sui 操作需要與當前網絡一致
 */
export function getClientForNetwork(network?: SuiNetwork) {
  const networkName = network || getCurrentNetwork();
  if (!clientCache[networkName]) {
    clientCache[networkName] = createClient(networkName);
  }
  return clientCache[networkName]!;
}
