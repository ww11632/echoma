import { useMemo } from "react";
import { useSuiClientContext } from "@mysten/dapp-kit";
import { getCurrentNetwork, type SuiNetwork } from "@/lib/networkConfig";

export function useSelectedNetwork(): SuiNetwork {
  const { network } = useSuiClientContext();

  return useMemo(() => {
    if (network === "mainnet" || network === "testnet") {
      return network;
    }
    return getCurrentNetwork();
  }, [network]);
}
