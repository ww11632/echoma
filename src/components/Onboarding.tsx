import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

const ONBOARDING_STORAGE_KEY = "echoma_onboarding_completed";

interface OnboardingStep {
  title: string;
  description: string;
  image?: string;
  action?: {
    label: string;
    path: string;
  };
}

export const Onboarding = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 檢查是否已完成引導
    const hasCompleted = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
    
    // 只在首頁且未完成引導時顯示
    if (!hasCompleted && location.pathname === "/") {
      setIsOpen(true);
    }
  }, [location.pathname]);

  const steps: OnboardingStep[] = [
    {
      title: t("onboarding.welcome.title") || "歡迎使用 Echoma",
      description: t("onboarding.welcome.description") || "Echoma 是一個安全、私密的情緒記錄應用，幫助您追蹤和管理您的情感健康。",
    },
    {
      title: t("onboarding.record.title") || "記錄您的情緒",
      description: t("onboarding.record.description") || "選擇您當前的情緒、設置強度，並添加描述。您的數據會被加密儲存，確保隱私安全。",
    },
    {
      title: t("onboarding.timeline.title") || "查看時間線",
      description: t("onboarding.timeline.description") || "在時間線中查看所有記錄，使用搜尋和過濾功能快速找到您需要的記錄。",
    },
    {
      title: t("onboarding.ai.title") || "獲得 AI 建議",
      description: t("onboarding.ai.description") || "每次記錄後，您可以獲得個性化的 AI 分析建議，幫助您更好地理解和管理情緒。",
    },
    {
      title: t("onboarding.privacy.title") || "隱私保護",
      description: t("onboarding.privacy.description") || "所有數據都經過加密處理。您可以選擇本地儲存或上傳到區塊鏈（Walrus），完全由您控制。",
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setIsOpen(false);
    
    // 如果最後一步有操作，導航到該頁面
    if (steps[currentStep].action) {
      navigate(steps[currentStep].action!.path);
    }
  };

  const currentStepData = steps[currentStep];

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{currentStepData.title}</DialogTitle>
          <DialogDescription className="text-base pt-4">
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-center justify-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full gradient-emotion shadow-md">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Progress indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "w-8 bg-primary"
                    : index < currentStep
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          <p className="text-sm text-center text-muted-foreground">
            {t("onboarding.step", { current: currentStep + 1, total: steps.length }) || 
              `步驟 ${currentStep + 1} / ${steps.length}`}
          </p>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            {t("common.previous") || "上一步"}
          </Button>
          <div className="flex gap-2">
            {currentStep < steps.length - 1 ? (
              <>
                <Button variant="outline" onClick={handleSkip}>
                  {t("onboarding.skip") || "跳過"}
                </Button>
                <Button onClick={handleNext} className="gradient-emotion">
                  {t("common.next") || "下一步"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button onClick={handleComplete} className="gradient-emotion">
                {t("onboarding.getStarted") || "開始使用"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

