import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Key, Database, Shield, Trash2, RefreshCw, Download, AlertTriangle } from "lucide-react";
import { 
  hasPasswordSetup, 
  getPasswordConfig, 
  clearPasswordConfig,
  passwordCache,
  getPasswordContext 
} from "@/lib/userPassword";
import { getKeyParams, needsKeyMigration, CURRENT_KEY_VERSION } from "@/lib/keyVersioning";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { PasswordSetupDialog } from "@/components/PasswordSetupDialog";
import { reEncryptAllData, migrateKeyVersion } from "@/lib/dataMigration";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const currentAccount = useCurrentAccount();
  const [user, setUser] = useState<any>(null);

  // State
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [passwordSetupComplete, setPasswordSetupComplete] = useState(false);
  const [passwordConfig, setPasswordConfig] = useState<any>(null);
  const [keyParams, setKeyParams] = useState<any>(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Get user session
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Load password and key info
  useEffect(() => {
    loadPasswordInfo();
  }, [currentAccount, user]);

  const loadPasswordInfo = () => {
    const setupComplete = hasPasswordSetup();
    setPasswordSetupComplete(setupComplete);

    if (setupComplete) {
      const config = getPasswordConfig();
      setPasswordConfig(config);
    }

    const context = getPasswordContext(currentAccount?.address, user?.id);
    const params = getKeyParams(context);
    setKeyParams(params);

    const migration = needsKeyMigration(context);
    setNeedsMigration(migration);
  };

  const handlePasswordResetSuccess = async (oldPassword: string, newPassword: string) => {
    try {
      const result = await reEncryptAllData(
        oldPassword,
        newPassword,
        currentAccount?.address,
        user?.id
      );

      if (result.success) {
        toast({
          title: t("settings.password.resetSuccess"),
          description: t("settings.password.resetSuccessDesc", {
            private: result.privateRecordsProcessed,
            public: result.publicRecordsProcessed,
          }),
        });
        loadPasswordInfo();
      } else {
        throw new Error(result.errors.join(", "));
      }
    } catch (error: any) {
      console.error("[Settings] Password reset failed:", error);
      throw error;
    }
  };

  const handlePasswordSetupComplete = (password: string) => {
    setShowPasswordSetup(false);
    toast({
      title: t("password.setupTitle"),
      description: t("settings.password.setupSuccess"),
    });
    loadPasswordInfo();
  };

  const handleClearPasswordCache = () => {
    passwordCache.clearAll();
    toast({
      title: t("settings.cache.cleared"),
      description: t("settings.cache.clearedDesc"),
    });
    setShowClearCacheConfirm(false);
  };

  const handleMigration = async () => {
    if (!keyParams || !needsMigration) return;

    setIsMigrating(true);
    try {
      const context = getPasswordContext(currentAccount?.address, user?.id);
      const cachedPassword = passwordCache.get(context);

      const result = await migrateKeyVersion(
        keyParams.version,
        CURRENT_KEY_VERSION,
        cachedPassword || null,
        currentAccount?.address,
        user?.id
      );

      if (result.success) {
        toast({
          title: t("settings.migration.success"),
          description: t("settings.migration.successDesc", {
            private: result.privateRecordsProcessed,
            public: result.publicRecordsProcessed,
          }),
        });
        loadPasswordInfo();
      } else {
        throw new Error(result.errors.join(", "));
      }
    } catch (error: any) {
      console.error("[Settings] Migration failed:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("settings.migration.failed"),
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
      setShowMigrationDialog(false);
    }
  };

  const getKeyVersionBadge = (version: number) => {
    if (version === 1) {
      return <Badge variant="outline">V1 - {t("settings.keyVersion.derived")}</Badge>;
    } else if (version === 2) {
      return <Badge variant="default">V2 - {t("settings.keyVersion.password")}</Badge>;
    }
    return <Badge variant="secondary">V{version}</Badge>;
  };

  return (
    <div className="min-h-screen p-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Password Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              <CardTitle>{t("settings.password.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.password.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordSetupComplete ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t("settings.password.status")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.password.configured")}
                    </p>
                  </div>
                  <Badge variant="default">{t("settings.password.active")}</Badge>
                </div>

                {passwordConfig?.hint && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t("password.hintLabel")}
                    </p>
                    <p className="text-sm">{passwordConfig.hint}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordReset(true)}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("settings.password.reset")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t("settings.password.status")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.password.notConfigured")}
                    </p>
                  </div>
                  <Badge variant="outline">{t("settings.password.inactive")}</Badge>
                </div>

                <Button
                  variant="default"
                  onClick={() => setShowPasswordSetup(true)}
                  className="w-full"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {t("settings.password.setup")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Key Version Info */}
        {keyParams && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <CardTitle>{t("settings.keyVersion.title")}</CardTitle>
              </div>
              <CardDescription>{t("settings.keyVersion.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("settings.keyVersion.current")}</p>
                {getKeyVersionBadge(keyParams.version)}
              </div>

              {keyParams.createdAt && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.keyVersion.created")}
                  </p>
                  <p className="text-sm">
                    {new Date(keyParams.createdAt).toLocaleString()}
                  </p>
                </div>
              )}

              {needsMigration && (
                <div className="p-3 border border-yellow-500/50 bg-yellow-500/10 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                        {t("settings.migration.recommended")}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                        {t("settings.migration.recommendedDesc")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMigrationDialog(true)}
                        className="mt-2"
                      >
                        <RefreshCw className="h-3 w-3 mr-2" />
                        {t("settings.migration.start")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cache Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <CardTitle>{t("settings.cache.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.cache.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setShowClearCacheConfirm(true)}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("settings.cache.clear")}
            </Button>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-blue-700 dark:text-blue-400">
                {t("settings.security.title")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-600 dark:text-blue-400">
            <p>• {t("settings.security.passwordNotStored")}</p>
            <p>• {t("settings.security.cannotRecover")}</p>
            <p>• {t("settings.security.usePasswordManager")}</p>
            <p>• {t("settings.security.localDataOnly")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Password Reset Dialog */}
      <PasswordResetDialog
        open={showPasswordReset}
        onClose={() => setShowPasswordReset(false)}
        onSuccess={handlePasswordResetSuccess}
        walletAddress={currentAccount?.address}
        userId={user?.id}
      />

      {/* Password Setup Dialog */}
      <PasswordSetupDialog
        open={showPasswordSetup}
        onComplete={handlePasswordSetupComplete}
        onSkip={() => setShowPasswordSetup(false)}
        walletAddress={currentAccount?.address}
        userId={user?.id}
      />

      {/* Clear Cache Confirmation */}
      <AlertDialog open={showClearCacheConfirm} onOpenChange={setShowClearCacheConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.cache.clearConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.cache.clearConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearPasswordCache}>
              {t("settings.cache.clear")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Migration Confirmation */}
      <AlertDialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.migration.title")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{t("settings.migration.confirmDesc")}</p>
              
              {/* Backup Reminder */}
              <div className="p-3 border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-red-900 dark:text-red-100">
                    <strong>{t("settings.backupReminder.title", "⚠️ 重要：請先備份數據")}</strong>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li>{t("settings.backupReminder.step1", "建議先導出時間線中的所有記錄（CSV/JSON 格式）")}</li>
                      <li>{t("settings.backupReminder.step2", "如果密碼重置失敗，備份可以幫助您恢復數據")}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMigrating}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMigration} disabled={isMigrating}>
              {isMigrating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t("settings.migration.migrating")}
                </>
              ) : (
                t("settings.migration.start")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;

