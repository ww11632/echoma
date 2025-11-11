import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Lock, Shield, Database, ArrowRight } from "lucide-react";
import WalletConnect from "@/components/WalletConnect";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Lock,
      title: "Client-Side Encryption",
      description: "Your emotions are encrypted before leaving your device",
      color: "text-primary",
    },
    {
      icon: Database,
      title: "Walrus Storage",
      description: "Decentralized, verifiable storage for your encrypted data",
      color: "text-secondary",
    },
    {
      icon: Shield,
      title: "Sui Blockchain",
      description: "NFT-based proof with on-chain verification",
      color: "text-accent",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
          <div className="text-center space-y-8 mb-16">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full gradient-emotion glow-primary animate-float mb-6">
              <Sparkles className="w-12 h-12 text-white" />
            </div>

            <div className="space-y-4">
              <h1 className="text-6xl font-bold tracking-tight">
                Echoma
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Your emotions, encrypted and preserved on-chain.
                <br />
                <span className="text-secondary">AI-powered analysis</span> meets{" "}
                <span className="text-primary">Web3 privacy</span>.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button
                onClick={() => navigate("/record")}
                size="lg"
                className="h-14 px-8 text-lg font-semibold gradient-emotion hover:opacity-90 glow-primary"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Start Recording
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => navigate("/timeline")}
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg glass-card hover:bg-primary/10"
              >
                View Timeline
              </Button>
            </div>
          </div>

          {/* Wallet Connect */}
          <div className="max-w-md mx-auto mb-16">
            <WalletConnect />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="glass-card p-6 space-y-4 hover:scale-105 transition-all duration-300 animate-float"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/30 ${feature.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* How It Works */}
          <Card className="mt-16 glass-card p-8 space-y-6">
            <h2 className="text-2xl font-bold text-center">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { num: "1", text: "Record your emotion with AI-assisted analysis" },
                { num: "2", text: "Client-side encryption protects your privacy" },
                { num: "3", text: "Upload encrypted data to Walrus storage" },
                { num: "4", text: "Mint verification NFT on Sui blockchain" },
              ].map((step, i) => (
                <div key={i} className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full gradient-cool text-white font-bold">
                    {step.num}
                  </div>
                  <p className="text-sm text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Tech Stack Badge */}
          <div className="mt-12 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Built for Haulout Hackathon</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {["Sui", "Walrus", "React", "AI Analysis"].map((tech) => (
                <span
                  key={tech}
                  className="px-4 py-2 rounded-full glass-card text-sm font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
