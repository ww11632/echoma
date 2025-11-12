import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { createNetworkConfig } from "@mysten/dapp-kit";
import Index from "./pages/Index";
import Record from "./pages/Record";
import Timeline from "./pages/Timeline";
import Auth from "./pages/Auth";
import AuthRecord from "./pages/AuthRecord";
import AuthTimeline from "./pages/AuthTimeline";
import NotFound from "./pages/NotFound";
import MvpRecord from "./pages/MvpRecord";
import MvpTimeline from "./pages/MvpTimeline";
import SecurityTests from "./pages/SecurityTests";
import "@mysten/dapp-kit/dist/index.css";

const queryClient = new QueryClient();

// Configure Sui network
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
      <WalletProvider autoConnect>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              {/* Security Tests */}
              <Route path="/security-tests" element={<SecurityTests />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </SuiClientProvider>
  </QueryClientProvider>
);

export default App;
