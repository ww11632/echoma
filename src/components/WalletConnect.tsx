import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wallet, CheckCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { useTranslation } from "react-i18next";

const WalletConnect = () => {
  const { toast } = useToast();
  const currentAccount = useCurrentAccount();
  const { t } = useTranslation();

  const handleDisconnect = () => {
    toast({
      title: t("wallet.disconnected"),
      description: t("wallet.disconnectedDesc"),
    });
  };

  if (currentAccount) {
    const address = currentAccount.address;
    return (
      <Card className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("wallet.connected")}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          </div>
        </div>
        <ConnectButton 
          connectText={t("common.disconnect")}
          className="text-muted-foreground hover:text-foreground"
        />
      </Card>
    );
  }

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full gradient-emotion flex items-center justify-center glow-primary">
          <Wallet className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold">{t("wallet.connectTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("wallet.connectDesc")}
          </p>
        </div>
      </div>

      <ConnectButton 
        connectText={
          <>
            <Wallet className="mr-2 h-4 w-4" />
            {t("wallet.connectButton")}
          </>
        }
        className="w-full gradient-emotion hover:opacity-90 h-11 text-base font-semibold"
      />

      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>{t("wallet.supports")}</p>
        <a
          href="https://docs.sui.io/guides/developer/getting-started/sui-install"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-secondary hover:underline"
        >
          {t("wallet.learnMore")} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </Card>
  );
};

export default WalletConnect;
