/**
 * Network Configuration
 * Manages Sui network selection and configuration (testnet/mainnet)
 */

export type SuiNetwork = "testnet" | "mainnet";

export const STORAGE_KEY = "sui-network-preference";
const DEFAULT_NETWORK: SuiNetwork = "testnet";

interface NetworkConfig {
  rpcUrl?: string;
  walrusUploadRelay: string;
  walrusAggregator: string;
}

const NETWORK_CONFIGS: Record<SuiNetwork, NetworkConfig> = {
  testnet: {
    walrusUploadRelay: "https://upload-relay.testnet.walrus.space",
    walrusAggregator: "https://aggregator.testnet.walrus.space",
  },
  mainnet: {
    walrusUploadRelay: "https://upload-relay.mainnet.walrus.space",
    walrusAggregator: "https://aggregator.mainnet.walrus.space",
  },
};

/**
 * Get the current network preference from localStorage
 * Falls back to default network if no preference is stored
 */
export function getCurrentNetwork(): SuiNetwork {
  if (typeof window === "undefined") {
    return DEFAULT_NETWORK;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "mainnet" || stored === "testnet") {
      return stored;
    }
  } catch (error) {
    console.warn("Failed to read network preference from localStorage:", error);
  }

  return DEFAULT_NETWORK;
}

/**
 * Persist network preference to localStorage
 */
export function persistNetworkPreference(network: SuiNetwork): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, network);
  } catch (error) {
    console.warn("Failed to persist network preference to localStorage:", error);
  }
}

/**
 * Get network configuration for a specific network
 */
export function getNetworkConfig(network: SuiNetwork): NetworkConfig {
  return NETWORK_CONFIGS[network];
}

/**
 * Extract network from Walrus URL
 * Returns the network if the URL contains testnet/mainnet, otherwise returns null
 */
export function extractNetworkFromWalrusUrl(walrusUrl: string | null | undefined): SuiNetwork | null {
  if (!walrusUrl || typeof walrusUrl !== "string") {
    return null;
  }
  
  // Check if URL contains testnet or mainnet
  if (walrusUrl.includes("testnet.walrus.space")) {
    return "testnet";
  }
  if (walrusUrl.includes("mainnet.walrus.space")) {
    return "mainnet";
  }
  
  // If it's a local URL, return null (no network info)
  if (walrusUrl.startsWith("local://")) {
    return null;
  }
  
  return null;
}
