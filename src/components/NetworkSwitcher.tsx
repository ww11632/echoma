import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuiClientContext } from "@mysten/dapp-kit";
import {
  getCurrentNetwork,
  persistNetworkPreference,
  type SuiNetwork,
  STORAGE_KEY,
} from "@/lib/networkConfig";

const NETWORK_OPTIONS: SuiNetwork[] = ["testnet", "mainnet"];

export function NetworkSwitcher() {
  const { t } = useTranslation();
  const { network, selectNetwork } = useSuiClientContext();
  // 初始化時優先使用 localStorage 中的偏好設置，如果沒有則使用 context 的 network
  const [selectedNetwork, setSelectedNetwork] = useState<SuiNetwork>(() => {
    const preferred = getCurrentNetwork();
    // 如果 context 的 network 是有效的，且與偏好設置一致，使用它；否則使用偏好設置
    if ((network === "mainnet" || network === "testnet") && network === preferred) {
      return network;
    }
    return preferred;
  });

  // Sync with persisted preference on mount
  useEffect(() => {
    const preferred = getCurrentNetwork();
    // 確保 selectedNetwork 和 context 的 network 都與偏好設置同步
    if (preferred !== selectedNetwork) {
      setSelectedNetwork(preferred);
    }
    if (preferred !== network && (network === "mainnet" || network === "testnet")) {
      selectNetwork(preferred);
    }
  }, []); // 只在挂载时运行一次，不需要依赖项

  // Keep internal state in sync with provider changes
  useEffect(() => {
    if (network === "mainnet" || network === "testnet") {
      setSelectedNetwork(network);
    }
  }, [network]);

  // 跨标签页同步：监听其他标签页的网络切换
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newNetwork = e.newValue as SuiNetwork;
        if (newNetwork === "mainnet" || newNetwork === "testnet") {
          console.log(`[NetworkSwitcher] Network changed in another tab: ${newNetwork}`);
          setSelectedNetwork(newNetwork);
          selectNetwork(newNetwork);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [selectNetwork]);

  const optionLabel = useMemo(
    () => ({
      testnet: t("common.testnet"),
      mainnet: t("common.mainnet"),
    }),
    [t],
  );

  const handleChange = (value: string) => {
    const nextNetwork = (value === "mainnet" ? "mainnet" : "testnet") as SuiNetwork;
    persistNetworkPreference(nextNetwork);
    setSelectedNetwork(nextNetwork);
    selectNetwork(nextNetwork);
  };

  return (
    <div className="rounded-md border border-border/60 bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("common.network")}
      </p>
      <Select value={selectedNetwork} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[150px] border-none px-0 text-sm font-semibold focus:ring-0 focus:ring-offset-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="w-[170px]">
          {NETWORK_OPTIONS.map((networkOption) => (
            <SelectItem key={networkOption} value={networkOption} className="text-sm">
              {optionLabel[networkOption]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default NetworkSwitcher;
