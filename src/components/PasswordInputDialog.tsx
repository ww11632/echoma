/**
 * Password Input Dialog
 * Prompts user to enter their encryption password for sensitive operations
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
import { getPasswordConfig } from "@/lib/userPassword";

interface PasswordInputDialogProps {
  open: boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function PasswordInputDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
}: PasswordInputDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const config = getPasswordConfig();

  const handleConfirm = () => {
    if (!password) return;
    
    onConfirm(password);
    setPassword("");
  };

  const handleCancel = () => {
    setPassword("");
    onCancel();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && password) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {title || t("password.inputTitle", "輸入密碼")}
          </DialogTitle>
          <DialogDescription>
            {description || t("password.inputDescription", "請輸入您的加密密碼以繼續")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {config.hint && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <span className="font-medium">{t("password.hintLabel", "密碼提示：")} </span>
                {config.hint}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="input-password">{t("password.password", "密碼")}</Label>
            <div className="relative">
              <Input
                id="input-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t("password.enterPassword", "輸入您的密碼")}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("common.cancel", "取消")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!password}>
            {t("common.confirm", "確認")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

