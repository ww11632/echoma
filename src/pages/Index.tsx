import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Lock, Shield, Database, Unlock } from "lucide-react";
import WalletConnect from "@/components/WalletConnect";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const features = [
    {
      icon: Lock,
      title: t("index.feature1Title"),
      description: t("index.feature1Desc"),
      color: "text-primary",
    },
    {
      icon: Database,
      title: t("index.feature2Title"),
      description: t("index.feature2Desc"),
      color: "text-secondary",
    },
    {
      icon: Shield,
      title: t("index.feature3Title"),
      description: t("index.feature3Desc"),
      color: "text-accent",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      
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
                {t("index.title")}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {t("index.subtitle")}
                <br />
                <span className="text-secondary">{t("index.subtitleHighlight1")}</span> meets{" "}
                <span className="text-primary">{t("index.subtitleHighlight2")}</span>.
              </p>
            </div>

            {/* Mode Selection Cards */}
            <div className="grid md:grid-cols-2 gap-6 pt-4 max-w-4xl mx-auto">
              {/* Anonymous Mode */}
              <Card className="glass-card p-6 space-y-4 hover:scale-105 transition-all duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary/30">
                  <Unlock className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold">{t("index.anonymousMode")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("index.anonymousModeDesc")}
                </p>
                <div className="space-y-2">
                  <Button
                    onClick={() => navigate("/record")}
                    className="w-full gradient-emotion hover:opacity-90 glow-primary"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("index.startRecording")}
                  </Button>
                  <Button
                    onClick={() => navigate("/timeline")}
                    variant="outline"
                    className="w-full glass-card hover:bg-primary/10"
                  >
                    {t("index.viewTimeline")}
                  </Button>
                </div>
              </Card>

              {/* Secure Mode */}
              <Card className="glass-card p-6 space-y-4 hover:scale-105 transition-all duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/30">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{t("index.secureMode")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("index.secureModeDesc")}
                </p>
                <div className="space-y-2">
                  <Button
                    onClick={() => navigate("/auth")}
                    className="w-full gradient-cool hover:opacity-90 glow-secondary"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    {t("index.signInSignUp")}
                  </Button>
                  <Button
                    onClick={() => navigate("/auth-timeline")}
                    variant="outline"
                    className="w-full glass-card hover:bg-secondary/10"
                  >
                    {t("index.viewSecureTimeline")}
                  </Button>
                </div>
              </Card>
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
            <h2 className="text-2xl font-bold text-center">{t("index.howItWorks")}</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { num: "1", text: t("index.step1") },
                { num: "2", text: t("index.step2") },
                { num: "3", text: t("index.step3") },
                { num: "4", text: t("index.step4") },
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
            <p className="text-sm text-muted-foreground">{t("index.builtFor")}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {(t("index.techStack", { returnObjects: true }) as string[]).map((tech) => (
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
