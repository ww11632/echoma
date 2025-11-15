// src/lib/suiClient.ts
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

export const client = new SuiClient({
  url: getFullnodeUrl("testnet"),
});
