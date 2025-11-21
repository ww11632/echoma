/**
 * Password Reset Dialog
 * Allows users to change their encryption password and re-encrypt all data
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { 
  validatePasswordStrength, 
  savePasswordConfig, 
  passwordCache, 
  getPasswordContext,
  clearPasswordConfig 
} from "@/lib/userPassword";

interface PasswordResetDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (oldPassword: string, newPassword: string) => Promise<void>;
  walletAddress?: string | null;
  userId?: string | null;
}

export function PasswordResetDialog({
  open,
  onClose,
  onSuccess,
  walletAddress,
  userId,
}: PasswordResetDialogProps) {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hint, setHint] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReset = async () => {
    setError(undefined);

    // Validate old password
    if (!oldPassword) {
      setError("請輸入舊密碼");
      return;
    }

    // Validate new password strength
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      setError("兩次輸入的新密碼不一致");
      return;
    }

    // Check if old and new passwords are the same
    if (oldPassword === newPassword) {
      setError("新密碼不能與舊密碼相同");
      return;
    }

    setIsProcessing(true);

    try {
      // Call the onSuccess callback to re-encrypt all data
      await onSuccess(oldPassword, newPassword);

      // Update password configuration
      savePasswordConfig(hint || undefined);

      // Update password cache
      const context = getPasswordContext(walletAddress, userId);
      passwordCache.clear(context); // Clear old password
      passwordCache.set(context, newPassword); // Set new password

      // Clear form
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setHint("");
      setError(undefined);

      onClose();
    } catch (err: any) {
      console.error("[PasswordResetDialog] Reset failed:", err);
      
      // Handle specific errors
      if (err.message?.includes("解密失敗") || err.message?.includes("Invalid key")) {
        setError("舊密碼錯誤，無法解密現有數據");
      } else if (err.message?.includes("沒有數據") || err.message?.includes("No data")) {
        setError("沒有需要重新加密的數據");
      } else {
        setError(err.message || "密碼重置失敗，請重試");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setHint("");
      setError(undefined);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => isProcessing && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("password.resetTitle", "重置加密密碼")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "password.resetDescription",
              "更改您的加密密碼。所有數據將使用新密碼重新加密。"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
              {t(
                "password.resetWarning",
                "⚠️ 此操作將重新加密所有本地數據。請確保輸入正確的舊密碼，否則數據可能無法恢復。"
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="old-password">{t("password.oldPassword", "舊密碼")} *</Label>
            <div className="relative">
              <Input
                id="old-password"
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  setError(undefined);
                }}
                placeholder={t("password.enterOldPassword", "輸入您的舊密碼")}
                className="pr-10"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isProcessing}
              >
                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t("password.newPassword", "新密碼")} *</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(undefined);
                }}
                placeholder={t("password.passwordPlaceholder", "至少 8 個字符，包含字母和數字/符號")}
                className="pr-10"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isProcessing}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">{t("password.confirmNewPassword", "確認新密碼")} *</Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(undefined);
                }}
                placeholder={t("password.confirmPasswordPlaceholder", "再次輸入新密碼")}
                className="pr-10"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isProcessing}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hint">{t("password.newHint", "新密碼提示")} (可選)</Label>
            <Input
              id="hint"
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder={t("password.hintPlaceholder", "幫助您記住密碼的提示（不要包含密碼本身）")}
              maxLength={100}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              {t("password.hintDescription", "提示會以明文儲存，請勿包含密碼本身或敏感信息")}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            {t("common.cancel", "取消")}
          </Button>
          <Button
            type="button"
            onClick={handleReset}
            disabled={!oldPassword || !newPassword || !confirmPassword || isProcessing}
            className="w-full sm:w-auto"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing 
              ? t("password.resetting", "重置中...") 
              : t("password.resetPassword", "重置密碼")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

