// src/lib/suiClient.ts
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";

export const client = new SuiClient({
  url: getFullnodeUrl("testnet"), // 或 testnet
});
