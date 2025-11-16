import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSuiClientContext } from "@mysten/dapp-kit";
import { getCurrentNetwork, STORAGE_KEY, type SuiNetwork } from "@/lib/networkConfig";

/**
 * Hook to listen for network changes and perform cleanup operations
 * This includes:
 * - Clearing React Query cache when network changes
 * - Listening for cross-tab network changes
 * - Notifying components about network changes
 */
export function useNetworkChangeListener(
  onNetworkChange?: (newNetwork: SuiNetwork, oldNetwork: SuiNetwork) => void
) {
  const queryClient = useQueryClient();
  const { network, selectNetwork } = useSuiClientContext();
  const previousNetworkRef = useRef<SuiNetwork>(getCurrentNetwork());
  // 使用 useRef 存储回调函数，避免依赖项变化导致不必要的重新渲染
  const onNetworkChangeRef = useRef(onNetworkChange);
  
  // 更新回调函数引用
  useEffect(() => {
    onNetworkChangeRef.current = onNetworkChange;
  }, [onNetworkChange]);

  // 监听网络切换并清理缓存
  useEffect(() => {
    const currentNetwork = network === "mainnet" || network === "testnet" 
      ? network 
      : getCurrentNetwork();
    
    if (currentNetwork !== previousNetworkRef.current) {
      const oldNetwork = previousNetworkRef.current;
      console.log(`[NetworkChangeListener] Network changed from ${oldNetwork} to ${currentNetwork}`);
      
      // 清理 React Query 缓存（避免显示错误网络的数据）
      queryClient.clear();
      console.log(`[NetworkChangeListener] Cleared React Query cache`);
      
      // 调用回调函数
      if (onNetworkChangeRef.current) {
        onNetworkChangeRef.current(currentNetwork, oldNetwork);
      }
      
      previousNetworkRef.current = currentNetwork;
    }
  }, [network, queryClient]); // queryClient 是稳定的，不会导致不必要的重新运行

  // 跨标签页同步：监听其他标签页的网络切换
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newNetwork = e.newValue as SuiNetwork;
        if (newNetwork === "mainnet" || newNetwork === "testnet") {
          const oldNetwork = previousNetworkRef.current;
          
          // 避免重复处理：如果网络没有实际变化，跳过
          if (newNetwork === oldNetwork) {
            return;
          }
          
          console.log(`[NetworkChangeListener] Network changed in another tab: ${oldNetwork} -> ${newNetwork}`);
          
          // 更新 ref 以避免重复处理
          previousNetworkRef.current = newNetwork;
          
          // 清理缓存
          queryClient.clear();
          
          // 同步 context（这会触发第一个 useEffect，但我们已经更新了 ref，所以不会重复清理）
          if (newNetwork !== network) {
            selectNetwork(newNetwork);
          }
          
          // 调用回调函数
          if (onNetworkChangeRef.current) {
            onNetworkChangeRef.current(newNetwork, oldNetwork);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [network, selectNetwork, queryClient]); // queryClient 和 selectNetwork 是稳定的
}

