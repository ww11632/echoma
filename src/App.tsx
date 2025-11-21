import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { createNetworkConfig } from "@mysten/dapp-kit";
import React, { lazy, Suspense, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Onboarding } from "@/components/Onboarding";
import { useTranslation } from "react-i18next";
import "@mysten/dapp-kit/dist/index.css";
import { getCurrentNetwork } from "@/lib/networkConfig";
import { initializeKeyVersioning } from "@/lib/keyVersioning";
import { syncLabelsFromCloud } from "@/lib/accessLabelsSync";

// 程式碼分割：懶載入頁面組件
const Index = lazy(() => import("./pages/Index"));
const Record = lazy(() => import("./pages/Record"));
const Timeline = lazy(() => import("./pages/Timeline"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthRecord = lazy(() => import("./pages/AuthRecord"));
const AuthTimeline = lazy(() => import("./pages/AuthTimeline"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MvpRecord = lazy(() => import("./pages/MvpRecord"));
const MvpTimeline = lazy(() => import("./pages/MvpTimeline"));
const Settings = lazy(() => import("./pages/Settings"));

const queryClient = new QueryClient();

// 條件載入安全測試頁面（只在開發環境或特定環境變數下可用）
// 生產環境必須顯式允許，防止誤上線
const isSecurityTestsEnabled = 
  import.meta.env.DEV || 
  (import.meta.env.VITE_ENABLE_SECURITY_TESTS === "true" && !import.meta.env.PROD) ||
  (import.meta.env.VITE_ENABLE_SECURITY_TESTS === "true" && import.meta.env.PROD && import.meta.env.VITE_FORCE_ENABLE_SECURITY_TESTS === "true");
const SecurityTests = isSecurityTestsEnabled
  ? lazy(() => import("./pages/SecurityTests"))
  : null;

// Configure Sui network
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
});
const initialNetwork = getCurrentNetwork();

const LoadingFallback = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-muted-foreground">{t("common.loading")}</p>
      </div>
    </div>
  );
};

const App = () => {
  // Initialize key versioning and sync labels on app start
  useEffect(() => {
    initializeKeyVersioning();
    
    // Sync access control labels from cloud to localStorage
    syncLabelsFromCloud().catch(error => {
      console.error("[App] Failed to sync labels from cloud:", error);
    });
  }, []);
  
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={initialNetwork}>
        <WalletProvider autoConnect>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <MedicalDisclaimer />
            <BrowserRouter>
              <Onboarding />
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* Anonymous/Wallet Mode */}
              <Route path="/record" element={<Record />} />
              <Route path="/timeline" element={<Timeline />} />
              {/* Authenticated Mode */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth-record" element={<AuthRecord />} />
              <Route path="/auth-timeline" element={<AuthTimeline />} />
              {/* MVP local-only flow */}
              <Route path="/mvp" element={<MvpRecord />} />
              <Route path="/mvp-timeline" element={<MvpTimeline />} />
              {/* Settings */}
              <Route path="/settings" element={<Settings />} />
              {/* Security Tests - 只在开发环境或 VITE_ENABLE_SECURITY_TESTS=true 时可用 */}
              {SecurityTests && (
                <Route 
                  path="/security-tests" 
                  element={
                    <Suspense fallback={<div>Loading...</div>}>
                      <SecurityTests />
                    </Suspense>
                  } 
                />
              )}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
