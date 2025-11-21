import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import { grantAccess, getOrQueryPolicyRegistry, isPublicSeal, getAuthorizedAddresses } from "@/lib/mintContract";
import { createSignerFromWallet } from "@/lib/walrus";
import { Share2, UserPlus, Loader2, QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ShareRecordDialogProps {
  entryNftId: string;
  trigger?: React.ReactNode;
  onShared?: () => void;
}

interface SharePreset {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export const ShareRecordDialog: React.FC<ShareRecordDialogProps> = ({
  entryNftId,
  trigger,
  onShared,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const currentAccount = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const currentNetwork = useSelectedNetwork();
  const suiClient = useSuiClient();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [policyRegistryId, setPolicyRegistryId] = useState<string | null>(null);
  const [policyExists, setPolicyExists] = useState<boolean | null>(null); // null=检查中，true=存在，false=不存在
  const [isPublicRecord, setIsPublicRecord] = useState<boolean | null>(null); // null=检查中，true=公开，false=私有
  const [checkingPolicy, setCheckingPolicy] = useState(false);
  const [authorizedAddresses, setAuthorizedAddresses] = useState<string[]>([]); // 已授权地址列表

  // 预设分享选项
  const sharePresets: SharePreset[] = [
    {
      id: "therapist",
      label: t("share.presets.therapist") || "心理師",
      icon: <UserPlus className="h-4 w-4" />,
      description: t("share.presets.therapistDesc") || "分享給您的心理治療師",
    },
    {
      id: "partner",
      label: t("share.presets.partner") || "伴侶",
      icon: <UserPlus className="h-4 w-4" />,
      description: t("share.presets.partnerDesc") || "分享給您的伴侶",
    },
    {
      id: "family",
      label: t("share.presets.family") || "家人",
      icon: <UserPlus className="h-4 w-4" />,
      description: t("share.presets.familyDesc") || "分享給您的家人",
    },
    {
      id: "doctor",
      label: t("share.presets.doctor") || "醫生",
      icon: <UserPlus className="h-4 w-4" />,
      description: t("share.presets.doctorDesc") || "分享給您的醫生",
    },
    {
      id: "friend",
      label: t("share.presets.friend") || "朋友",
      icon: <UserPlus className="h-4 w-4" />,
      description: t("share.presets.friendDesc") || "分享給您的朋友",
    },
    {
      id: "custom",
      label: t("share.presets.custom") || "自訂地址",
      icon: <QrCode className="h-4 w-4" />,
      description: t("share.presets.customDesc") || "輸入錢包地址",
    },
  ];

  // 加载 PolicyRegistry ID 并检查策略是否存在
  React.useEffect(() => {
    if (isOpen && entryNftId) {
      const loadPolicyRegistryAndCheck = async () => {
        setCheckingPolicy(true);
        setPolicyExists(null);
        try {
          const registryId = await getOrQueryPolicyRegistry(currentNetwork, suiClient);
          setPolicyRegistryId(registryId);
          
          if (registryId) {
            // 检查策略是否存在，并判断是否为公开记录
            try {
              const isPublic = await isPublicSeal(entryNftId, registryId, currentNetwork, suiClient);
              setPolicyExists(true);
              setIsPublicRecord(isPublic);
              console.log("[ShareRecordDialog] ✅ 策略存在，可以分享", { isPublic });
              if (isPublic) {
                console.log("[ShareRecordDialog] ⚠️ 这是公开记录，无需分享");
              } else {
                // 如果是私有记录，加载已授权地址列表
                try {
                  const authorized = await getAuthorizedAddresses(entryNftId, registryId, currentNetwork, suiClient);
                  setAuthorizedAddresses(authorized);
                  console.log("[ShareRecordDialog] ✅ 已加载授权地址列表", { count: authorized.length });
                } catch (authError) {
                  console.warn("[ShareRecordDialog] ⚠️ 加载授权地址列表失败:", authError);
                  // 不影响主要流程，继续
                }
              }
            } catch (error: any) {
              const errorMessage = error?.message || "";
              if (errorMessage.includes("没有访问策略") || errorMessage.includes("does not have an access policy")) {
                setPolicyExists(false);
                setIsPublicRecord(null);
                console.warn("[ShareRecordDialog] ⚠️ 策略不存在，NFT 可能未使用 Seal Access Policies 铸造");
              } else {
                // 其他错误，可能是网络问题或索引延迟
                // 更保守的处理：设置为 false，但显示警告信息，允许用户重试
                setPolicyExists(false);
                setIsPublicRecord(null);
                console.warn("[ShareRecordDialog] ⚠️ 策略检查失败，可能是网络问题或索引延迟:", error);
                // 显示警告，但允许用户尝试（因为可能是索引延迟）
                toast({
                  title: t("share.errors.policyCheckFailed") || "策略检查失败",
                  description: t("share.errors.policyCheckFailedDesc") || "无法验证访问策略，可能是网络问题或索引延迟。如果 NFT 确实使用 Seal Access Policies 铸造，您可以稍后重试。",
                  variant: "default",
                });
              }
            }
          } else {
            setPolicyExists(false);
            setIsPublicRecord(null);
          }
        } catch (error) {
          console.error("[ShareRecordDialog] Error loading PolicyRegistry:", error);
          setPolicyExists(false);
          setIsPublicRecord(null);
        } finally {
          setCheckingPolicy(false);
        }
      };
      loadPolicyRegistryAndCheck();
    } else {
      // 对话框关闭时重置状态
      setPolicyExists(null);
      setIsPublicRecord(null);
      setCheckingPolicy(false);
      setAuthorizedAddresses([]);
    }
  }, [isOpen, entryNftId, currentNetwork, suiClient]);

  // 处理分享
  const handleShare = async (address: string) => {
    if (!policyRegistryId) {
      toast({
        title: t("share.errors.registryNotFound") || "PolicyRegistry 未找到",
        description:
          t("share.errors.registryNotFoundDesc") ||
          "請先部署 Seal Access Policies 合約",
        variant: "destructive",
      });
      return;
    }

    if (!currentAccount || !currentWallet) {
      toast({
        title: t("share.errors.walletRequired") || "需要連接錢包",
        variant: "destructive",
      });
      return;
    }

    if (!address.trim()) {
      toast({
        title: t("share.errors.addressRequired") || "請輸入地址",
        variant: "destructive",
      });
      return;
    }

    // 验证地址格式
    if (!address.startsWith("0x") || address.length !== 66) {
      toast({
        title: t("share.errors.invalidAddress") || "無效的地址格式",
        variant: "destructive",
      });
      return;
    }

    // 检查是否为公开记录（如果已检查）
    if (isPublicRecord === true) {
      toast({
        title: t("share.errors.publicRecord") || "公開記錄無法分享",
        description: t("share.errors.publicRecordDesc") || "公開記錄任何人都可以訪問，無需授權特定地址。",
        variant: "default",
      });
      return;
    }

    // 检查是否授权给自己（所有者已经有访问权限，无需授权）
    if (currentAccount && address.toLowerCase() === currentAccount.address.toLowerCase()) {
      toast({
        title: t("share.errors.cannotGrantToSelf") || "無法授權給自己",
        description: t("share.errors.cannotGrantToSelfDesc") || "您作為 NFT 的所有者已經擁有訪問權限，無需授權給自己。",
        variant: "default",
      });
      return;
    }

    // 检查地址是否已经在授权列表中
    const isAlreadyAuthorized = authorizedAddresses.some(addr => addr.toLowerCase() === address.toLowerCase());
    if (isAlreadyAuthorized) {
      toast({
        title: t("share.errors.alreadyAuthorized") || "地址已授權",
        description: t("share.errors.alreadyAuthorizedDesc") || "該地址已經擁有訪問權限，無需重複授權。",
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
      const signer = createSignerFromWallet(currentWallet, currentAccount.address, suiClient, currentNetwork);
      
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
        address,
        policyRegistryId,
        currentAccount.address,
        currentNetwork,
        suiClient
      );

      if (txDigest) {
        toast({
          title: t("share.success.shared") || "分享成功",
          description: t("share.success.sharedDesc") || "已授權該地址訪問此記錄",
        });

        // 更新授权地址列表（添加新授权的地址）
        setAuthorizedAddresses(prev => [...prev, address]);

        setIsOpen(false);
        setSelectedPreset(null);
        setCustomAddress("");
        onShared?.();
      }
    } catch (error: any) {
      console.error("[ShareRecordDialog] Error sharing:", error);
      toast({
        title: t("share.errors.shareFailed") || "分享失敗",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId !== "custom") {
      // 对于预设选项，需要用户输入地址
      // 这里可以扩展为保存常用地址
      setCustomAddress("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            {t("share.title") || "分享記錄"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("share.title") || "分享記錄"}</DialogTitle>
          <DialogDescription>
            {t("share.description") ||
              "選擇要分享給的對象，或輸入自訂地址"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 策略检查状态提示 */}
          {checkingPolicy && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("share.checkingPolicy") || "正在检查访问策略..."}
              </div>
            </div>
          )}
          {!checkingPolicy && policyExists === false && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2">
                <div>
                  ⚠️ {t("share.policyNotFound") || "无法验证访问策略，此 NFT 可能未使用 Seal Access Policies 铸造。"}
                </div>
                <div className="text-xs mt-2">
                  {t("share.policyNotFoundHint") || "如果 NFT 确实使用 Seal Access Policies 铸造，可能是索引延迟。请稍等 10-30 秒后关闭并重新打开此对话框重试。"}
                </div>
              </div>
            </div>
          )}
          {!checkingPolicy && policyExists === true && isPublicRecord === true && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                ℹ️ {t("share.publicRecord") || "这是公开记录，任何人都可以访问，无需分享。"}
              </div>
            </div>
          )}
          
          {/* 预设选项 */}
          <div className="grid grid-cols-2 gap-2">
            {sharePresets.map((preset) => (
              <Card
                key={preset.id}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedPreset === preset.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
                onClick={() => handlePresetSelect(preset.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {preset.icon}
                  <span className="text-sm font-medium">{preset.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </Card>
            ))}
          </div>

          {/* 地址输入 */}
          {selectedPreset && (
            <div className="space-y-2">
              <Label htmlFor="share-address">
                {selectedPreset === "custom"
                  ? t("share.address") || "錢包地址"
                  : t("share.enterAddress", {
                      label: sharePresets.find((p) => p.id === selectedPreset)?.label,
                    }) || "輸入{{label}}的錢包地址"}
              </Label>
              <Input
                id="share-address"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="0x..."
                disabled={isLoading}
              />
              <Button
                onClick={() => handleShare(customAddress)}
                disabled={isLoading || !customAddress.trim() || policyExists === false || isPublicRecord === true || checkingPolicy}
                className="w-full"
                title={isPublicRecord === true ? (t("share.publicRecordTooltip") || "公开记录无需分享") : undefined}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("common.processing") || "處理中..."}
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    {t("share.share") || "分享"}
                  </>
                )}
              </Button>
            </div>
          )}

          {!selectedPreset && (
            <div className="text-sm text-muted-foreground text-center py-4">
              {t("share.selectOption") || "請選擇要分享的對象"}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            {t("common.cancel") || "取消"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

