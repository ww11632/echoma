import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCurrentAccount, useCurrentWallet, useSuiClient } from "@mysten/dapp-kit";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { getClientForNetwork } from "@/lib/suiClient";
import { createSignerFromWallet } from "@/lib/walrus";
import {
  grantAccess,
  revokeAccess,
  hasAccess,
  isPublicSeal,
  getOrQueryPolicyRegistry,
  getAuthorizedAddresses,
  queryAccessHistory,
  checkIfMintedWithSealPolicies,
} from "@/lib/mintContract";
import { saveAccessLabel, getAccessLabel, deleteAccessLabel } from "@/lib/accessLabels";
import { UserPlus, UserMinus, Shield, Users, Loader2, Clock, History, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SuiNetwork } from "@/lib/networkConfig";

interface AccessControlManagerProps {
  entryNftId: string;
  onAccessChanged?: () => void;
  network?: SuiNetwork;
}

interface AuthorizedAddress {
  address: string;
  label?: string;
  grantedAt?: number;
  grantedTx?: string;
}

interface AccessHistoryItem {
  type: "grant" | "revoke";
  address: string;
  timestamp: number;
  transactionDigest: string;
}

export const AccessControlManager: React.FC<AccessControlManagerProps> = ({
  entryNftId,
  onAccessChanged,
  network,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const currentAccount = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const selectedNetwork = useSelectedNetwork();
  const baseSuiClient = useSuiClient();
  const effectiveNetwork = network || selectedNetwork;
  const suiClient = useMemo(() => {
    if (network && network !== selectedNetwork) {
      return getClientForNetwork(network);
    }
    return baseSuiClient;
  }, [network, selectedNetwork, baseSuiClient]);

  const [policyRegistryId, setPolicyRegistryId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [authorizedAddresses, setAuthorizedAddresses] = useState<AuthorizedAddress[]>([]);
  const [accessHistory, setAccessHistory] = useState<AccessHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<{ title: string; description: string } | null>(null);
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [granteeAddress, setGranteeAddress] = useState("");
  const [granteeLabel, setGranteeLabel] = useState("");
  const [policyVerificationPending, setPolicyVerificationPending] = useState(false); // 链上策略已创建但索引未完成
  const [pendingTxDigest, setPendingTxDigest] = useState<string | null>(null);
  const retryTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理重试定时器
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // 预设角色标签选项
  const presetLabels = [
    { value: "partner", label: t("accessControl.labels.partner") || "伴侶" },
    { value: "family", label: t("accessControl.labels.family") || "家人" },
    { value: "therapist", label: t("accessControl.labels.therapist") || "心理師" },
    { value: "doctor", label: t("accessControl.labels.doctor") || "醫生" },
    { value: "agent", label: t("accessControl.labels.agent") || "AI Agent" },
    { value: "friend", label: t("accessControl.labels.friend") || "朋友" },
    { value: "other", label: t("accessControl.labels.other") || "其他" },
  ];

  // 加载 PolicyRegistry ID
  useEffect(() => {
    const loadPolicyRegistry = async () => {
      try {
        const registryId = await getOrQueryPolicyRegistry(effectiveNetwork, suiClient);
        if (registryId) {
          setPolicyRegistryId(registryId);
        } else {
          console.warn("[AccessControlManager] PolicyRegistry not found");
          toast({
            title: t("accessControl.errors.registryNotFound") || "PolicyRegistry 未找到",
            description:
              t("accessControl.errors.registryNotFoundDesc") ||
              "請先部署 Seal Access Policies 合約",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("[AccessControlManager] Error loading PolicyRegistry:", error);
      }
    };

    if (entryNftId) {
      loadPolicyRegistry();
    }
  }, [entryNftId, effectiveNetwork, suiClient]);

  // 当 policyRegistryId 加载完成后，加载访问信息
  useEffect(() => {
    if (policyRegistryId && entryNftId) {
      loadAccessInfo();
    }
  }, [policyRegistryId, entryNftId, effectiveNetwork, suiClient]);

  // 加载访问信息
  const loadAccessInfo = async () => {
    if (!policyRegistryId || !entryNftId) return;

    // 清理自动重试定时器
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setPolicyVerificationPending(false);
    setPendingTxDigest(null);
    setIsLoading(true);
    try {
      // 检查是否为公开记录（添加重试机制，因为链上索引可能需要时间）
      let publicStatus = false;
      let retries = 5; // 增加到5次重试
      let lastError: Error | null = null;
      
      while (retries > 0) {
        try {
          publicStatus = await isPublicSeal(entryNftId, policyRegistryId, effectiveNetwork, suiClient);
          // 如果检查成功（无论 true/false），说明策略存在
          console.log(`[AccessControlManager] ✅ 访问策略检查成功，isPublic: ${publicStatus}`);
          break;
        } catch (error: any) {
          lastError = error;
          const errorMessage = error?.message || "";
          
          // 检查是否是 RPC 序列化错误
          if (errorMessage.includes("RPC_SERIALIZATION_ERROR") || 
              errorMessage.includes("malformed utf8") ||
              errorMessage.includes("Deserialization error")) {
            retries--;
            if (retries > 0) {
              console.warn(`[AccessControlManager] ⚠️ RPC 序列化错误，等待后重试（剩余重试: ${retries}）`);
              // 使用指数退避：2s, 3s, 4s, 5s
              const waitTime = (6 - retries) * 1000;
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              // 所有重试都失败了，尝试使用交易事件作为备选方案
              console.warn(`[AccessControlManager] ⚠️ RPC 序列化错误持续，尝试备选方案...`);
              try {
                const diagnosis = await checkIfMintedWithSealPolicies(entryNftId, effectiveNetwork, suiClient);
                if (diagnosis.mintedWithPolicies && diagnosis.policyCreatedEvent) {
                  // 从事件中获取策略类型
                  const isPublicFromEvent = diagnosis.policyCreatedEvent.is_public || false;
                  console.log(`[AccessControlManager] ✅ 通过交易事件验证成功，isPublic: ${isPublicFromEvent}`);
                  publicStatus = isPublicFromEvent;
                  // 标记为成功，不需要在UI显示错误
                  lastError = null;
                  break; // 跳出重试循环
                } else {
                  console.error(`[AccessControlManager] ❌ 备选方案失败：策略未找到`);
                  throw error;
                }
              } catch (fallbackError) {
                console.error(`[AccessControlManager] ❌ 备选方案失败:`, fallbackError);
                throw error;
              }
            }
          } else if (errorMessage.includes("没有访问策略")) {
            retries--;
            if (retries > 0) {
              console.warn(`[AccessControlManager] ⚠️ 访问策略检查失败，可能是索引延迟（剩余重试: ${retries}）`);
              // 使用指数退避
              const waitTime = (6 - retries) * 1000;
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              // 所有重试都失败了
              console.error(`[AccessControlManager] ❌ 访问策略检查失败：${errorMessage}`);
              throw error;
            }
          } else {
            // 其他错误，直接抛出
            throw error;
          }
        }
      }
      
      // 如果所有重试都失败了，抛出最后一个错误
      if (lastError) {
        throw lastError;
      }
      
      setIsPublic(publicStatus);

      // 如果是私有记录，加载授权地址列表和历史
      if (!publicStatus) {
        // 并行加载授权地址列表和历史记录
        const [addresses, history] = await Promise.all([
          getAuthorizedAddresses(entryNftId, policyRegistryId, effectiveNetwork, suiClient),
          queryAccessHistory(entryNftId, policyRegistryId, effectiveNetwork, suiClient),
        ]);

        setAccessHistory(history);

        // 构建授权地址列表，包含标签和时间信息
        const authorizedList: AuthorizedAddress[] = addresses.map((addr) => {
          // 从历史中找到最后一次授权时间
          const grantEvent = history
            .filter((h) => h.address === addr && h.type === "grant")
            .sort((a, b) => b.timestamp - a.timestamp)[0];

          // 从本地存储获取标签
          const label = getAccessLabel(entryNftId, addr, effectiveNetwork);

          return {
            address: addr,
            label: label || undefined,
            grantedAt: grantEvent?.timestamp,
            grantedTx: grantEvent?.transactionDigest,
          };
        });

        setAuthorizedAddresses(authorizedList);
      }
    } catch (error) {
      console.error("[AccessControlManager] Error loading access info:", error);
      
      // 提供更友好的错误信息
      let errorTitle = t("accessControl.errors.loadFailed") || "載入失敗";
      let errorDescription = error instanceof Error ? error.message : String(error);
      
      // 检查是否是 RPC 序列化错误
      if (errorDescription.includes("RPC_SERIALIZATION_ERROR") ||
          errorDescription.includes("malformed utf8") ||
          errorDescription.includes("Deserialization error")) {
        errorTitle = "暫時無法讀取權限資訊";
        errorDescription = `區塊鏈節點返回的資料格式有誤，這通常是短暫的節點問題。\n\n✅ 系統已自動重試多次\n💡 建議操作：\n1. 點擊下方「重試」按鈕\n2. 若持續失敗，請稍後（1-2分鐘）再試\n3. 此錯誤不影響您的資料安全\n\n🔧 技術細節：${errorDescription.includes('malformed utf8') ? 'UTF-8 解碼錯誤' : 'RPC 序列化錯誤'}`;
        console.error(`[AccessControlManager] ❌ RPC 序列化錯誤（已重試5次）:`, errorDescription);
      }
      // 如果是"没有访问策略"错误，进行诊断
      else if (errorDescription.includes("没有访问策略")) {
        errorTitle = "訪問策略未找到";
        
        // 诊断：检查是否真的使用了 Seal Access Policies 铸造
        console.log(`[AccessControlManager] 🔍 诊断 NFT ${entryNftId} 是否使用 Seal Access Policies 铸造...`);
        try {
          const diagnosis = await checkIfMintedWithSealPolicies(entryNftId, effectiveNetwork, suiClient);
          
          if (diagnosis.mintedWithPolicies) {
            // 确实使用了 Seal Access Policies，可能是索引延迟
            errorDescription = `此 NFT 已確認使用 Seal Access Policies 鑄造，但訪問策略可能尚未索引完成。\n\n請稍等 10-30 秒後刷新頁面重試。\n\n交易: ${diagnosis.transactionDigest?.slice(0, 16)}...`;
            console.log(`[AccessControlManager] ✅ 诊断结果：确实使用了 Seal Access Policies，交易: ${diagnosis.transactionDigest}`);
            setPolicyVerificationPending(true);
            setPendingTxDigest(diagnosis.transactionDigest || null);
            // 自动重试一次，减少用户手动刷新
            retryTimeoutRef.current = setTimeout(() => {
              loadAccessInfo();
            }, 8000);
          } else {
            // 确实没有使用 Seal Access Policies
            errorDescription = `此 NFT 未使用 Seal Access Policies 鑄造。\n\n${diagnosis.error || "請使用「啟用 Seal Access Policies」選項重新鑄造 NFT。"}\n\nNFT ID: ${entryNftId.slice(0, 16)}...`;
            console.log(`[AccessControlManager] ❌ 诊断结果：未使用 Seal Access Policies，原因: ${diagnosis.error}`);
          }
        } catch (diagnosisError) {
          console.error("[AccessControlManager] 诊断失败:", diagnosisError);
          errorDescription = `此 NFT 可能不是使用 Seal Access Policies 鑄造的，或者鏈上索引尚未完成。\n\n如果這是剛鑄造的 NFT，請稍等片刻後刷新頁面重試。\n\nNFT ID: ${entryNftId.slice(0, 16)}...`;
        }
      }
      
      // 保存错误状态以便在 UI 中显示
      setLoadError({ title: errorTitle, description: errorDescription });
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 10000, // 显示更长时间，让用户有时间阅读
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // 重试加载
  const handleRetry = () => {
    setLoadError(null);
    setPolicyVerificationPending(false);
    setPendingTxDigest(null);
    loadAccessInfo();
  };

  // 授权访问
  const handleGrantAccess = async () => {
    if (!policyRegistryId || !currentAccount || !currentWallet) {
      toast({
        title: t("accessControl.errors.walletRequired") || "需要連接錢包",
        variant: "destructive",
      });
      return;
    }

    if (!granteeAddress.trim()) {
      toast({
        title: t("accessControl.errors.addressRequired") || "請輸入地址",
        variant: "destructive",
      });
      return;
    }

    // 验证地址格式
    if (!granteeAddress.startsWith("0x") || granteeAddress.length !== 66) {
      toast({
        title: t("accessControl.errors.invalidAddress") || "無效的地址格式",
        variant: "destructive",
      });
      return;
    }

    // 检查地址是否已经在授权列表中
    const isAlreadyAuthorized = authorizedAddresses.some(addr => addr.address.toLowerCase() === granteeAddress.toLowerCase());
    if (isAlreadyAuthorized) {
      toast({
        title: t("accessControl.errors.alreadyAuthorized") || "地址已授權",
        description: t("accessControl.errors.alreadyAuthorizedDesc") || "該地址已經擁有訪問權限，無需重複授權。",
        variant: "default",
      });
      return;
    }

    // 检查是否授权给自己（所有者已经有访问权限，无需授权）
    if (currentAccount && granteeAddress.toLowerCase() === currentAccount.address.toLowerCase()) {
      toast({
        title: t("accessControl.errors.cannotGrantToSelf") || "無法授權給自己",
        description: t("accessControl.errors.cannotGrantToSelfDesc") || "您作為 NFT 的所有者已經擁有訪問權限，無需授權給自己。",
        variant: "default",
      });
      return;
    }

    // 防止并发操作
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      if (!currentWallet || !currentAccount) {
        throw new Error("Wallet not connected");
      }

      // Create signer from wallet
      const signer = createSignerFromWallet(currentWallet, currentAccount.address, suiClient, effectiveNetwork);
      
      // Create signAndExecute function that matches mintContract.ts expectations
      const signAndExecute = async ({ transaction, chain }: any) => {
        return await signer.signAndExecuteTransaction({
          transaction,
          client: suiClient,
        });
      };

      const txDigest = await grantAccess(
        signAndExecute,
        entryNftId,
        granteeAddress,
        policyRegistryId,
        currentAccount.address,
        effectiveNetwork,
        suiClient
      );

      if (txDigest) {
        toast({
          title: t("accessControl.success.granted") || "授權成功",
          description: t("accessControl.success.grantedDesc") || "已授權該地址訪問此記錄",
        });

        // 保存角色标签到本地存储
        if (granteeLabel) {
          saveAccessLabel(entryNftId, granteeAddress, granteeLabel, effectiveNetwork);
        }

        // 重新加载访问信息以获取最新状态
        await loadAccessInfo();

        setGranteeAddress("");
        setGranteeLabel("");
        setIsGrantDialogOpen(false);
        onAccessChanged?.();
      }
    } catch (error: any) {
      console.error("[AccessControlManager] Error granting access:", error);
      
      // 提供更友好的错误消息
      let errorTitle = t("accessControl.errors.grantFailed") || "授權失敗";
      let errorDescription = error?.message || String(error);
      
      // 检查是否是"已授权"错误
      if (errorDescription.includes("E_ALREADY_AUTHORIZED") || 
          errorDescription.includes("already authorized") ||
          errorDescription.includes("已授權")) {
        errorTitle = t("accessControl.errors.alreadyAuthorized") || "地址已授權";
        errorDescription = t("accessControl.errors.alreadyAuthorizedDesc") || "該地址已經擁有訪問權限，無需重複授權。";
      }
      // 检查是否是"公开记录"错误
      else if (errorDescription.includes("E_INVALID_SEAL_TYPE") || 
               errorDescription.includes("public seal") ||
               errorDescription.includes("公開記錄")) {
        errorTitle = t("accessControl.errors.publicRecord") || "公開記錄無法授權";
        errorDescription = t("accessControl.errors.publicRecordDesc") || "公開記錄任何人都可以訪問，無需授權特定地址。";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 撤销访问
  const handleRevokeAccess = async (address: string) => {
    if (!policyRegistryId || !currentAccount || !currentWallet) {
      toast({
        title: t("accessControl.errors.walletRequired") || "需要連接錢包",
        variant: "destructive",
      });
      return;
    }

    // 检查地址是否在授权列表中
    const isAuthorized = authorizedAddresses.some(addr => addr.address.toLowerCase() === address.toLowerCase());
    if (!isAuthorized) {
      toast({
        title: t("accessControl.errors.notAuthorized") || "地址未授權",
        description: t("accessControl.errors.notAuthorizedDesc") || "該地址沒有訪問權限，無需撤銷。",
        variant: "default",
      });
      return;
    }

    // 防止并发操作
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      if (!currentWallet || !currentAccount) {
        throw new Error("Wallet not connected");
      }

      // Create signer from wallet
      const signer = createSignerFromWallet(currentWallet, currentAccount.address, suiClient, effectiveNetwork);
      
      // Create signAndExecute function that matches mintContract.ts expectations
      const signAndExecute = async ({ transaction, chain }: any) => {
        return await signer.signAndExecuteTransaction({
          transaction,
          client: suiClient,
        });
      };

      const txDigest = await revokeAccess(
        signAndExecute,
        entryNftId,
        address,
        policyRegistryId,
        currentAccount.address,
        effectiveNetwork,
        suiClient
      );

      if (txDigest) {
        toast({
          title: t("accessControl.success.revoked") || "撤銷成功",
          description: t("accessControl.success.revokedDesc") || "已撤銷該地址的訪問權限",
        });

        // 删除本地存储的标签（可选，保留标签以便将来重新授权时使用）
        // deleteAccessLabel(entryNftId, address, effectiveNetwork);

        // 重新加载访问信息以获取最新状态
        await loadAccessInfo();
        onAccessChanged?.();
      }
    } catch (error: any) {
      console.error("[AccessControlManager] Error revoking access:", error);
      
      // 提供更友好的错误消息
      let errorTitle = t("accessControl.errors.revokeFailed") || "撤銷失敗";
      let errorDescription = error?.message || String(error);
      
      // 检查是否是"未授权"错误
      if (errorDescription.includes("E_NOT_AUTHORIZED") || 
          errorDescription.includes("not authorized") ||
          errorDescription.includes("未授權")) {
        errorTitle = t("accessControl.errors.notAuthorized") || "地址未授權";
        errorDescription = t("accessControl.errors.notAuthorizedDesc") || "該地址沒有訪問權限，無需撤銷。";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!policyRegistryId) {
    return (
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">
          {t("accessControl.registryNotAvailable") || "PolicyRegistry 不可用，請先部署合約"}
        </div>
      </Card>
    );
  }

  if (isPublic) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="text-sm font-medium">
            {t("accessControl.publicRecord") || "公開記錄"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {t("accessControl.publicRecordDesc") ||
            "此記錄為公開記錄，任何人都可以訪問"}
        </p>
      </Card>
    );
  }

  // 如果有加载错误，显示错误信息和重试按钮
  if (loadError && !isLoading) {
    // 如果是索引延迟，显示更温和的提示和自动重试状态
    if (policyVerificationPending) {
      return (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-300">
              <Clock className="h-5 w-5" />
              <span className="font-medium">{t("accessControl.errors.pendingIndex") || "訪問策略索引中"}</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {loadError.description}
            </p>
            {pendingTxDigest && (
              <p className="text-xs text-muted-foreground">
                Tx: {pendingTxDigest.slice(0, 16)}...
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleRetry} variant="outline" size="sm" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("accessControl.retrying") || "重試中..."}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("accessControl.retry") || "重試"}
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" disabled>
                {t("accessControl.autoRetryHint") || "系統將自動重試"}
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">{loadError.title}</span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {loadError.description}
          </p>
          <Button onClick={handleRetry} variant="outline" size="sm" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("accessControl.retrying") || "重試中..."}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("accessControl.retry") || "重試"}
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium">
            {t("accessControl.authorizedAccess") || "授權訪問"}
          </span>
          <span className="text-xs text-muted-foreground">
            ({authorizedAddresses.length})
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            {t("accessControl.history") || "歷史"}
          </Button>
          <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                {t("accessControl.grantAccess") || "授權訪問"}
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("accessControl.grantAccess") || "授權訪問"}</DialogTitle>
              <DialogDescription>
                {t("accessControl.grantAccessDesc") ||
                  "授權一個地址訪問此私有記錄"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="grantee-label">
                  {t("accessControl.role") || "角色（可選）"}
                </Label>
                <Select value={granteeLabel} onValueChange={setGranteeLabel}>
                  <SelectTrigger id="grantee-label" className="mt-1">
                    <SelectValue placeholder={t("accessControl.selectRole") || "選擇角色"} />
                  </SelectTrigger>
                  <SelectContent>
                    {presetLabels.map((preset) => (
                      <SelectItem key={preset.value} value={preset.label}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("accessControl.roleHint") || "為授權對象選擇角色，方便識別和管理"}
                </p>
              </div>
              <div>
                <Label htmlFor="grantee-address">
                  {t("accessControl.address") || "錢包地址"} *
                </Label>
                <Input
                  id="grantee-address"
                  value={granteeAddress}
                  onChange={(e) => setGranteeAddress(e.target.value)}
                  placeholder="0x..."
                  className="mt-1 font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("accessControl.addressHint") || "輸入要授權的 Sui 錢包地址（66 字符）"}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsGrantDialogOpen(false)}
                disabled={isLoading}
              >
                {t("common.cancel") || "取消"}
              </Button>
              <Button onClick={handleGrantAccess} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("common.processing") || "處理中..."}
                  </>
                ) : (
                  t("accessControl.grant") || "授權"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {showHistory && accessHistory.length > 0 && (
        <div className="mb-4 p-3 bg-muted/30 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t("accessControl.accessHistory") || "授權歷史"}
            </span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {accessHistory.map((item, idx) => (
              <div
                key={`${item.transactionDigest}-${idx}`}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  {item.type === "grant" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600" />
                  )}
                  <span className="font-mono text-[10px]">
                    {item.address.slice(0, 8)}...{item.address.slice(-6)}
                  </span>
                  <span className="text-muted-foreground">
                    {item.type === "grant" ? "授權" : "撤銷"}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {new Date(item.timestamp).toLocaleDateString("zh-TW", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : authorizedAddresses.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          {t("accessControl.noAuthorizedAddresses") || "暫無授權地址"}
          <p className="text-xs mt-2">
            {t("accessControl.noAuthorizedHint") || "點擊上方按鈕授權他人訪問此記錄"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {authorizedAddresses.map((item) => (
            <div
              key={item.address}
              className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.label && (
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {item.label}
                    </span>
                  )}
                  <span className="text-sm font-medium font-mono truncate">
                    {item.address.slice(0, 10)}...{item.address.slice(-8)}
                  </span>
                </div>
                {item.grantedAt && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t("accessControl.grantedAt") || "授權於"} {new Date(item.grantedAt).toLocaleString("zh-TW")}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRevokeAccess(item.address)}
                disabled={isLoading}
                title={t("accessControl.revokeAccess") || "撤銷訪問"}
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          <strong>💡 {t("accessControl.info.title") || "鏈上驗證與審計"}</strong>
        </p>
        <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1 space-y-1 list-disc list-inside">
          <li>{t("accessControl.info.verifiable") || "所有授權操作都記錄在 Sui 區塊鏈上，可公開驗證"}</li>
          <li>{t("accessControl.info.auditable") || "完整的授權歷史可審計，確保訪問權限的透明度"}</li>
          <li>{t("accessControl.info.revocable") || "隨時可以撤銷授權，立即生效"}</li>
        </ul>
      </div>
    </Card>
  );
};
