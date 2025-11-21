import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { getClientForNetwork } from "@/lib/suiClient";
import { getPackageId } from "@/lib/mintContract";
import {
  getPolicyRegistryId,
  savePolicyRegistryId,
  clearPolicyRegistryId,
} from "@/lib/policyRegistry";
import { Settings, Check, X, Loader2, ExternalLink, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const PolicyRegistrySettings: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const currentNetwork = useSelectedNetwork();
  const suiClient = getClientForNetwork(currentNetwork);

  const [registryId, setRegistryId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 加载当前配置的 PolicyRegistry ID
  useEffect(() => {
    const loadRegistryId = async () => {
      const id = await getPolicyRegistryId(currentNetwork);
      if (id) {
        setRegistryId(id);
        setIsValid(true);
      }
    };
    loadRegistryId();
  }, [currentNetwork, isDialogOpen]);

  // 验证 PolicyRegistry ID
  const validateRegistryId = async (id: string): Promise<boolean> => {
    if (!id.trim()) {
      return false;
    }

    // 基本格式验证
    if (!id.startsWith("0x") || id.length !== 66) {
      return false;
    }

    setIsValidating(true);
    try {
      const packageId = getPackageId(currentNetwork);
      const expectedType = `${packageId}::seal_access_policies::PolicyRegistry`;

      const registry = await suiClient.getObject({
        id: id.trim(),
        options: { showType: true },
      });

      if (registry.data && registry.data.type === expectedType) {
        setIsValid(true);
        return true;
      } else {
        setIsValid(false);
        return false;
      }
    } catch (error) {
      console.error("[PolicyRegistrySettings] Validation error:", error);
      setIsValid(false);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // 保存 PolicyRegistry ID
  const handleSave = async () => {
    if (!registryId.trim()) {
      toast({
        title: t("settings.policyRegistry.errors.empty") || "請輸入 PolicyRegistry ID",
        variant: "destructive",
      });
      return;
    }

    const isValidId = await validateRegistryId(registryId.trim());
    if (!isValidId) {
      toast({
        title: t("settings.policyRegistry.errors.invalid") || "無效的 PolicyRegistry ID",
        description:
          t("settings.policyRegistry.errors.invalidDesc") ||
          "請確認 ID 格式正確且對應的合約已部署",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      savePolicyRegistryId(registryId.trim(), currentNetwork);
      toast({
        title: t("settings.policyRegistry.success.saved") || "保存成功",
        description:
          t("settings.policyRegistry.success.savedDesc") ||
          "PolicyRegistry ID 已保存",
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error("[PolicyRegistrySettings] Save error:", error);
      toast({
        title: t("settings.policyRegistry.errors.saveFailed") || "保存失敗",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 清除 PolicyRegistry ID
  const handleClear = () => {
    clearPolicyRegistryId(currentNetwork);
    setRegistryId("");
    setIsValid(null);
    toast({
      title: t("settings.policyRegistry.success.cleared") || "已清除",
      description:
        t("settings.policyRegistry.success.clearedDesc") ||
        "PolicyRegistry ID 已清除",
    });
  };

  // 复制到剪贴板
  const handleCopy = () => {
    navigator.clipboard.writeText(registryId);
    toast({
      title: t("common.copied") || "已複製",
      description: t("common.copiedToClipboard") || "已複製到剪貼板",
    });
  };

  // 获取 Sui Explorer URL
  const getExplorerUrl = (id: string) => {
    const networkParam = currentNetwork === "mainnet" ? "mainnet" : "testnet";
    return `https://suiexplorer.com/?network=${networkParam}&object=${id}`;
  };

  const currentRegistryId = registryId || "";

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          {t("settings.policyRegistry.title") || "PolicyRegistry 設定"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("settings.policyRegistry.title") || "PolicyRegistry 設定"}
          </DialogTitle>
          <DialogDescription>
            {t("settings.policyRegistry.description") ||
              "配置 Seal Access Policies 合約的 PolicyRegistry ID。此 ID 用於管理記錄的訪問權限。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="network">
              {t("common.network") || "網路"}
            </Label>
            <div className="mt-1 p-2 rounded-md bg-muted/50 text-sm">
              {currentNetwork === "mainnet" ? "主網" : "測試網"}
            </div>
          </div>

          <div>
            <Label htmlFor="registry-id">
              {t("settings.policyRegistry.registryId") || "PolicyRegistry ID"} *
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="registry-id"
                value={registryId}
                onChange={(e) => {
                  setRegistryId(e.target.value);
                  setIsValid(null);
                }}
                onBlur={() => {
                  if (registryId.trim()) {
                    validateRegistryId(registryId.trim());
                  }
                }}
                placeholder="0x..."
                className="font-mono text-sm"
              />
              {registryId && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title={t("common.copy") || "複製"}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isValidating && (
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("settings.policyRegistry.validating") || "驗證中..."}
              </p>
            )}
            {isValid === true && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t("settings.policyRegistry.valid") || "有效的 PolicyRegistry ID"}
              </p>
            )}
            {isValid === false && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <X className="h-3 w-3" />
                {t("settings.policyRegistry.invalid") || "無效的 PolicyRegistry ID"}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings.policyRegistry.hint") ||
                "輸入 PolicyRegistry 共享對象的 ID（66 字符，以 0x 開頭）"}
            </p>
          </div>

          {currentRegistryId && (
            <Card className="p-3 bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {t("settings.policyRegistry.currentId") || "當前 ID"}
                  </Label>
                  <p className="text-xs font-mono break-all">{currentRegistryId}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(getExplorerUrl(currentRegistryId), "_blank")}
                    title={t("common.viewOnExplorer") || "在瀏覽器中查看"}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleClear}
                    title={t("common.clear") || "清除"}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t("settings.policyRegistry.info") ||
                "💡 提示：如果您還沒有部署 Seal Access Policies 合約，請先運行部署腳本："}
            </p>
            <code className="block mt-1 text-xs font-mono bg-background/50 p-2 rounded">
              ./scripts/deploy-seal-policies.sh {currentNetwork}
            </code>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            {t("common.cancel") || "取消"}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isValidating}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.saving") || "保存中..."}
              </>
            ) : (
              t("common.save") || "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};




