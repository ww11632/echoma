/**
 * Password Setup Dialog
 * Shown on first use to guide users to set up their encryption password
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
import { Eye, EyeOff, Lock, Info } from "lucide-react";
import { validatePasswordStrength, savePasswordConfig, passwordCache, getPasswordContext } from "@/lib/userPassword";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

interface PasswordSetupDialogProps {
  open: boolean;
  onComplete: (password: string) => void;
  onSkip?: () => void;
  walletAddress?: string | null;
  userId?: string | null;
}

export function PasswordSetupDialog({
  open,
  onComplete,
  onSkip,
  walletAddress,
  userId,
}: PasswordSetupDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hint, setHint] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>();

  const handleSetup = () => {
    // Validate password
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致");
      return;
    }

    // Save configuration (not the password itself)
    try {
      savePasswordConfig(hint || undefined);
      
      // Cache password for current session
      const context = getPasswordContext(walletAddress, userId);
      passwordCache.set(context, password);
      
      // Clear form
      setPassword("");
      setConfirmPassword("");
      setHint("");
      setError(undefined);
      
      // Notify parent
      onComplete(password);
    } catch (err: any) {
      setError(err.message || "設置失敗，請重試");
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("password.setupTitle", "設置加密密碼")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "password.setupDescription",
              "為了保護您的情緒記錄，請設置一個強密碼。密碼將用於加密您的數據，不會被儲存或上傳。"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t(
                "password.setupWarning",
                "⚠️ 重要：請務必記住您的密碼！如果忘記密碼，將無法解密您的數據。建議使用密碼管理器或記下密碼提示。"
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password.password", "密碼")} *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(undefined);
                }}
                placeholder={t("password.passwordPlaceholder", "至少 8 個字符，包含字母和數字/符號")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            <PasswordStrengthIndicator password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("password.confirmPassword", "確認密碼")} *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(undefined);
                }}
                placeholder={t("password.confirmPasswordPlaceholder", "再次輸入密碼")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hint">{t("password.hint", "密碼提示")} (可選)</Label>
            <Input
              id="hint"
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder={t("password.hintPlaceholder", "幫助您記住密碼的提示（不要包含密碼本身）")}
              maxLength={100}
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
          {onSkip && (
            <Button type="button" variant="ghost" onClick={handleSkip} className="w-full sm:w-auto">
              {t("password.skipSetup", "暫時跳過")}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSetup}
            disabled={!password || !confirmPassword}
            className="w-full sm:w-auto"
          >
            {t("password.completeSetup", "完成設置")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

