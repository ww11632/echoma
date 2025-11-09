import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wallet, CheckCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WalletConnect = () => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState("");

  // TODO: Replace with actual Sui wallet integration
  const handleConnect = async () => {
    try {
      // Simulate wallet connection
      // Replace with: @mysten/wallet-adapter or similar
      const mockAddress = "0x" + Math.random().toString(16).substr(2, 40);
      setAddress(mockAddress);
      setIsConnected(true);
      
      toast({
        title: "Wallet Connected! 🎉",
        description: "You can now record and mint emotion NFTs.",
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Please make sure you have a Sui wallet installed.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    setAddress("");
    setIsConnected(false);
    toast({
      title: "Wallet Disconnected",
      description: "Come back anytime to continue your journey.",
    });
  };

  if (isConnected) {
    return (
      <Card className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium">Connected</p>
            <p className="text-xs text-muted-foreground font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="text-muted-foreground hover:text-foreground"
        >
          Disconnect
        </Button>
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
          <h3 className="font-semibold">Connect Sui Wallet</h3>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to start recording emotions and minting NFTs on Sui blockchain.
          </p>
        </div>
      </div>

      <Button
        onClick={handleConnect}
        className="w-full gradient-emotion hover:opacity-90"
        size="lg"
      >
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>

      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>Don't have a Sui wallet?</p>
        <a
          href="https://docs.sui.io/guides/developer/getting-started/sui-install"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-secondary hover:underline"
        >
          Learn how to set up <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </Card>
  );
};

export default WalletConnect;
