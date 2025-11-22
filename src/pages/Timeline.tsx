import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home, Sparkles, Shield, Clock, Lock, Unlock, Loader2, BookOpen, BarChart3, Filter, Eye, EyeOff, Search, Download, ArrowUpDown, X, MoreVertical, Trash2, Calendar as CalendarIcon, CheckSquare, Square, TrendingUp, Link2, Users } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { supabase } from "@/integrations/supabase/client";
import { listEmotionRecords, initializeEncryptedStorage, listEmotionRecordsWithAllKeys, deleteEmotionRecord } from "@/lib/localIndex";
import { getEmotions, getEmotionsByWallet, getEncryptedEmotionByBlob } from "@/lib/api";
import { queryWalrusBlobsByOwner, getWalrusUrl, readFromWalrus, extractBlobIdFromUrl, isValidBlobId } from "@/lib/walrus";
import { queryEntryNFTsByOwner, getOrQueryPolicyRegistry, isPublicSeal, checkIfMintedWithSealPolicies } from "@/lib/mintContract";
import { getClientForNetwork } from "@/lib/suiClient";
import { decryptData, decryptDataWithMigration, generateUserKey, generateUserKeyFromId, DecryptionError, DecryptionErrorType, PUBLIC_SEAL_KEY } from "@/lib/encryption";
import type { EncryptedData } from "@/lib/encryption";
import { getAnonymousUserKey, getOrCreateAnonymousUserKey } from "@/lib/anonymousIdentity";
import GlobalControls from "@/components/GlobalControls";
import { AccessControlManager } from "@/components/AccessControlManager";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import jsPDF from "jspdf";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { useNetworkChangeListener } from "@/hooks/useNetworkChangeListener";
import { extractNetworkFromWalrusUrl } from "@/lib/networkConfig";

interface EmotionRecord {
  id: string;
  emotion: string;
  intensity: number;
  description: string;
  blob_id: string;
  walrus_url: string;
  payload_hash: string;
  is_public: boolean;
  proof_status: "pending" | "confirmed" | "failed";
  sui_ref: string | null;
  created_at: string;
  wallet_address?: string | null;
  encrypted_data?: string | null;
  tags?: string[];
  transaction_digest?: string | null; // NFT 鑄造交易的 digest
}

type FilterType = "all" | "local" | "walrus" | "sealPolicies";
type SortBy = "date" | "intensity" | "emotion";
type SortOrder = "asc" | "desc";
type ViewPeriod = "week" | "month" | "year";

const Timeline = () => {
  const SUPABASE_ENABLED = Boolean(
    import.meta.env.VITE_ENABLE_SUPABASE !== "false" &&
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const network = useSelectedNetwork();
  const isTestnet = network === "testnet";
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<any>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  
  // 虛擬滾動容器引用
  const parentRef = useRef<HTMLDivElement>(null);
  
  // 批量操作狀態
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 日期範圍過濾
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>();
  
  // 視圖切換（周/月/年）
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("week");
  
  // 刪除確認對話框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<EmotionRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 記錄詳情對話框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<EmotionRecord | null>(null);
  
  // 訪問權限管理對話框
  const [accessControlDialogOpen, setAccessControlDialogOpen] = useState(false);
  const [selectedRecordForAccessControl, setSelectedRecordForAccessControl] = useState<EmotionRecord | null>(null);
  const selectedRecordNetwork = selectedRecordForAccessControl
    ? extractNetworkFromWalrusUrl(selectedRecordForAccessControl.walrus_url) || network
    : network;
  
  // 導出格式選擇對話框
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf" | "markdown">("csv");
  const [recordsToExport, setRecordsToExport] = useState<EmotionRecord[]>([]);
  const [descriptionsToExport, setDescriptionsToExport] = useState<Record<string, string>>({});
  
  // 自定義導出格式配置
  const [customExportFields, setCustomExportFields] = useState({
    date: true,
    emotion: true,
    intensity: true,
    description: true,
    storage: true,
    privacy: true,
    status: true,
    suiRef: false,
    transactionDigest: false,
  });
  const [dateFormat, setDateFormat] = useState<"locale" | "iso" | "custom">("locale");
  
  // Seal Access Policies 过滤：跟踪哪些记录有访问策略
  const [recordsWithSealPolicies, setRecordsWithSealPolicies] = useState<Set<string>>(new Set());
  const [checkingSealPolicies, setCheckingSealPolicies] = useState(false);
  const checkingSealPoliciesRef = useRef(false);

  const emotionLabels = {
    joy: { label: t("emotions.joy"), emoji: "😊", gradient: "from-yellow-400 to-orange-400", color: "#fbbf24" },
    sadness: { label: t("emotions.sadness"), emoji: "😢", gradient: "from-blue-400 to-indigo-400", color: "#60a5fa" },
    anger: { label: t("emotions.anger"), emoji: "😠", gradient: "from-red-400 to-rose-400", color: "#f87171" },
    anxiety: { label: t("emotions.anxiety"), emoji: "😰", gradient: "from-purple-400 to-pink-400", color: "#a78bfa" },
    confusion: { label: t("emotions.confusion"), emoji: "🤔", gradient: "from-gray-400 to-slate-400", color: "#94a3b8" },
    peace: { label: t("emotions.peace"), emoji: "✨", gradient: "from-green-400 to-teal-400", color: "#34d399" },
    encrypted: { label: t("timeline.encryptedEmotion"), emoji: "🔒", gradient: "from-slate-400 to-gray-500", color: "#94a3b8" },
  };
  const [records, setRecords] = useState<EmotionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueryingOnChain, setIsQueryingOnChain] = useState(false);
  const [decryptingRecords, setDecryptingRecords] = useState<Set<string>>(new Set());
  const [decryptedDescriptions, setDecryptedDescriptions] = useState<Record<string, string>>({});
  const [decryptedAiResponses, setDecryptedAiResponses] = useState<Record<string, string>>({});
  const [decryptedEmotions, setDecryptedEmotions] = useState<Record<string, string>>({});
  const [decryptErrors, setDecryptErrors] = useState<Record<string, string>>({});
  // Track failed auto-decrypt attempts to avoid infinite retries
  const [failedAutoDecrypts, setFailedAutoDecrypts] = useState<Set<string>>(new Set());
  const [isDecryptingAll, setIsDecryptingAll] = useState(false);
  const [decryptErrorDetails, setDecryptErrorDetails] = useState<Record<string, {
    type: string;
    message: string;
    statusCode?: number;
    blobId?: string;
    timestamp: string;
    suggestions: string[];
  }>>({});
  const [expandedErrorDetails, setExpandedErrorDetails] = useState<Set<string>>(new Set());
  const sortRecordsByDate = useCallback((items: EmotionRecord[]) => {
    return [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, []);

  const getSupabaseSessionSafe = useCallback(async () => {
    if (!SUPABASE_ENABLED) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.warn("[Timeline] Failed to get Supabase session (disabled or unreachable):", error);
      return null;
    }
  }, [SUPABASE_ENABLED]);

  // Get current session
  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    }).catch((error) => {
      console.warn("[Timeline] Failed to init Supabase session:", error);
      setSession(null);
    });
  }, [SUPABASE_ENABLED]);

  // 網路狀態檢測
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: t("timeline.online") || "網路已連接",
        description: t("timeline.onlineDesc") || "您可以繼續使用所有功能。",
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: t("timeline.offline") || "網路已斷開",
        description: t("timeline.offlineDesc") || "您只能查看已載入的記錄。",
        variant: "default",
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, t]);

  // 鍵盤快捷鍵支援
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: 聚焦搜尋框
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + N: 新建記錄
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        navigate('/record');
      }
      // Escape: 清除搜尋
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  useEffect(() => {
    // 使用一个标志来跟踪这个 effect 是否仍然有效
    let isCancelled = false;
    const currentNetworkSnapshot = network; // 捕获当前的网络值
    const currentAccountSnapshot = currentAccount; // 捕获当前的账户值

    const loadRecords = async () => {
      setIsLoading(true);
      const allRecords: EmotionRecord[] = [];
      let supabaseSession: any = null;

      try {
        // 检查是否已被取消（网络或账户已切换）
        if (isCancelled) {
          console.log("[Timeline] Load cancelled due to network/account change");
          return;
        }
        // 1. 嘗試從本地儲存載入記錄
        try {
          // 再次检查是否已被取消
          if (isCancelled) return;
          
          // Try to load records with all possible keys (handles account switching)
          // This function will automatically try Supabase session, anonymous ID, and wallet address
          const localRecords = await listEmotionRecordsWithAllKeys(currentAccountSnapshot?.address);
          
          // Check if there's a decryption warning
          if ((localRecords as any).__decryptionWarning) {
            // Show user-friendly warning about potential data loss
            toast({
              title: t("timeline.localStorage.keyMismatchTitle"),
              description: t("timeline.localStorage.keyMismatchDesc"),
              variant: "default",
            });
          }
          
          const convertedLocalRecords: EmotionRecord[] = localRecords.map((r) => ({
            id: r.id,
            emotion: r.emotion,
            intensity: r.intensity ?? 50, // 使用儲存的強度值，如果沒有則使用預設值 50
            description: r.note,
            blob_id: `local_${r.id.slice(0, 8)}`,
            walrus_url: `local://${r.id}`,
            payload_hash: "",
            is_public: r.isPublic ?? false,
            proof_status: "pending" as const,
            sui_ref: null,
            created_at: r.timestamp,
            wallet_address: null,
          }));
          allRecords.push(...convertedLocalRecords);
        } catch (localError) {
          console.log("[Timeline] No local records or error loading:", localError);
        }

        // 2. 嘗試從 API 載入記錄（無論是否有錢包）
        if (SUPABASE_ENABLED) {
          try {
            const session = await getSupabaseSessionSafe();
            supabaseSession = session;
            if (session) {
              // 如果有 Supabase session，使用 Supabase function
              try {
                const response = await supabase.functions.invoke('get-emotions');
                if (!response.error && response.data?.success) {
                  const convertedRecords: EmotionRecord[] = response.data.records.map((r: any) => {
                    // 如果 blob_id 或 walrus_url 是 null/undefined，視為本地記錄
                    const hasWalrusData = r.blob_id && r.walrus_url;
                    const isLocal = !hasWalrusData || 
                                  r.walrus_url?.startsWith("local://") || 
                                  r.blob_id?.startsWith("local_");
                    
                    // 為沒有 Walrus 資料的記錄生成本地 ID
                    const blobId = hasWalrusData 
                      ? r.blob_id 
                      : `local_${r.id.slice(0, 8)}`;
                    
                    const walrusUrl = hasWalrusData
                      ? r.walrus_url
                      : `local://${r.id}`;
                    
                    console.log(`[Timeline] Processing record ${r.id}:`, {
                      hasWalrusData,
                      isLocal,
                      blob_id: blobId,
                      walrus_url: walrusUrl
                    });
                    
                    return {
                      id: r.id,
                      emotion: r.emotion || "encrypted",
                      intensity: r.intensity || 50,
                      description: r.description,
                      blob_id: blobId,
                      walrus_url: walrusUrl,
                      payload_hash: r.payload_hash || "",
                      is_public: r.is_public || false,
                      proof_status: r.proof_status || "pending",
                      sui_ref: r.sui_ref || null,
                      created_at: r.created_at || r.timestamp,
                      wallet_address: r.wallet_address || null,
                      encrypted_data: r.encrypted_data || null,
                      transaction_digest: r.transaction_digest || null,
                    };
                  });
                  allRecords.push(...convertedRecords);
                }
              } catch (supabaseFuncError) {
                console.log("[Timeline] Supabase function error:", supabaseFuncError);
                // 如果 Supabase function 失敗，嘗試使用直接 API 呼叫
                try {
                  const apiRecords = await getEmotions(session.access_token);
                  const convertedApiRecords: EmotionRecord[] = apiRecords.map((r: any) => {
                    // 如果 blob_id 或 walrus_url 是 null/undefined，視為本地記錄
                    const hasWalrusData = r.blob_id && r.walrus_url;
                    const isLocal = !hasWalrusData || 
                                  r.walrus_url?.startsWith("local://") || 
                                  r.blob_id?.startsWith("local_");
                    
                    // 為沒有 Walrus 資料的記錄生成本地 ID
                    const blobId = hasWalrusData 
                      ? r.blob_id 
                      : `local_${r.id.slice(0, 8)}`;
                    
                    const walrusUrl = hasWalrusData
                      ? r.walrus_url
                      : `local://${r.id}`;
                    
                    return {
                      id: r.id,
                      emotion: r.emotion || "encrypted",
                      intensity: r.intensity || 50,
                      description: r.description,
                      blob_id: blobId,
                      walrus_url: walrusUrl,
                      payload_hash: r.payload_hash || "",
                      is_public: r.is_public || false,
                      proof_status: r.proof_status || "pending",
                      sui_ref: r.sui_ref || null,
                      created_at: r.created_at || r.timestamp,
                      wallet_address: r.wallet_address || null,
                      transaction_digest: r.transaction_digest || null,
                    };
                  });
                  allRecords.push(...convertedApiRecords);
                } catch (apiError) {
                  console.log("[Timeline] API error (expected if server not running):", apiError);
                }
              }
            }
          } catch (supabaseError) {
            console.log("[Timeline] Supabase error:", supabaseError);
          }
        } else {
          console.log("[Timeline] Supabase disabled; skipping remote record load");
        }
          
          // 如果有錢包連接，嘗試查詢鏈上的 Walrus blob 物件
          if (currentAccountSnapshot?.address) {
            // 再次检查是否已被取消
            if (isCancelled) return;
            
            console.log("[Timeline] Wallet connected, querying on-chain blobs for:", currentAccountSnapshot.address);
            try {
              setIsQueryingOnChain(true);
              console.log("[Timeline] Querying on-chain Walrus blobs for address:", currentAccountSnapshot.address);
              console.log("[Timeline] Environment check:", {
                hasSession: !!supabaseSession,
                hasWallet: !!currentAccountSnapshot,
                walletAddress: currentAccountSnapshot.address,
                network: currentNetworkSnapshot,
                apiBase: import.meta.env.VITE_API_BASE || "http://localhost:3001"
              });
              
              // 顯示開始查詢的 toast
              toast({
                title: t("timeline.queryingOnChain"),
                description: t("timeline.queryingOnChainDesc"),
              });
                
                const onChainBlobs = await queryWalrusBlobsByOwner(currentAccountSnapshot.address, currentNetworkSnapshot);
                console.log(`[Timeline] Found ${onChainBlobs.length} on-chain Walrus blobs`);
                console.log(`[Timeline] On-chain blob IDs:`, onChainBlobs.map(b => b.blobId));
                
                // Log existing records before merging
                console.log(`[Timeline] Existing records before on-chain merge:`, allRecords.length);
                console.log(`[Timeline] Existing blob_ids:`, allRecords.map(r => r.blob_id).filter(Boolean));
                
                // 顯示查詢完成的 toast
                if (onChainBlobs.length > 0) {
                  toast({
                    title: t("timeline.queryCompleted"),
                    description: t("timeline.queryCompletedDesc", { count: onChainBlobs.length }),
                  });
                }

                // 將鏈上的 blob 轉換為記錄
                let addedCount = 0;
                let updatedCount = 0;
                for (const blob of onChainBlobs) {
                  // 檢查是否已經存在（透過 blob_id 或 sui_ref）
                  // 優先通過 blob_id 匹配（最可靠），因為 blob_id 是唯一的
                  // 注意：相同 blob_id 在不同網絡上應該視為不同記錄，但通常同一錢包在同一網絡查詢
                  const blobNetwork = extractNetworkFromWalrusUrl(getWalrusUrl(blob.blobId, currentNetworkSnapshot));
                  const existing = allRecords.find(r => {
                    // 優先通過 blob_id 匹配（最可靠）
                    if (r.blob_id === blob.blobId) {
                      // 如果 blob_id 相同，檢查網絡是否匹配
                      const recordNetwork = extractNetworkFromWalrusUrl(r.walrus_url);
                      // 如果兩個網絡都明確且相同，則匹配
                      if (blobNetwork && recordNetwork && blobNetwork === recordNetwork) {
                        return true;
                      }
                      // 如果網絡不明確，但在當前查詢的網絡下，也視為匹配
                      // 這處理了數據庫記錄可能沒有明確網絡信息的情況
                      if (!blobNetwork || !recordNetwork) {
                        return true; // blob_id 相同就視為同一記錄
                      }
                      // 如果網絡明確但不同，則不匹配（不同網絡的相同 blob_id 視為不同記錄）
                      return false;
                    }
                    // 通過 sui_ref 匹配（同一對象）
                    if (r.sui_ref === blob.objectId) return true;
                    // 通過 id 匹配（如果記錄的 id 就是 objectId）
                    if (r.id === blob.objectId) return true;
                    return false;
                  });

                  if (!existing) {
                    // 創建新的鏈上記錄
                    // 注意：鏈上記錄可能沒有 emotion/intensity 等資訊，這些在加密的 blob 中
                    // 我們可以嘗試從 blob 讀取，或使用預設值
                    // 使用 objectId 本身作為 id，確保唯一性
                    const onChainRecord: EmotionRecord = {
                      id: blob.objectId, // 使用 objectId 本身，確保唯一性
                      emotion: "encrypted", // 加密資料尚未解密前提示為已加密
                      intensity: 50, // 預設值
                      description: "", // 加密內容，需要解密才能顯示
                      blob_id: blob.blobId,
                      walrus_url: getWalrusUrl(blob.blobId, currentNetworkSnapshot),
                      payload_hash: "",
                      is_public: false,
                      proof_status: "confirmed", // 鏈上記錄肯定是已確認的
                      sui_ref: blob.objectId,
                      created_at: blob.createdAt || new Date().toISOString(),
                      wallet_address: currentAccountSnapshot?.address || null,
                    };
                    allRecords.push(onChainRecord);
                    addedCount++;
                    console.log(`[Timeline] ✅ Added on-chain record:`, {
                      blobId: blob.blobId,
                      objectId: blob.objectId,
                      walrusUrl: getWalrusUrl(blob.blobId, currentNetworkSnapshot),
                      existingBlobIds: allRecords.filter(r => r.blob_id === blob.blobId).map(r => ({ id: r.id, blob_id: r.blob_id, sui_ref: r.sui_ref }))
                    });
                  } else {
                    console.log(`[Timeline] 🔄 Found existing record for blob ${blob.blobId}:`, {
                      existingId: existing.id,
                      existingBlobId: existing.blob_id,
                      existingSuiRef: existing.sui_ref,
                      chainObjectId: blob.objectId
                    });
                    let updated = false;
                    if (!existing.sui_ref && blob.objectId) {
                      existing.sui_ref = blob.objectId;
                      updated = true;
                    }
                    if (blob.createdAt) {
                      const existingTime = new Date(existing.created_at).getTime();
                      const chainTime = new Date(blob.createdAt).getTime();
                      if (!Number.isNaN(chainTime) && existingTime !== chainTime) {
                        existing.created_at = blob.createdAt;
                        updated = true;
                      }
                    }
                    if (currentAccountSnapshot?.address && !existing.wallet_address) {
                      existing.wallet_address = currentAccountSnapshot.address;
                      updated = true;
                    }
                    if (updated) {
                      existing.proof_status = "confirmed";
                      updatedCount++;
                      console.log(`[Timeline] Synced on-chain metadata for record ${existing.id}:`, {
                        blobId: blob.blobId,
                        objectId: blob.objectId,
                        created_at: existing.created_at,
                      });
                    }
                  }
                }
                
                console.log(`[Timeline] On-chain merge complete: added ${addedCount}, updated ${updatedCount}, total records ${allRecords.length}`);
              } catch (onChainError) {
                console.error("[Timeline] Error querying on-chain Walrus blobs:", onChainError);
                // 顯示查詢失敗的 toast
                toast({
                  title: t("timeline.queryFailed"),
                  description: t("timeline.queryFailedDesc"),
                  variant: "destructive",
                });
                // 不阻止其他記錄的載入
              } finally {
                setIsQueryingOnChain(false);
              }
              
              // 4. 查詢 EntryNFT（如果錢包已連接）
              try {
                // 再次检查是否已被取消
                if (isCancelled) return;
                
                console.log("[Timeline] Querying EntryNFTs for address:", currentAccountSnapshot.address, "on network:", currentNetworkSnapshot);
                const entryNFTs = await queryEntryNFTsByOwner(currentAccountSnapshot.address, currentNetworkSnapshot);
                console.log(`[Timeline] Found ${entryNFTs.length} EntryNFTs`);
                
                let nftAddedCount = 0;
                let nftUpdatedCount = 0;
                
                for (const nft of entryNFTs) {
                  // 從 NFT 中提取 blob_id（優先使用 mintContract 返回的 blobId，然後嘗試 image/audio URL）
                  const blobIdFromNft =
                    nft.blobId ||
                    extractBlobIdFromUrl(nft.imageUrl) ||
                    extractBlobIdFromUrl(nft.audioUrl);
                  
                  // 如果 imageUrl/audioUrl 不是標準的 Walrus URL，使用標準聚合器 URL 替換，確保網絡信息一致
                  const nftNetwork = extractNetworkFromWalrusUrl(nft.imageUrl) ||
                                     extractNetworkFromWalrusUrl(nft.audioUrl) ||
                                     currentNetworkSnapshot;
                  const walrusUrlFromNft = blobIdFromNft
                    ? getWalrusUrl(blobIdFromNft, nftNetwork)
                    : (nft.imageUrl || nft.audioUrl || "");
                  
                  console.log(`[Timeline] Processing EntryNFT ${nft.nftId}, blobIdFromNft: ${blobIdFromNft}, imageUrl: ${nft.imageUrl}, audioUrl: ${nft.audioUrl}, walrusUrlFromNft: ${walrusUrlFromNft}`);
                  
                  // 檢查是否已經存在（優先通過 sui_ref 或 id 匹配 NFT ID，然後通過 blob_id 匹配）
                  // 情況1：數據庫記錄的 sui_ref 指向這個 NFT（r.sui_ref === nft.nftId）
                  // 情況2：數據庫記錄的 id 就是這個 NFT ID（r.id === nft.nftId）
                  // 情況3：通過 blob_id 匹配（EntryNFT 和 Blob 引用同一個 blob_id，應該合併為一條記錄）
                  const existing = allRecords.find(r => {
                    // 通過 sui_ref 或 id 匹配（同一對象，不需要考慮網絡）
                    if (r.id === nft.nftId || r.sui_ref === nft.nftId) {
                      console.log(`[Timeline] EntryNFT ${nft.nftId} matched by id/sui_ref: ${r.id}`);
                      return true;
                    }
                    // 通過 walrus_url 完全匹配
                    if (walrusUrlFromNft && (r.walrus_url === walrusUrlFromNft || r.walrus_url === nft.imageUrl || r.walrus_url === nft.audioUrl)) {
                      console.log(`[Timeline] EntryNFT ${nft.nftId} matched by walrus_url: ${r.walrus_url}`);
                      return true;
                    }
                    // 通過 blob_id 匹配（最關鍵：EntryNFT 和 Blob 引用同一個 blob_id）
                    // 如果 blob_id 相同，就視為同一記錄，不需要嚴格檢查網絡（因為同一錢包在同一網絡查詢）
                    if (blobIdFromNft && r.blob_id === blobIdFromNft) {
                      console.log(`[Timeline] EntryNFT ${nft.nftId} matched by blob_id: ${blobIdFromNft}, existing record: ${r.id} (blob_id: ${r.blob_id}, sui_ref: ${r.sui_ref})`);
                      // blob_id 相同就視為同一記錄，優先使用 EntryNFT（因為有更多信息）
                      return true;
                    }
                    return false;
                  });
                  
                  if (!existing) {
                    // 將 moodScore (1-10) 轉換為 intensity (0-100)
                    const intensity = Math.min(100, Math.max(0, (nft.moodScore / 10) * 100));
                    
                    // 解析標籤
                    const tags = nft.tagsCsv ? nft.tagsCsv.split(",").map(t => t.trim()).filter(Boolean) : [];
                    
                    // 創建 NFT 記錄
                    // 注意：NFT 中沒有存儲 emotion 類型，只有 mood_text
                    // 使用 "encrypted" 表示這是加密記錄（雖然 NFT 中 mood_text 是明文，但為了與其他記錄一致）
                    // 優先使用從鏈上獲取的 transaction_digest，如果沒有則為 null（可能從數據庫獲取）
                    const nftRecord: EmotionRecord = {
                      id: nft.nftId, // 使用 NFT ID 作為唯一標識
                      emotion: "encrypted", // NFT 中沒有存儲 emotion 類型，使用 "encrypted" 表示需要從描述推斷
                      intensity: intensity,
                      description: nft.moodText || "", // NFT 中存儲的 mood_text（這是描述，不是 emotion 類型）
                      blob_id: blobIdFromNft || `nft_${nft.nftId.slice(0, 8)}`, // 使用從 URL 提取的 blob ID，或生成 NFT 前綴的 ID
                      walrus_url: walrusUrlFromNft, // 使用標準化後的 Walrus URL，確保與 blob 對象一致
                      payload_hash: "",
                      is_public: false,
                      proof_status: "confirmed", // NFT 肯定是已確認的
                      sui_ref: nft.nftId,
                      created_at: nft.timestamp,
                      wallet_address: currentAccountSnapshot?.address || null,
                      tags: tags.length > 0 ? tags : undefined,
                      transaction_digest: nft.transactionDigest || null, // 從鏈上 NFT 對象的 previousTransaction 獲取
                    };
                    
                    allRecords.push(nftRecord);
                    nftAddedCount++;
                    console.log(`[Timeline] ✅ Added EntryNFT record:`, {
                      nftId: nft.nftId,
                      moodScore: nft.moodScore,
                      intensity,
                      timestamp: nft.timestamp,
                    });
                  } else {
                    // 更新現有記錄的 NFT 信息
                    // 如果現有記錄是 Blob 記錄（通過 blob_id 匹配，且 id === sui_ref），
                    // 應該刪除 Blob 記錄，用 EntryNFT 記錄替換（因為 EntryNFT 有更多信息）
                    // 判斷是否為 Blob 記錄：id === sui_ref 且 id 是 objectId（以 0x 開頭），且通過 blob_id 匹配
                    const isBlobRecord = existing.id === existing.sui_ref && 
                                        existing.id.startsWith("0x") && 
                                        blobIdFromNft && 
                                        existing.blob_id === blobIdFromNft;
                    
                    console.log(`[Timeline] EntryNFT ${nft.nftId} matched existing record:`, {
                      existingId: existing.id,
                      existingSuiRef: existing.sui_ref,
                      existingBlobId: existing.blob_id,
                      blobIdFromNft,
                      isBlobRecord,
                      shouldReplace: isBlobRecord
                    });
                    
                    if (isBlobRecord) {
                      // 刪除 Blob 記錄，用 EntryNFT 記錄替換
                      console.log(`[Timeline] 🔄 Replacing Blob record ${existing.id} with EntryNFT ${nft.nftId} (same blob_id: ${blobIdFromNft})`);
                      const indexToRemove = allRecords.indexOf(existing);
                      if (indexToRemove >= 0) {
                        allRecords.splice(indexToRemove, 1);
                        console.log(`[Timeline] Removed Blob record at index ${indexToRemove}, remaining records: ${allRecords.length}`);
                      } else {
                        console.warn(`[Timeline] ⚠️ Could not find Blob record ${existing.id} in allRecords to remove`);
                      }
                      
                      // 創建 EntryNFT 記錄
                      const intensity = Math.min(100, Math.max(0, (nft.moodScore / 10) * 100));
                      const tags = nft.tagsCsv ? nft.tagsCsv.split(",").map(t => t.trim()).filter(Boolean) : [];
                      
                      const nftRecord: EmotionRecord = {
                        id: nft.nftId,
                        emotion: "encrypted",
                        intensity: intensity,
                        description: nft.moodText || "",
                        blob_id: blobIdFromNft,
                        walrus_url: walrusUrlFromNft,
                        payload_hash: "",
                        is_public: false,
                        proof_status: "confirmed",
                        sui_ref: nft.nftId,
                        created_at: nft.timestamp,
                        wallet_address: currentAccountSnapshot?.address || null,
                        tags: tags.length > 0 ? tags : undefined,
                        transaction_digest: nft.transactionDigest || null,
                      };
                      
                      allRecords.push(nftRecord);
                      nftUpdatedCount++;
                      console.log(`[Timeline] ✅ Replaced Blob record with EntryNFT: ${nft.nftId}, total records now: ${allRecords.length}`);
                    } else {
                      // 更新現有記錄的 NFT 信息（現有記錄可能是數據庫記錄或其他類型）
                      let updated = false;
                      
                      // 更新 sui_ref：如果沒有 sui_ref，或現有的 sui_ref 不是 NFT ID，則更新為 NFT ID
                      // NFT 是比 Walrus blob 更高級的證明，所以應該優先使用 NFT ID
                      const isCurrentSuiRefNFT = existing.sui_ref && existing.sui_ref === existing.id;
                      if (nft.nftId && (!existing.sui_ref || (!isCurrentSuiRefNFT && existing.sui_ref !== nft.nftId))) {
                        existing.sui_ref = nft.nftId;
                        updated = true;
                      }
                      
                      // 更新 transaction_digest：優先保留數據庫中的（如果存在），否則使用鏈上的
                      if (nft.transactionDigest && !existing.transaction_digest) {
                        existing.transaction_digest = nft.transactionDigest;
                        updated = true;
                      }
                      
                      // 如果現有記錄沒有描述，使用 NFT 的描述
                      if (!existing.description && nft.moodText) {
                        existing.description = nft.moodText;
                        updated = true;
                      }
                      
                      // 更新強度（如果 NFT 中有）
                      if (nft.moodScore > 0) {
                        const intensity = Math.min(100, Math.max(0, (nft.moodScore / 10) * 100));
                        if (existing.intensity !== intensity) {
                          existing.intensity = intensity;
                          updated = true;
                        }
                      }
                      
                      // 更新標籤
                      if (nft.tagsCsv) {
                        const tags = nft.tagsCsv.split(",").map(t => t.trim()).filter(Boolean);
                        if (tags.length > 0) {
                          existing.tags = tags;
                          updated = true;
                        }
                      }
                      
                      if (updated) {
                        existing.proof_status = "confirmed";
                        nftUpdatedCount++;
                        console.log(`[Timeline] ✅ Updated record with NFT data:`, existing.id);
                      }
                    }
                  }
                }
                
                console.log(`[Timeline] NFT merge complete: added ${nftAddedCount}, updated ${nftUpdatedCount}`);
                
                if (entryNFTs.length > 0) {
                  toast({
                    title: t("timeline.queryCompleted") || "查詢完成",
                    description: t("timeline.queryCompletedDesc", { count: entryNFTs.length }) || `找到 ${entryNFTs.length} 個 NFT 記錄`,
                  });
                }
              } catch (nftError) {
                console.error("[Timeline] Error querying EntryNFTs:", nftError);
                // NFT 查詢失敗不影響其他記錄的載入
              }
            }

        // 3. 去重并排序（按时间倒序）
        console.log(`[Timeline] Starting deduplication with ${allRecords.length} total records`);
        
        // 優先使用 id 作為去重鍵（唯一標識符）
        // blob_id 和 sui_ref 作為輔助查找鍵（可能為空或重複）
        const deduplicationMap = new Map<string, EmotionRecord>();
        const blobIdToRecordMap = new Map<string, EmotionRecord>(); // 輔助映射：blob_id -> record
        const suiRefToRecordMap = new Map<string, EmotionRecord>(); // 輔助映射：sui_ref -> record（用於 NFT 去重）
        
        for (const record of allRecords) {
          // 優先使用 id 作為主鍵
          const primaryKey = record.id;
          const existingById = deduplicationMap.get(primaryKey);
          
          // 檢查 sui_ref 衝突（不同 id 但指向同一個 NFT）
          // 判斷記錄類型：
          // - 鏈上 NFT 記錄：id === sui_ref（id 和 sui_ref 都是 NFT_ID）
          // - 數據庫記錄：id !== sui_ref（id 是 UUID，sui_ref 是 NFT_ID）
          // 優先保留數據庫記錄（因為數據更完整，如 transaction_digest、emotion 等）
          if (record.sui_ref) {
            const isCurrentNFTRecord = record.id === record.sui_ref; // 當前記錄是否是鏈上 NFT 記錄
            
            // 檢查1：是否有其他記錄的 id 等於當前記錄的 sui_ref
            // 這會匹配：數據庫記錄（id = UUID, sui_ref = NFT_ID）遇到鏈上 NFT 記錄（id = NFT_ID）
            const existingBySuiRefAsId = deduplicationMap.get(record.sui_ref);
            if (existingBySuiRefAsId && existingBySuiRefAsId.id !== record.id) {
              const existingIsNFTRecord = existingBySuiRefAsId.id === existingBySuiRefAsId.sui_ref;
              
              // 優先保留數據庫記錄（id !== sui_ref）
              if (!existingIsNFTRecord && isCurrentNFTRecord) {
                // existingBySuiRefAsId 是數據庫記錄，record 是鏈上 NFT 記錄，保留數據庫記錄
                console.log(`[Timeline] Dedup: sui_ref conflict - keeping database record ${existingBySuiRefAsId.id}, skipping chain NFT record ${record.id}`);
                continue;
              } else if (existingIsNFTRecord && !isCurrentNFTRecord) {
                // existingBySuiRefAsId 是鏈上 NFT 記錄，record 是數據庫記錄，替換
                console.log(`[Timeline] Dedup: sui_ref conflict - replacing chain NFT record ${existingBySuiRefAsId.id} with database record ${record.id}`);
                deduplicationMap.set(record.id, record);
                if (record.sui_ref && record.sui_ref !== record.id) {
                  suiRefToRecordMap.set(record.sui_ref, record);
                }
                deduplicationMap.delete(existingBySuiRefAsId.id);
                continue;
              }
              // 如果兩個都是同一類型，繼續處理（讓後續邏輯處理）
            }
            
            // 檢查2：是否有其他記錄的 sui_ref 等於當前記錄的 id（通過輔助映射）
            // 這會匹配：鏈上 NFT 記錄（id = NFT_ID）遇到數據庫記錄（id = UUID, sui_ref = NFT_ID）
            const existingBySuiRef = suiRefToRecordMap.get(record.sui_ref);
            if (existingBySuiRef && existingBySuiRef.id !== record.id) {
              const existingIsNFTRecord = existingBySuiRef.id === existingBySuiRef.sui_ref;
              
              // 優先保留數據庫記錄
              if (!existingIsNFTRecord && isCurrentNFTRecord) {
                // existingBySuiRef 是數據庫記錄，record 是鏈上 NFT 記錄，保留數據庫記錄
                console.log(`[Timeline] Dedup: sui_ref conflict - keeping database record ${existingBySuiRef.id}, skipping chain NFT record ${record.id}`);
                continue;
              } else if (existingIsNFTRecord && !isCurrentNFTRecord) {
                // existingBySuiRef 是鏈上 NFT 記錄，record 是數據庫記錄，替換
                console.log(`[Timeline] Dedup: sui_ref conflict - replacing chain NFT record ${existingBySuiRef.id} with database record ${record.id}`);
                deduplicationMap.set(record.id, record);
                suiRefToRecordMap.set(record.sui_ref, record);
                deduplicationMap.delete(existingBySuiRef.id);
                continue;
              }
              // 如果兩個都是同一類型，繼續處理
            }
          }
          
          // 在添加到 deduplicationMap 之前，先檢查 blob_id 衝突
          // 注意：相同 blob_id 在不同網絡上應該視為不同記錄
          // 需要檢查所有已處理的記錄，不僅僅是 blobIdToRecordMap 中的
          if (record.blob_id) {
            const recordNetwork = extractNetworkFromWalrusUrl(record.walrus_url);
            // 使用 blob_id + network 作為鍵，確保不同網絡的相同 blob_id 不會衝突
            const blobIdKey = recordNetwork 
              ? `${record.blob_id}:${recordNetwork}` 
              : `${record.blob_id}:unknown`;
            
            // 先檢查輔助映射
            let existingByBlobId = blobIdToRecordMap.get(blobIdKey);
            
            // 如果輔助映射中沒有，檢查所有已處理的記錄（包括 blob_id === id 的情況）
            if (!existingByBlobId) {
              for (const [existingId, existingRecord] of deduplicationMap.entries()) {
                if (existingRecord.blob_id === record.blob_id && existingId !== record.id) {
                  const existingNetwork = extractNetworkFromWalrusUrl(existingRecord.walrus_url);
                  const existingBlobIdKey = existingNetwork 
                    ? `${existingRecord.blob_id}:${existingNetwork}` 
                    : `${existingRecord.blob_id}:unknown`;
                  
                  // 檢查網絡是否匹配
                  if (blobIdKey === existingBlobIdKey || 
                      (!recordNetwork && !existingNetwork) ||
                      (recordNetwork === existingNetwork)) {
                    existingByBlobId = existingRecord;
                    break;
                  }
                }
              }
            }
            
            if (existingByBlobId && existingByBlobId.id !== record.id) {
              // 發現 blob_id 衝突：兩個不同的記錄有相同的 blob_id 和網絡
              // 優先保留數據庫記錄（id 是 UUID，有完整的 emotion、description 等）
              // 跳過鏈上記錄（id 是 objectId，只有 blob_id）
              const existingInMainMap = deduplicationMap.get(existingByBlobId.id);
              const recordInMainMap = deduplicationMap.get(record.id);
              
              // 判斷記錄類型：數據庫記錄通常 id !== sui_ref，鏈上記錄 id === sui_ref 或 id === blob.objectId
              const existingIsDatabaseRecord = existingByBlobId.id !== existingByBlobId.sui_ref && existingByBlobId.sui_ref;
              const currentIsDatabaseRecord = record.id !== record.sui_ref && record.sui_ref;
              
              if (existingInMainMap) {
                // 衝突記錄已在主映射中
                if (existingIsDatabaseRecord && !currentIsDatabaseRecord) {
                  // 保留數據庫記錄，跳過鏈上記錄
                  console.log(`[Timeline] Dedup: blob_id conflict - keeping database record ${existingByBlobId.id}, skipping chain record ${record.id} (same blob_id: ${record.blob_id})`);
                  continue;
                } else if (!existingIsDatabaseRecord && currentIsDatabaseRecord) {
                  // 替換鏈上記錄為數據庫記錄
                  console.log(`[Timeline] Dedup: blob_id conflict - replacing chain record ${existingByBlobId.id} with database record ${record.id} (same blob_id: ${record.blob_id})`);
                  deduplicationMap.delete(existingByBlobId.id);
                  // 繼續處理，讓後續邏輯添加新記錄
                } else {
                  // 兩個都是同一類型，保留已在主映射中的
                  console.log(`[Timeline] Dedup: blob_id conflict - keeping ${existingByBlobId.id}, skipping ${record.id} (same blob_id: ${record.blob_id})`);
                  continue;
                }
              } else if (recordInMainMap) {
                // 當前記錄已在主映射中，但衝突記錄不在
                // 更新輔助映射
                blobIdToRecordMap.set(blobIdKey, record);
              } else {
                // 兩個都不在主映射中，優先保留數據庫記錄
                if (existingIsDatabaseRecord && !currentIsDatabaseRecord) {
                  console.log(`[Timeline] Dedup: blob_id conflict - will keep database record ${existingByBlobId.id}, skipping chain record ${record.id} (same blob_id: ${record.blob_id})`);
                  continue;
                }
                // 否則繼續處理，讓後續邏輯添加新記錄
              }
            }
          }
          
          if (!existingById) {
            // 新記錄，添加到主映射
            deduplicationMap.set(primaryKey, record);
            
            // 如果 blob_id 存在且不同於 id，也建立輔助映射（用於查找）
            if (record.blob_id && record.blob_id !== primaryKey) {
              const recordNetwork = extractNetworkFromWalrusUrl(record.walrus_url);
              const blobIdKey = recordNetwork 
                ? `${record.blob_id}:${recordNetwork}` 
                : `${record.blob_id}:unknown`;
              blobIdToRecordMap.set(blobIdKey, record);
            }
            
            // 如果 sui_ref 存在且不同於 id，建立輔助映射（用於 NFT 去重）
            if (record.sui_ref && record.sui_ref !== primaryKey) {
              suiRefToRecordMap.set(record.sui_ref, record);
            }
          } else {
            // id 已存在，比較時間戳，保留最新的
            const existingTime = new Date(existingById.created_at).getTime();
            const recordTime = new Date(record.created_at).getTime();
            
            if (!Number.isNaN(recordTime) && recordTime > existingTime) {
              console.log(`[Timeline] Dedup: replacing ${existingById.id} with ${record.id} (same id, newer timestamp)`);
              deduplicationMap.set(primaryKey, record);
              
              // 更新輔助映射
              if (record.blob_id && record.blob_id !== primaryKey) {
                const recordNetwork = extractNetworkFromWalrusUrl(record.walrus_url);
                const blobIdKey = recordNetwork 
                  ? `${record.blob_id}:${recordNetwork}` 
                  : `${record.blob_id}:unknown`;
                blobIdToRecordMap.set(blobIdKey, record);
              }
              if (record.sui_ref && record.sui_ref !== primaryKey) {
                suiRefToRecordMap.set(record.sui_ref, record);
              }
            } else {
              console.log(`[Timeline] Dedup: keeping ${existingById.id} (same id, older or equal timestamp), skipping ${record.id}`);
            }
          }
        }
        
        // 分析重複情況（用於日誌）
        const idCounts = new Map<string, number>();
        const blobIdCounts = new Map<string, number>();
        allRecords.forEach(record => {
          idCounts.set(record.id, (idCounts.get(record.id) || 0) + 1);
          if (record.blob_id) {
            blobIdCounts.set(record.blob_id, (blobIdCounts.get(record.blob_id) || 0) + 1);
          }
        });
        
        const duplicateIds = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);
        const duplicateBlobIds = Array.from(blobIdCounts.entries()).filter(([_, count]) => count > 1);
        
        if (duplicateIds.length > 0) {
          console.log(`[Timeline] Found ${duplicateIds.length} duplicate IDs (should not happen):`);
          duplicateIds.forEach(([id, count]) => {
            console.log(`  - ${id.substring(0, 20)}... appears ${count} times`);
          });
        }
        
        if (duplicateBlobIds.length > 0) {
          console.log(`[Timeline] Found ${duplicateBlobIds.length} blob_ids with duplicates (expected for multiple Sui objects referencing same blob):`);
          duplicateBlobIds.forEach(([blobId, count]) => {
            console.log(`  - ${blobId.substring(0, 20)}... appears ${count} times`);
          });
        }
        
        // 最後只保留以 id 為鍵的記錄（確保唯一性）
        // deduplicationMap 已經以 id 為鍵，所以 values() 已經保證唯一性，不需要額外過濾
        const uniqueRecords = sortRecordsByDate(
          Array.from(deduplicationMap.values())
        );
        
        // 最終檢查：確保沒有重複的 id 或 blob_id（在同一網絡下）
        const finalRecords: EmotionRecord[] = [];
        const seenIds = new Set<string>();
        const seenBlobIds = new Map<string, string>(); // blob_id:network -> record_id
        
        for (const record of uniqueRecords) {
          // 檢查 id 重複
          if (seenIds.has(record.id)) {
            console.warn(`[Timeline] ⚠️ Duplicate id found after deduplication: ${record.id}`);
            continue;
          }
          seenIds.add(record.id);
          
          // 檢查 blob_id 重複（在同一網絡下）
          // 注意：即使 blob_id === record.id，也要檢查是否有其他記錄有相同的 blob_id
          if (record.blob_id) {
            const recordNetwork = extractNetworkFromWalrusUrl(record.walrus_url);
            const blobIdKey = recordNetwork 
              ? `${record.blob_id}:${recordNetwork}` 
              : `${record.blob_id}:unknown`;
            
            const existingRecordId = seenBlobIds.get(blobIdKey);
            if (existingRecordId && existingRecordId !== record.id) {
              console.warn(`[Timeline] ⚠️ Duplicate blob_id found after deduplication: ${record.blob_id} (network: ${recordNetwork}), existing record: ${existingRecordId}, current record: ${record.id}`);
              // 找到已存在的記錄
              const existingRecord = finalRecords.find(r => r.id === existingRecordId);
              if (existingRecord) {
                // 優先保留數據庫記錄（id !== sui_ref）
                const existingIsDatabaseRecord = existingRecord.id !== existingRecord.sui_ref && existingRecord.sui_ref;
                const currentIsDatabaseRecord = record.id !== record.sui_ref && record.sui_ref;
                
                if (existingIsDatabaseRecord && !currentIsDatabaseRecord) {
                  // 已存在的記錄是數據庫記錄，跳過當前鏈上記錄
                  console.log(`[Timeline] Keeping database record ${existingRecordId}, skipping chain record ${record.id} (same blob_id: ${record.blob_id})`);
                  continue;
                } else if (!existingIsDatabaseRecord && currentIsDatabaseRecord) {
                  // 當前記錄是數據庫記錄，替換已存在的鏈上記錄
                  console.log(`[Timeline] Replacing chain record ${existingRecordId} with database record ${record.id} (same blob_id: ${record.blob_id})`);
                  const indexToRemove = finalRecords.findIndex(r => r.id === existingRecordId);
                  if (indexToRemove >= 0) {
                    finalRecords.splice(indexToRemove, 1);
                    seenIds.delete(existingRecordId);
                  }
                  seenBlobIds.set(blobIdKey, record.id);
                  finalRecords.push(record);
                } else {
                  // 兩個都是同一類型（都是鏈上記錄或都是數據庫記錄），保留已存在的（第一個）
                  console.log(`[Timeline] Keeping existing record ${existingRecordId}, skipping ${record.id} (same blob_id: ${record.blob_id}, both are ${existingIsDatabaseRecord ? 'database' : 'chain'} records)`);
                  continue;
                }
              } else {
                // 找不到已存在的記錄，更新映射並添加當前記錄
                seenBlobIds.set(blobIdKey, record.id);
                finalRecords.push(record);
              }
            } else {
              // 沒有衝突，添加記錄
              seenBlobIds.set(blobIdKey, record.id);
              finalRecords.push(record);
            }
          } else {
            // 沒有 blob_id，直接添加
            finalRecords.push(record);
          }
        }
        
        // 統計 blob_id 分布
        const blobIdStats = new Map<string, number>();
        finalRecords.forEach(r => {
          if (r.blob_id) {
            blobIdStats.set(r.blob_id, (blobIdStats.get(r.blob_id) || 0) + 1);
          }
        });
        const finalDuplicateBlobIds = Array.from(blobIdStats.entries()).filter(([_, count]) => count > 1);
        
        console.log(`[Timeline] After deduplication: ${uniqueRecords.length} records before final check, ${finalRecords.length} records after final check (removed ${allRecords.length - finalRecords.length} duplicates total)`);
        if (finalDuplicateBlobIds.length > 0) {
          console.warn(`[Timeline] ⚠️ Still found ${finalDuplicateBlobIds.length} duplicate blob_ids after final check:`, finalDuplicateBlobIds);
        } else {
          console.log(`[Timeline] ✅ All blob_ids are unique (${blobIdStats.size} unique blob_ids)`);
        }
        console.log(`[Timeline] Note: Multiple Sui objects can reference the same Walrus blob (same blob_id, different id)`);
        
        // 使用最終檢查後的記錄
        const finalUniqueRecords = sortRecordsByDate(finalRecords);

        // 統計資訊
        const localCount = finalUniqueRecords.filter(r => 
          r.blob_id?.startsWith("local_") || r.walrus_url?.startsWith("local://")
        ).length;
        const walrusCount = finalUniqueRecords.length - localCount;
        
        console.log(`[Timeline] Loaded ${finalUniqueRecords.length} total records:`, {
          total: finalUniqueRecords.length,
          local: localCount,
          walrus: walrusCount,
          records: finalUniqueRecords.map(r => {
            const isLocal = r.blob_id?.startsWith("local_") || r.walrus_url?.startsWith("local://");
            return {
              id: r.id,
              blob_id: r.blob_id,
              walrus_url: r.walrus_url,
              isLocal,
              proof_status: r.proof_status,
              sui_ref: r.sui_ref,
              emotion: r.emotion
            };
          })
        });
        
        // 特別檢查 Walrus 記錄
        const walrusRecords = finalUniqueRecords.filter(r => {
          const isLocal = r.blob_id?.startsWith("local_") || r.walrus_url?.startsWith("local://");
          return !isLocal;
        });
        console.log(`[Timeline] Walrus records details:`, walrusRecords.map(r => ({
          id: r.id,
          blob_id: r.blob_id,
          walrus_url: r.walrus_url,
          proof_status: r.proof_status,
          sui_ref: r.sui_ref
        })));

        // 最后检查是否已被取消，只有在未被取消时才更新状态
        if (!isCancelled) {
          setRecords(finalUniqueRecords);
        } else {
          console.log("[Timeline] Skipping state update - load was cancelled");
        }
      } catch (error: any) {
        if (!isCancelled) {
          console.error("Error loading records:", error);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadRecords();
    
    // 清理函数：当 effect 重新运行或组件卸载时，标记为已取消
    return () => {
      isCancelled = true;
    };
  }, [currentAccount, network]); // 添加 network 到依赖项，网络切换时自动重新加载

  // 监听网络切换，重新加载记录
  // 通过添加 network 到依赖项，当网络切换时会自动重新加载
  useNetworkChangeListener((newNetwork, oldNetwork) => {
    console.log(`[Timeline] Network changed from ${oldNetwork} to ${newNetwork}, will reload records...`);
    // 网络切换时，React Query 缓存已被清理，useEffect 会重新运行
    // 这里只需要记录日志，实际的重新加载由 useEffect 的依赖项触发
  });

  // 生成 Sui Scan 链接（对象）
  const getSuiScanUrl = (objectId: string | null): string | null => {
    if (!objectId) return null;
    // Sui Scan URL format: https://suiscan.xyz/{network}/object/{objectId}
    const networkPath = network === "mainnet" ? "mainnet" : "testnet";
    return `https://suiscan.xyz/${networkPath}/object/${objectId}`;
  };

  // 生成 Sui Scan 交易链接
  const getSuiScanTransactionUrl = (transactionDigest: string | null | undefined): string | null => {
    if (!transactionDigest) return null;
    // Sui Scan transaction URL format: https://suiscan.xyz/{network}/tx/{transactionDigest}
    const networkPath = network === "mainnet" ? "mainnet" : "testnet";
    return `https://suiscan.xyz/${networkPath}/tx/${transactionDigest}`;
  };

  // 指數退避重試函數
  const retryWithBackoff = useCallback(async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Retry failed");
  }, []);

  // 判斷記錄是否為本地儲存
  // 使用 useCallback 缓存 isLocalRecord 函数，避免每次渲染时重新创建
  const isLocalRecord = useCallback((record: EmotionRecord) => {
    // 檢查 blob_id 和 walrus_url 來判斷是否為本地記錄
    // 如果 blob_id 以 "local_" 開頭，或 walrus_url 以 "local://" 開頭，則為本地記錄
    const blobId = record.blob_id || "";
    const walrusUrl = record.walrus_url || "";
    
    const isLocalBlob = blobId.startsWith("local_");
    const isLocalUrl = walrusUrl.startsWith("local://");
    
    // 只有當明確是本地格式時，才返回 true
    // 其他情況（包括 walrus_url 是 https://aggregator.testnet.walrus.space 開頭，或 blob_id 是正常的 Walrus ID）都是 Walrus 記錄
    const isLocal = isLocalBlob || isLocalUrl;
    
    return isLocal;
  }, []);

  // 取得解密後的情緒（如果有），避免 UI 繼續顯示鎖頭圖示
  const getEmotionValue = useCallback((record: EmotionRecord) => {
    return decryptedEmotions[record.id] || record.emotion;
  }, [decryptedEmotions]);

  // 解密記錄描述
  const decryptDescription = useCallback(async (record: EmotionRecord) => {
    // NFT 記錄的描述（mood_text）是明文存儲的，不需要解密
    // 檢查是否為 NFT 記錄：id 和 sui_ref 相同
    const isNFTRecord = record.sui_ref && record.id === record.sui_ref;
    if (isNFTRecord && record.description) {
      // NFT 記錄的描述已經是明文，直接設置
      setDecryptedDescriptions(prev => ({
        ...prev,
        [record.id]: record.description,
      }));
      return;
    }
    // 如果正在解密，則跳過
    if (decryptingRecords.has(record.id)) {
      return;
    }
    
    // 如果已經解密，不需要重新解密
    if (decryptedDescriptions[record.id]) {
      return;
    }

    // 公開記錄使用公開金鑰，也需要解密（但任何人都可以解密）
    // 這裡不跳過，繼續解密流程

    // 如果是本地記錄且沒有資料庫加密資料，不需要解密
    if (isLocalRecord(record) && !record.encrypted_data) {
      return;
    }

    // 如果沒有加密資料且沒有 blob_id，無法解密
    if (!record.encrypted_data && (!record.blob_id || record.blob_id.startsWith("local_"))) {
      return;
    }

    // 標記為正在解密
    setDecryptingRecords(prev => new Set(prev).add(record.id));

    try {
      // 優先使用資料庫中的 encrypted_data，否則從 Walrus 讀取（帶重試）
      let encryptedDataString: string;
      if (record.encrypted_data) {
        console.log(`[Timeline] Using encrypted_data from database for record ${record.id}`);
        encryptedDataString = record.encrypted_data;
      } else {
        // 從 Walrus 讀取加密資料（帶重試機制）
        // 優先使用記錄創建時的網絡（從 walrus_url 提取），否則使用當前網絡
        const recordNetwork = extractNetworkFromWalrusUrl(record.walrus_url) || network;
        
        console.log(`[Timeline] Fetching encrypted data for blob_id: ${record.blob_id}, network: ${recordNetwork}`);
        
        try {
          // Try database backup first (faster and more reliable)
          encryptedDataString = await retryWithBackoff(
            () => getEncryptedEmotionByBlob(record.blob_id, recordNetwork),
            2,
            500
          );
          console.log(`[Timeline] Successfully fetched from database backup`);
        } catch (backupError) {
          const errorMsg = (backupError as Error).message;
          // If the error indicates data is on Walrus only, try fetching from Walrus
          if (errorMsg.includes("Data not available in database backup")) {
            console.log(`[Timeline] No database backup found, fetching from Walrus...`);
            try {
              encryptedDataString = await retryWithBackoff(
                () => readFromWalrus(record.blob_id, recordNetwork),
                3,
                1000
              );
              console.log(`[Timeline] Successfully fetched from Walrus`);
            } catch (walrusError) {
              console.error(`[Timeline] Walrus fetch failed:`, walrusError);
              // Create a more specific error for Walrus unavailability
              const walrusUnavailableError = new Error(
                `Network error: Walrus decentralized storage is currently unavailable. This may be due to: CORS restrictions, network connectivity issues, Walrus service downtime, or the data may have expired. Please try again later.`
              );
              (walrusUnavailableError as any).isWalrusError = true;
              (walrusUnavailableError as any).originalError = walrusError;
              throw walrusUnavailableError;
            }
          } else {
            // Other database errors
            throw new Error(`Failed to fetch encrypted data: ${errorMsg}`);
          }
        }
      }
      
      // 解析加密資料
      const encryptedData: EncryptedData = JSON.parse(encryptedDataString);
      
      // 嘗試所有可能的解密金鑰（因為記錄可能是在不同模式下加密的）
      const possibleKeys: Array<{key: string, type: string}> = [];
      
      try {
        // 如果是公開記錄，優先嘗試公開金鑰
        if (record.is_public) {
          possibleKeys.push({ key: PUBLIC_SEAL_KEY, type: 'Public Seal' });
        }
        
        // 1. 優先嘗試 Supabase 使用者 ID（如果有登錄）
        if (SUPABASE_ENABLED) {
          const session = await getSupabaseSessionSafe();
          if (session?.user?.id) {
            const supabaseKey = await generateUserKeyFromId(session.user.id);
            possibleKeys.push({ key: supabaseKey, type: 'Supabase User' });
          }
        }
        
        // 2. 嘗試匿名金鑰（如果存在）
        const anonymousKey = await getAnonymousUserKey();
        if (anonymousKey) {
          possibleKeys.push({ key: anonymousKey, type: 'Anonymous' });
        }
        
        // 3. 嘗試錢包地址（如果有連接錢包）
        if (currentAccount?.address) {
          const walletKey = await generateUserKey(currentAccount.address);
          possibleKeys.push({ key: walletKey, type: 'Wallet Address' });
        }
        
        // 4. 嘗試記錄中的錢包地址
        if (record.wallet_address && record.wallet_address !== currentAccount?.address) {
          const recordWalletKey = await generateUserKey(record.wallet_address);
          possibleKeys.push({ key: recordWalletKey, type: 'Record Wallet' });
        }
        
        // 5. 如果不是公開記錄，也嘗試公開金鑰（以防記錄被錯誤標記）
        if (!record.is_public) {
          possibleKeys.push({ key: PUBLIC_SEAL_KEY, type: 'Public Seal (fallback)' });
        }
        
        if (possibleKeys.length === 0) {
          throw new Error("無法產生使用者密鑰：需要登入、連接錢包或保留匿名金鑰");
        }
      } catch (keyError) {
        console.error("[Timeline] Failed to generate decryption keys:", keyError);
        throw new Error("無法產生解密密鑰");
      }
      
      // 依次嘗試所有可能的金鑰
      console.log(`[Timeline] Attempting decryption for record ${record.id} with ${possibleKeys.length} possible keys`);
      let decryptedString: string | null = null;
      let successKeyType: string = '';
      let lastError: Error | null = null;
      
      for (const {key, type} of possibleKeys) {
        try {
          console.log(`[Timeline] Trying decryption with ${type} key...`);
          decryptedString = await decryptDataWithMigration(encryptedData, key);
          successKeyType = type;
          console.log(`[Timeline] ✅ Successfully decrypted with ${type} key`);
          break;
        } catch (keyAttemptError) {
          console.warn(`[Timeline] ❌ Failed to decrypt with ${type} key:`, keyAttemptError);
          lastError = keyAttemptError as Error;
          continue;
        }
      }
      
      if (!decryptedString) {
        console.error(`[Timeline] All ${possibleKeys.length} decryption attempts failed for record ${record.id}`);
        throw lastError || new Error(`Failed to decrypt with any available key (tried ${possibleKeys.length} keys)`);
      }
      
      console.log(`[Timeline] 🎉 Record ${record.id} decrypted successfully using ${successKeyType} key`);
      
      // 解析解密後的 JSON 獲取快照
      const snapshot = JSON.parse(decryptedString);
      console.log(`[Timeline] 📦 Snapshot data for ${record.id}:`, {
        emotion: snapshot.emotion,
        intensity: snapshot.intensity,
        timestamp: snapshot.timestamp,
        hasDescription: !!snapshot.description,
      });
      
      const snapshotTimestamp = snapshot.timestamp
        ? new Date(snapshot.timestamp).toISOString()
        : null;
      
      // 更新記錄的 metadata（例如真實時間戳與情緒/強度）
      // 修正：始終執行更新，確保解密後的情緒能正確顯示
      // 💡 關鍵修復：如果 snapshot 中有 emotion，強制使用它（即使原記錄是 "encrypted"）
      setRecords(prev => {
        const updated = prev.map(r => {
          if (r.id !== record.id) return r;
          const updatedRecord = {
            ...r,
            created_at: snapshotTimestamp || r.created_at,
            emotion: snapshot.emotion && snapshot.emotion !== "encrypted" ? snapshot.emotion : r.emotion,
            intensity: typeof snapshot.intensity === "number" ? snapshot.intensity : r.intensity,
            wallet_address: snapshot.walletAddress || r.wallet_address,
          };
          console.log(`[Timeline] 🔄 Updating record ${r.id}:`, {
            oldEmotion: r.emotion,
            snapshotEmotion: snapshot.emotion,
            newEmotion: updatedRecord.emotion,
            willChange: updatedRecord.emotion !== r.emotion,
          });
          return updatedRecord;
        });
        return sortRecordsByDate(updated);
      });
      
      // 紀錄解密後的情緒，避免重新載入後又顯示鎖頭
      if (snapshot.emotion) {
        setDecryptedEmotions(prev => ({
          ...prev,
          [record.id]: snapshot.emotion,
        }));
      }

      // 儲存解密後的描述
      setDecryptedDescriptions(prev => ({
        ...prev,
        [record.id]: snapshot.description || '',
      }));
      
      // 清除失敗標記（如果之前失敗過）
      setFailedAutoDecrypts(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      
      // 儲存解密後的 AI 回饋（如果有的話）
      if (snapshot.aiResponse) {
        setDecryptedAiResponses(prev => ({
          ...prev,
          [record.id]: snapshot.aiResponse,
        }));
      }
      
      // 清除之前的錯誤資訊
      setDecryptErrors(prev => {
        const next = { ...prev };
        delete next[record.id];
        return next;
      });
      setDecryptErrorDetails(prev => {
        const next = { ...prev };
        delete next[record.id];
        return next;
      });
      setExpandedErrorDetails(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      
      toast({
        title: t("timeline.decryptSuccess"),
        description: t("timeline.decryptSuccessDesc"),
      });
    } catch (error: any) {
      console.error(`[Timeline] Failed to decrypt record ${record.id}:`, error);
      
      // 提取詳細錯誤資訊
      let errorType = "unknown";
      let errorMessage = t("timeline.decryptFailedDesc");
      let statusCode: number | undefined;
      let suggestions: string[] = [];
      
      // 檢查是否是 DecryptionError（新的錯誤類型）
      if (error instanceof DecryptionError) {
        switch (error.type) {
          case DecryptionErrorType.INVALID_KEY:
            errorType = "key_error";
            errorMessage = t("timeline.decryptKeyError") + ": " + t("timeline.decryptErrorInvalidKey");
            suggestions = [
              t("timeline.errorSuggestion.checkPassword"),
              t("timeline.errorSuggestion.checkLogin"),
              t("timeline.errorSuggestion.checkWallet"),
            ];
            break;
          case DecryptionErrorType.DATA_CORRUPTED:
            errorType = "data_corrupted";
            errorMessage = t("timeline.decryptErrorDataCorrupted");
            suggestions = [
              t("timeline.errorSuggestion.dataCorrupted"),
              t("timeline.errorSuggestion.contactSupport"),
            ];
            break;
          case DecryptionErrorType.UNSUPPORTED_VERSION:
            errorType = "unsupported_version";
            errorMessage = t("timeline.decryptErrorUnsupportedVersion");
            suggestions = [
              t("timeline.errorSuggestion.updateApp"),
              t("timeline.errorSuggestion.contactSupport"),
            ];
            break;
          case DecryptionErrorType.INVALID_FORMAT:
            errorType = "invalid_data";
            errorMessage = t("timeline.decryptInvalidData");
            suggestions = [
              t("timeline.errorSuggestion.dataCorrupted"),
              t("timeline.errorSuggestion.contactSupport"),
            ];
            break;
          default:
            errorMessage = error.message || t("timeline.decryptFailedDesc");
            suggestions = [
              t("timeline.errorSuggestion.retryLater"),
              t("timeline.errorSuggestion.contactSupport"),
            ];
        }
      } else if (error.message) {
        // 處理其他類型的錯誤（網路錯誤等）
        if (error.message.includes("Network error") || error.message.includes("network") || error.message.includes("fetch")) {
          errorType = "network";
          errorMessage = t("timeline.decryptNetworkError");
          suggestions = [
            t("timeline.errorSuggestion.checkConnection"),
            t("timeline.errorSuggestion.checkFirewall"),
            t("timeline.errorSuggestion.retryLater"),
          ];
        } else if (error.message.includes("not found") || error.message.includes("404")) {
          errorType = "not_found";
          errorMessage = "找不到資料，可能已過期或已被刪除";
          statusCode = 404;
          suggestions = [
            ...(isTestnet ? ["⚠️ Walrus Testnet 資料會在 epochs 到期後被刪除"] : []),
            "💡 建議：記錄新情緒時啟用「備份到資料庫」選項",
            "📱 已備份的資料可在任何設備查看",
          ];
        } else if (error.message.includes("unavailable") || error.message.includes("500") || error.message.includes("503")) {
          errorType = "service_unavailable";
          errorMessage = t("timeline.decryptServiceUnavailable");
          if (error.message.includes("500")) statusCode = 500;
          if (error.message.includes("503")) statusCode = 503;
          suggestions = [
            t("timeline.errorSuggestion.serviceMaintenance"),
            t("timeline.errorSuggestion.retryLater"),
          ];
        } else if (error.message.includes("無法產生") || error.message.includes("密鑰") || error.message.includes("key")) {
          errorType = "key_error";
          errorMessage = t("timeline.decryptKeyError");
          suggestions = [
            t("timeline.errorSuggestion.checkLogin"),
            t("timeline.errorSuggestion.checkWallet"),
          ];
        } else if (error.message.includes("Invalid blob ID") || error.message.includes("Invalid")) {
          errorType = "invalid_data";
          errorMessage = t("timeline.decryptInvalidData");
          suggestions = [
            t("timeline.errorSuggestion.dataCorrupted"),
            t("timeline.errorSuggestion.contactSupport"),
          ];
        } else {
          errorMessage = error.message;
          suggestions = [
            t("timeline.errorSuggestion.retryLater"),
            t("timeline.errorSuggestion.contactSupport"),
          ];
        }
      }
      
      // 嘗試從錯誤物件中提取狀態碼
      if (error.status) {
        statusCode = error.status;
      } else if (error.response?.status) {
        statusCode = error.response.status;
      }
      
      // 如果是 Walrus 記錄，且當前在測試網，添加 Walrus aggregator 提示
      const isWalrusRecord = record.blob_id && !record.blob_id.startsWith("local_");
      
      if (isWalrusRecord && isTestnet) {
        // 在錯誤訊息中添加 Walrus aggregator 提示（僅在測試網顯示）
        const aggregatorNotice = t("timeline.walrusAggregatorNotice");
        // 將提示添加到建議列表的最前面，讓用戶更容易看到
        suggestions = [aggregatorNotice, ...suggestions];
      }
      
      // 儲存詳細錯誤資訊
      const errorDetail = {
        type: errorType,
        message: errorMessage,
        statusCode,
        blobId: record.blob_id,
        timestamp: new Date().toISOString(),
        suggestions,
      };
      
      console.error(`[Timeline] Detailed error for record ${record.id}:`, errorDetail);
      
      setDecryptErrorDetails(prev => ({
        ...prev,
        [record.id]: errorDetail,
      }));
      
      toast({
        title: t("timeline.decryptFailed"),
        description: errorMessage,
        variant: "destructive",
      });
      
      // 儲存錯誤訊息（不顯示解密內容，只顯示錯誤）
      setDecryptErrors(prev => ({
        ...prev,
        [record.id]: errorMessage,
      }));
    } finally {
      // 移除解密中標記
      setDecryptingRecords(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  }, [decryptedDescriptions, decryptingRecords, currentAccount, toast, t, isLocalRecord, retryWithBackoff, isTestnet]);

  // 獲取所有可用的標籤
  // 緩存是否有非本地記錄（用於顯示 Testnet 警告）
  const hasNonLocalRecords = useMemo(() => {
    return records.some(r => !isLocalRecord(r));
  }, [records, isLocalRecord]);
  
  // 警告横幅显示状态：跟随 hasNonLocalRecords 的变化
  // 使用 useMemo 直接计算，避免不必要的 state 更新
  const showWarningBanner = hasNonLocalRecords;

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    records.forEach(record => {
      if (record.tags && record.tags.length > 0) {
        record.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [records]);

  // 篩選、搜尋和排序後的記錄（需要在 decryptAllRecords 之前定義）
  const filteredRecords = useMemo(() => {
    let filtered = records;
    
    // 1. 儲存類型過濾（使用已定義的 isLocalRecord 函數，避免代碼重複）
    if (filter === "local") {
      filtered = filtered.filter(isLocalRecord);
    } else if (filter === "walrus") {
      filtered = filtered.filter(r => !isLocalRecord(r));
    } else if (filter === "sealPolicies") {
      // 只显示有 Seal Access Policies 的记录（NFT 记录且已检查有访问策略）
      filtered = filtered.filter(r => {
        // 必须是 NFT 记录（sui_ref === id）
        const isNFT = r.sui_ref && r.id === r.sui_ref;
        if (!isNFT) return false;
        // 必须在已检查的记录列表中
        const hasPolicy = recordsWithSealPolicies.has(r.id);
        if (!hasPolicy && !checkingSealPolicies) {
          // 如果检查已完成但记录不在列表中，说明没有访问策略
          return false;
        }
        return hasPolicy;
      });
      
      // 如果正在检查中，记录筛选结果用于调试
      if (checkingSealPolicies) {
        console.log(`[Timeline] 🔄 正在检查 Seal Access Policies，当前筛选出 ${filtered.length} 个记录`);
      } else {
        console.log(`[Timeline] ✅ Seal Access Policies 筛选完成，显示 ${filtered.length} 个记录`);
        console.log(`[Timeline] 有访问策略的记录数: ${recordsWithSealPolicies.size}`);
      }
    }
    
    // 2. 日期範圍過濾
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.created_at);
        if (dateRange.from && recordDate < dateRange.from) return false;
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999); // 包含結束日期的整天
          if (recordDate > toDate) return false;
        }
        return true;
      });
    }
    
    // 3. 標籤過濾
    if (selectedTags.length > 0) {
      filtered = filtered.filter(record => {
        const recordTags = record.tags || [];
        // 記錄必須包含所有選中的標籤（AND 邏輯）
        return selectedTags.every(tag => recordTags.includes(tag));
      });
    }
    
    // 4. 搜尋過濾
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record => {
        const emotionMatch = getEmotionValue(record).toLowerCase().includes(query);
        const descriptionMatch = decryptedDescriptions[record.id]?.toLowerCase().includes(query);
        const dateMatch = new Date(record.created_at).toLocaleDateString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US').includes(query);
        const tagsMatch = record.tags?.some(tag => tag.toLowerCase().includes(query));
        return emotionMatch || descriptionMatch || dateMatch || tagsMatch;
      });
    }
    
    // 4. 排序
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "date":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "intensity":
          comparison = a.intensity - b.intensity;
          break;
        case "emotion":
          comparison = getEmotionValue(a).localeCompare(getEmotionValue(b), i18n.language);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [records, filter, searchQuery, selectedTags, sortBy, sortOrder, decryptedDescriptions, i18n.language, dateRange, isLocalRecord, recordsWithSealPolicies, getEmotionValue]);

  // 检查哪些记录有 Seal Access Policies（异步检查，使用缓存）
  useEffect(() => {
    const checkSealPolicies = async () => {
      // 检查所有有 sui_ref 的记录（包括 NFT 和 Walrus Blob）
      // 之前的过滤条件 r.id === r.sui_ref 会排除掉来自 Supabase 的记录（id 为 UUID），导致无法检查
      const nftRecords = records.filter(r => r.sui_ref);
      console.log(`[Timeline] 🔍 开始检查 Seal Access Policies，找到 ${nftRecords.length} 个潜在的 NFT 记录`);
      
      if (nftRecords.length === 0) {
        console.log("[Timeline] 没有 NFT 记录，清空 Seal Access Policies 列表");
        setRecordsWithSealPolicies(new Set());
        return;
      }

      // 如果已经在检查中，跳过
      if (checkingSealPoliciesRef.current) {
        console.log("[Timeline] 检查正在进行中，跳过重复检查");
        return;
      }
      
      checkingSealPoliciesRef.current = true;
      setCheckingSealPolicies(true);
      
      try {
        // 获取 PolicyRegistry ID
        const suiClient = getClientForNetwork(network);
        console.log(`[Timeline] 正在获取 PolicyRegistry ID (网络: ${network})...`);
        const registryId = await getOrQueryPolicyRegistry(network, suiClient);
        
        if (!registryId) {
          console.warn("[Timeline] ⚠️ PolicyRegistry not found, cannot check Seal Access Policies");
          setRecordsWithSealPolicies(new Set());
          setCheckingSealPolicies(false);
          checkingSealPoliciesRef.current = false;
          return;
        }
        
        console.log(`[Timeline] ✅ PolicyRegistry ID: ${registryId}`);

        // 批量检查记录是否有访问策略（使用 Promise.all，但限制并发）
        const batchSize = 5; // 每次检查 5 个记录
        const recordsWithPolicies = new Set<string>();
        let checkedCount = 0;
        
        for (let i = 0; i < nftRecords.length; i += batchSize) {
          const batch = nftRecords.slice(i, i + batchSize);
          console.log(`[Timeline] 检查批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(nftRecords.length / batchSize)} (${batch.length} 个记录)`);
          
          const checks = await Promise.allSettled(
            batch.map(async (record) => {
              try {
                // 尝试检查是否有访问策略（不关心是公开还是私有）
                // 如果 isPublicSeal 成功返回（无论 true/false），说明记录有访问策略
                await isPublicSeal(record.sui_ref!, registryId, network, suiClient);
                console.log(`[Timeline] ✅ 记录 ${record.id} 有 Seal Access Policies`);
                return record.id;
              } catch (error: any) {
                // 如果检查失败，尝试使用交易回溯的诊断方法进一步确认
                const errorMessage = error?.message || "";
                if (!errorMessage.includes("没有访问策略") &&
                    !errorMessage.includes("malformed utf8") &&
                    !errorMessage.includes("Deserialization error")) {
                  console.warn(`[Timeline] ⚠️ 检查记录 ${record.id} 时出现意外错误 (devInspect):`, error);
                } else {
                  console.log(`[Timeline] ❌ isPublicSeal 提示记录 ${record.id} 没有 Seal Access Policies，尝试使用交易诊断...`);
                }

                try {
                  const diagnosis = await checkIfMintedWithSealPolicies(record.sui_ref!, network, suiClient);
                  if (diagnosis?.mintedWithPolicies) {
                    console.log(`[Timeline] ✅ 交易诊断确认记录 ${record.id} 使用了 Seal Access Policies (tx: ${diagnosis.transactionDigest})`);
                    return record.id;
                  }
                  console.log(`[Timeline] ❌ 交易诊断也未找到策略：`, {
                    recordId: record.id,
                    transactionDigest: diagnosis?.transactionDigest,
                    error: diagnosis?.error,
                  });
                } catch (diagnosisError) {
                  console.warn(`[Timeline] ⚠️ 交易诊断失败 (record ${record.id}):`, diagnosisError);
                }

                return null;
              }
            })
          );
          
          checks.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              recordsWithPolicies.add(result.value);
              checkedCount++;
            } else if (result.status === 'rejected') {
              // Promise.allSettled 不会抛出错误，但我们可以在这里处理 rejected 的情况
              console.warn("[Timeline] Promise rejected (不应该发生):", result.reason);
            }
          });
        }
        
        console.log(`[Timeline] ✅ 检查完成！找到 ${recordsWithPolicies.size} 个有 Seal Access Policies 的记录 (共检查 ${checkedCount} 个)`);
        console.log(`[Timeline] 有 Seal Access Policies 的记录 ID:`, Array.from(recordsWithPolicies));
        setRecordsWithSealPolicies(recordsWithPolicies);
      } catch (error) {
        console.error("[Timeline] ❌ 检查 Seal Access Policies 时出错:", error);
        setRecordsWithSealPolicies(new Set());
      } finally {
        checkingSealPoliciesRef.current = false;
        setCheckingSealPolicies(false);
      }
    };

    // 只在有 sui_ref 记录时检查
    const nftRecords = records.filter(r => r.sui_ref);
    if (nftRecords.length > 0) {
      checkSealPolicies();
    } else {
      setRecordsWithSealPolicies(new Set());
    }
  }, [records, network]);

  // 虛擬滾動器配置
  // 使用動態高度估計以提升滾動準確性
  const virtualizer = useVirtualizer({
    count: filteredRecords.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      // 根據記錄內容動態估計高度
      const record = filteredRecords[index];
      if (!record) return 200;
      
      // 基礎高度
      let estimatedHeight = 150;
      
      // 如果有描述，增加高度
      const hasDescription = decryptedDescriptions[record.id] || record.description;
      if (hasDescription) {
        const descLength = (decryptedDescriptions[record.id] || record.description || '').length;
        estimatedHeight += Math.min(descLength / 3, 150); // 最多增加150px
      }
      
      // 如果有標籤，增加高度
      if (record.tags && record.tags.length > 0) {
        estimatedHeight += record.tags.length * 8;
      }
      
      // 如果有錯誤信息，增加高度
      if (decryptErrors[record.id]) {
        estimatedHeight += 50;
      }
      
      return Math.max(estimatedHeight, 200); // 最小200px
    }, [filteredRecords, decryptedDescriptions, decryptErrors]),
    overscan: 5, // 預渲染額外 5 條記錄以提升滾動體驗
  });

  // 批量解密所有記錄
  // 从链上同步所有 NFT 记录到 Supabase
  const syncNFTsFromChain = async () => {
    if (!currentAccount?.address) {
      toast({
        title: t("timeline.syncNFTs.needWallet"),
        description: t("timeline.syncNFTs.needWalletDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!SUPABASE_ENABLED) {
      toast({
        title: t("timeline.syncNFTs.disabledTitle") || "Supabase disabled",
        description: t("timeline.syncNFTs.disabledDesc") || "On-chain NFTs are already shown locally; no database sync will be performed.",
      });
      return;
    }

    setIsQueryingOnChain(true);
    try {
      console.log("[Timeline] 🔄 开始从链上同步 NFT 记录...");
      
      // 查询链上的所有 EntryNFTs
      const entryNFTs = await queryEntryNFTsByOwner(currentAccount.address, network);
      console.log(`[Timeline] 找到 ${entryNFTs.length} 个链上 NFT`);
      
      if (entryNFTs.length === 0) {
        toast({
          title: t("timeline.syncNFTs.noNFTs"),
          description: t("timeline.syncNFTs.noNFTsDesc"),
        });
        setIsQueryingOnChain(false);
        return;
      }
      
      // 检查 Supabase session
      const session = await getSupabaseSessionSafe();
      if (!session?.user?.id) {
        toast({
          title: t("timeline.syncNFTs.needLogin"),
          description: t("timeline.syncNFTs.needLoginDesc"),
          variant: "destructive",
        });
        setIsQueryingOnChain(false);
        return;
      }
      
      let syncedCount = 0;
      let skippedCount = 0;
      
      for (const nft of entryNFTs) {
        try {
          // 检查记录是否已存在（通过 sui_ref）
          const { data: existing } = await supabase
            .from('emotion_records')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('sui_ref', nft.nftId)
            .single();
          
          if (existing) {
            console.log(`[Timeline] 跳过已存在的 NFT: ${nft.nftId}`);
            skippedCount++;
            continue;
          }
          
          // 从 NFT 元数据提取 blob_id（image/audio URL 或直接的 blob_id）
          const blobId =
            nft.blobId ||
            extractBlobIdFromUrl(nft.imageUrl) ||
            extractBlobIdFromUrl(nft.audioUrl) ||
            `nft_${nft.nftId.slice(0, 8)}`;
          const walrusUrlForDb = blobId
            ? (isValidBlobId(blobId) ? getWalrusUrl(blobId, network) : (nft.imageUrl || nft.audioUrl || ""))
            : (nft.imageUrl || nft.audioUrl || "");
          
          // 将强度从 1-10 转换为 0-100
          const intensity = Math.min(100, Math.max(0, (nft.moodScore / 10) * 100));
          
          // 插入新记录
          const recordData: any = {
            user_id: session.user.id,
            emotion: 'encrypted', // NFT 中没有存储 emotion 类型
            intensity: intensity,
            blob_id: blobId,
            walrus_url: walrusUrlForDb,
            payload_hash: '',
            is_public: false,
            proof_status: 'confirmed',
            sui_ref: nft.nftId,
            wallet_address: currentAccount.address,
            created_at: nft.timestamp,
          };
          
          if (nft.transactionDigest) {
            recordData.transaction_digest = nft.transactionDigest;
          }
          
          const { error } = await supabase
            .from('emotion_records')
            .insert([recordData]);
          
          if (error) {
            console.error(`[Timeline] 保存 NFT ${nft.nftId} 失败:`, error);
          } else {
            console.log(`[Timeline] ✅ 同步 NFT: ${nft.nftId}`);
            syncedCount++;
          }
        } catch (error) {
          console.error(`[Timeline] 处理 NFT ${nft.nftId} 时出错:`, error);
        }
      }
      
      toast({
        title: t("timeline.syncNFTs.success"),
        description: t("timeline.syncNFTs.successDesc", { synced: syncedCount, skipped: skippedCount }),
      });
      
      // 重新加载记录
      console.log("[Timeline] 重新加载记录...");
      window.location.reload();
      
    } catch (error: any) {
      console.error("[Timeline] 同步 NFT 失败:", error);
      toast({
        title: t("timeline.syncNFTs.failed"),
        description: t("timeline.syncNFTs.failedDesc", { error: error?.message || t("common.unknownError") }),
        variant: "destructive",
      });
    } finally {
      setIsQueryingOnChain(false);
    }
  };

  const decryptAllRecords = useCallback(async () => {
    if (isDecryptingAll) return;
    
    setIsDecryptingAll(true);
    
    // 找出所有需要解密的記錄
    const recordsToDecrypt = filteredRecords.filter(record => {
      // 跳過已經解密的
      if (decryptedDescriptions[record.id]) return false;
      // 跳過公開記錄
      if (record.is_public) return false;
      // 跳過本地記錄（已經自動解密）
      if (isLocalRecord(record) && !record.encrypted_data) return false;
      // 跳過沒有加密資料的
      if (!record.encrypted_data && (!record.blob_id || record.blob_id.startsWith("local_"))) return false;
      return true;
    });

    if (recordsToDecrypt.length === 0) {
      toast({
        title: t("timeline.decryptAll.noRecords"),
        description: t("timeline.decryptAll.noRecordsDesc"),
        variant: "default",
      });
      setIsDecryptingAll(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let hasWalrusFailures = false;

    // 依次解密每個記錄
    for (const record of recordsToDecrypt) {
      try {
        await decryptDescription(record);
        successCount++;
        // 添加小延遲避免過於頻繁的請求
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[Timeline] Failed to decrypt record ${record.id} in batch:`, error);
        failCount++;
        // 檢查是否為 Walrus 記錄
        const isWalrusRecord = record.blob_id && !record.blob_id.startsWith("local_");
        if (isWalrusRecord) {
          hasWalrusFailures = true;
        }
      }
    }

    setIsDecryptingAll(false);

    // 顯示結果
    if (failCount === 0) {
      toast({
        title: t("timeline.decryptAll.success"),
        description: t("timeline.decryptAll.successDesc", { count: successCount }),
        variant: "default",
      });
    } else {
      // 如果有 Walrus 記錄失敗，在描述中添加 aggregator 提示
      let description = t("timeline.decryptAll.partialSuccessDesc", { success: successCount, fail: failCount });
      if (hasWalrusFailures) {
        const aggregatorNotice = t("timeline.walrusAggregatorNotice");
        description = `${description}\n\n${aggregatorNotice}`;
      }
      
      toast({
        title: t("timeline.decryptAll.partialSuccess"),
        description,
        variant: "default",
      });
    }
  }, [filteredRecords, decryptedDescriptions, isDecryptingAll, decryptDescription, isLocalRecord, toast, t]);

  // 自動解密公開的 Walrus 記錄（因為任何人都可以解密）
  useEffect(() => {
    if (!records.length) return;
    
    // 找出所有需要自動解密的公開 Walrus 記錄
    const publicWalrusRecords = records.filter(record => {
      // 必須是公開記錄
      if (!record.is_public) return false;
      // 必須是 Walrus 記錄（不是本地記錄）
      if (isLocalRecord(record)) return false;
      // 必須還沒有解密
      if (decryptedDescriptions[record.id]) return false;
      // 必須不在解密中（避免重複解密）
      if (decryptingRecords.has(record.id)) return false;
      // 必須沒有失敗過（避免無限重試）
      if (failedAutoDecrypts.has(record.id)) return false;
      // 必須有加密資料或 blob_id
      if (!record.encrypted_data && (!record.blob_id || record.blob_id.startsWith("local_"))) return false;
      return true;
    });
    
    // 自動解密每個公開記錄
    publicWalrusRecords.forEach(record => {
      decryptDescription(record).catch(error => {
        console.warn(`[Timeline] Failed to auto-decrypt public record ${record.id}:`, error);
        // 記錄失敗的嘗試，避免無限重試
        setFailedAutoDecrypts(prev => new Set(prev).add(record.id));
      });
    });
  }, [records, decryptedDescriptions, decryptingRecords, decryptDescription, isLocalRecord, failedAutoDecrypts]);

  // 統計資料
  const stats = useMemo(() => {
    const total = records.length;
    const local = records.filter(isLocalRecord).length;
    const walrus = records.filter(r => !isLocalRecord(r)).length;
    
    const emotionCounts: Record<string, number> = {};
    records.forEach(r => {
      const emotion = getEmotionValue(r);
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    const totalIntensity = records.reduce((sum, r) => sum + r.intensity, 0);
    const avgIntensity = total > 0 ? Math.round(totalIntensity / total) : 0;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const thisWeek = records.filter(r => new Date(r.created_at) >= weekAgo).length;
    const thisMonth = records.filter(r => new Date(r.created_at) >= monthAgo).length;

    return {
      total,
      local,
      walrus,
      emotionCounts,
      avgIntensity,
      thisWeek,
      thisMonth,
    };
  }, [records, getEmotionValue, isLocalRecord]);

  // 情緒分布圖表資料
  const emotionChartData = useMemo(() => {
    return Object.entries(stats.emotionCounts).map(([emotion, count]) => {
      const config = emotionLabels[emotion as keyof typeof emotionLabels];
      return {
        name: config?.label || emotion,
        value: count,
        color: config?.color || "#94a3b8",
        emoji: config?.emoji || "😊",
      };
    });
  }, [stats.emotionCounts]);

  // 儲存方式分布圖表資料
  const storageChartData = useMemo(() => {
    return [
      {
        name: t("timeline.filter.local"),
        value: stats.local,
        color: "#8b5cf6",
      },
      {
        name: t("timeline.filter.walrus"),
        value: stats.walrus,
        color: "#06b6d4",
      },
    ];
  }, [stats.local, stats.walrus, t]);

  // 時間趨勢資料（支持周/月/年視圖）
  const timelineChartData = useMemo(() => {
    const now = new Date();
    const data = [];
    let days = 7;
    let dateFormat: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    
    if (viewPeriod === "week") {
      days = 7;
      dateFormat = { month: 'short', day: 'numeric' };
    } else if (viewPeriod === "month") {
      days = 30;
      dateFormat = { month: 'short', day: 'numeric' };
    } else if (viewPeriod === "year") {
      days = 365;
      dateFormat = { month: 'short' };
    }
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      if (viewPeriod === "year") {
        date.setMonth(date.getMonth() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      if (viewPeriod === "year") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      
      const periodRecords = records.filter(r => {
        const recordDate = new Date(r.created_at);
        return recordDate >= date && recordDate < nextDate;
      });
      
      const count = periodRecords.length;
      const avgIntensity = periodRecords.length > 0
        ? Math.round(periodRecords.reduce((sum, r) => sum + r.intensity, 0) / periodRecords.length)
        : 0;
      
      data.push({
        date: date.toLocaleDateString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US', dateFormat),
        count,
        avgIntensity,
      });
    }
    
    return data;
  }, [records, i18n.language, viewPeriod]);

  // 情緒趨勢預測（基於線性回歸）
  const emotionTrendData = useMemo(() => {
    if (records.length < 3) return null;
    
    const emotionCounts: Record<string, number[]> = {};
    const now = new Date();
    const days = viewPeriod === "week" ? 7 : viewPeriod === "month" ? 30 : 365;
    
    // 收集歷史數據
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      if (viewPeriod === "year") {
        date.setMonth(date.getMonth() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      if (viewPeriod === "year") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      
      const periodRecords = records.filter(r => {
        const recordDate = new Date(r.created_at);
        return recordDate >= date && recordDate < nextDate;
      });
      
      periodRecords.forEach(r => {
        const emotion = getEmotionValue(r);
        if (!emotionCounts[emotion]) {
          emotionCounts[emotion] = new Array(days).fill(0);
        }
        emotionCounts[emotion][days - 1 - i] = (emotionCounts[emotion][days - 1 - i] || 0) + 1;
      });
    }
    
    // 計算趨勢和預測
    const result: Record<string, { actual: number[], predicted: number[], trend: 'up' | 'down' | 'stable' }> = {};
    
    Object.entries(emotionCounts).forEach(([emotion, counts]) => {
      const nonZeroCounts = counts.filter(c => c > 0);
      if (nonZeroCounts.length < 2) return;
      
      // 簡單線性回歸
      const n = counts.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      
      counts.forEach((y, x) => {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // 預測未來3個週期
      const predicted = [];
      for (let i = 0; i < 3; i++) {
        predicted.push(Math.max(0, Math.round(slope * (n + i) + intercept)));
      }
      
      // 判斷趨勢
      const recentAvg = counts.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const earlierAvg = counts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (recentAvg > earlierAvg * 1.2) trend = 'up';
      else if (recentAvg < earlierAvg * 0.8) trend = 'down';
      
      result[emotion] = {
        actual: counts,
        predicted,
        trend,
      };
    });
    
    return result;
  }, [records, viewPeriod, getEmotionValue]);

  // 情緒關聯分析
  const emotionCorrelationData = useMemo(() => {
    if (records.length < 2) return null;
    
    const transitions: Record<string, Record<string, number>> = {};
    
    // 按時間排序
    const sortedRecords = [...records].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // 計算情緒轉換
    for (let i = 0; i < sortedRecords.length - 1; i++) {
      const from = getEmotionValue(sortedRecords[i]);
      const to = getEmotionValue(sortedRecords[i + 1]);
      
      if (!transitions[from]) {
        transitions[from] = {};
      }
      transitions[from][to] = (transitions[from][to] || 0) + 1;
    }
    
    // 計算關聯強度
    const correlations: Array<{ from: string; to: string; strength: number; count: number }> = [];
    
    Object.entries(transitions).forEach(([from, tos]) => {
      const totalFrom = Object.values(tos).reduce((a, b) => a + b, 0);
      
      Object.entries(tos).forEach(([to, count]) => {
        if (from !== to && count > 0) {
          const strength = count / totalFrom;
          correlations.push({
            from,
            to,
            strength: Math.round(strength * 100),
            count,
          });
        }
      });
    });
    
    // 排序並返回前10個最強的關聯
    return correlations
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);
  }, [records, getEmotionValue]);

  // 情緒日曆熱力圖數據
  const emotionCalendarData = useMemo(() => {
    const data: Record<string, { count: number; avgIntensity: number; dominantEmotion: string }> = {};
    
    records.forEach(record => {
      const emotion = getEmotionValue(record);
      const date = new Date(record.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      if (!data[dateKey]) {
        data[dateKey] = {
          count: 0,
          avgIntensity: 0,
          dominantEmotion: emotion,
        };
      }
      
      data[dateKey].count += 1;
      data[dateKey].avgIntensity = Math.round(
        (data[dateKey].avgIntensity * (data[dateKey].count - 1) + record.intensity) / data[dateKey].count
      );
    });
    
    return data;
  }, [records, getEmotionValue]);

  const chartConfig = {
    count: {
      label: t("timeline.stats.total"),
      color: "hsl(var(--chart-1))",
    },
  };

  // 打開導出格式選擇對話框
  const handleExportClick = useCallback((records: EmotionRecord[], descriptions: Record<string, string>) => {
    setRecordsToExport(records);
    setDescriptionsToExport(descriptions);
    setExportDialogOpen(true);
  }, []);

  // 格式化日期
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    if (dateFormat === "iso") {
      return date.toISOString();
    } else if (dateFormat === "custom") {
      return format(date, "yyyy-MM-dd HH:mm:ss", { locale: i18n.language === 'zh-TW' ? zhTW : enUS });
    } else {
      return date.toLocaleString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US');
    }
  }, [dateFormat, i18n.language]);

  // 執行導出
  const executeExport = useCallback((format: "csv" | "json" | "pdf" | "markdown") => {
    setExportDialogOpen(false);
    const records = recordsToExport;
    const descriptions = descriptionsToExport;
    const isZh = i18n.language === 'zh-TW';

    if (format === "csv") {
      // 匯出為 CSV - 支持自定義字段
      const fieldLabels: Record<string, string> = {
        date: isZh ? "日期" : "Date",
        emotion: isZh ? "情緒" : "Emotion",
        intensity: isZh ? "強度" : "Intensity",
        description: isZh ? "描述" : "Description",
        storage: isZh ? "儲存類型" : "Storage",
        privacy: isZh ? "是否公開" : "Privacy",
        status: isZh ? "狀態" : "Status",
        suiRef: isZh ? "Sui 引用" : "Sui Reference",
        transactionDigest: isZh ? "鑄造交易" : "Mint Transaction",
      };

      const headers: string[] = [];
      const fieldOrder: Array<keyof typeof customExportFields> = ["date", "emotion", "intensity", "description", "storage", "privacy", "status", "suiRef", "transactionDigest"];
      
      fieldOrder.forEach(field => {
        if (customExportFields[field]) {
          headers.push(fieldLabels[field]);
        }
      });

      const rows = records.map(record => {
        const isLocal = isLocalRecord(record);
        const emotionValue = getEmotionValue(record);
        const row: string[] = [];
        
        if (customExportFields.date) {
          row.push(formatDate(record.created_at));
        }
        if (customExportFields.emotion) {
          row.push(emotionLabels[emotionValue as keyof typeof emotionLabels]?.label || emotionValue);
        }
        if (customExportFields.intensity) {
          row.push(record.intensity.toString());
        }
        if (customExportFields.description) {
          row.push(descriptions[record.id] || record.description || "");
        }
        if (customExportFields.storage) {
          row.push(isLocal ? t("timeline.filter.local") : t("timeline.filter.walrus"));
        }
        if (customExportFields.privacy) {
          row.push(record.is_public ? t("timeline.publicRecord") : t("timeline.privateRecord"));
        }
        if (customExportFields.status) {
          row.push(record.proof_status === "confirmed" ? t("timeline.verified") : record.proof_status === "pending" ? t("timeline.pending") : t("timeline.failed"));
        }
        if (customExportFields.suiRef && record.sui_ref) {
          row.push(record.sui_ref);
        }
        if (customExportFields.transactionDigest && record.transaction_digest) {
          row.push(record.transaction_digest);
        }
        
        return row;
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `emotion-records-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: t("timeline.exportSuccess") || "匯出成功",
        description: (t("timeline.exportSuccessDesc", { count: records.length }) || `已匯出 ${records.length} 條記錄為 CSV 格式`).replace("{{count}}", records.length.toString()),
      });
    } else if (format === "json") {
      // 匯出為 JSON - 支持自定義字段
      const jsonData = records.map(record => {
        const isLocal = isLocalRecord(record);
        const emotionValue = getEmotionValue(record);
        const data: any = {};
        
        if (customExportFields.date) {
          data.date = formatDate(record.created_at);
        }
        if (customExportFields.emotion) {
          data.emotion = emotionValue;
          data.emotionLabel = emotionLabels[emotionValue as keyof typeof emotionLabels]?.label || emotionValue;
        }
        if (customExportFields.intensity) {
          data.intensity = record.intensity;
        }
        if (customExportFields.description) {
          data.description = descriptions[record.id] || record.description || "";
        }
        if (customExportFields.storage) {
          data.storage = isLocal ? "local" : "walrus";
        }
        if (customExportFields.privacy) {
          data.isPublic = record.is_public;
        }
        if (customExportFields.status) {
          data.proofStatus = record.proof_status;
        }
        if (customExportFields.suiRef && record.sui_ref) {
          data.suiRef = record.sui_ref;
        }
        if (customExportFields.transactionDigest && record.transaction_digest) {
          data.transactionDigest = record.transaction_digest;
          // 同時提供 Sui Scan 鏈接
          data.transactionUrl = getSuiScanTransactionUrl(record.transaction_digest) || null;
        }
        
        // 始終包含 ID（用於追蹤）
        data.id = record.id;
        
        return data;
      });

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `emotion-records-${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: t("timeline.exportSuccess") || "匯出成功",
        description: (t("timeline.exportSuccessDesc", { count: records.length }) || `已匯出 ${records.length} 條記錄為 JSON 格式`).replace("{{count}}", records.length.toString()),
      });
    } else if (format === "pdf") {
      // 匯出為 PDF - 支持自定義字段
      const doc = new jsPDF();
      
      // 設置字體（jsPDF 默認不支持中文，需要特殊處理）
      // 這裡使用簡化版本，實際生產環境可能需要添加中文字體支持
      doc.setFontSize(16);
      doc.text(isZh ? "情緒記錄報告" : "Emotion Records Report", 14, 20);
      
      doc.setFontSize(10);
      const exportDate = new Date().toLocaleString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US');
      doc.text(`${isZh ? "導出日期" : "Export Date"}: ${exportDate}`, 14, 30);
      doc.text(`${isZh ? "記錄數量" : "Total Records"}: ${records.length}`, 14, 36);
      
      let yPos = 50;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const lineHeight = 8;
      
      records.forEach((record, index) => {
        // 檢查是否需要新頁面
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }
        
        const isLocal = isLocalRecord(record);
        const emotionValue = getEmotionValue(record);
        const emotionLabel = emotionLabels[emotionValue as keyof typeof emotionLabels]?.label || emotionValue;
        const emotionEmoji = emotionLabels[emotionValue as keyof typeof emotionLabels]?.emoji || "😊";
        const dateStr = formatDate(record.created_at);
        const description = descriptions[record.id] || record.description || (isZh ? "無描述" : "No description");
        
        // 記錄標題
        if (customExportFields.emotion) {
          doc.setFontSize(12);
          doc.text(`${emotionEmoji} ${emotionLabel}`, margin, yPos);
          yPos += lineHeight;
        }
        
        // 根據自定義字段顯示內容
        doc.setFontSize(10);
        if (customExportFields.date) {
          doc.text(`${isZh ? "日期" : "Date"}: ${dateStr}`, margin, yPos);
          yPos += lineHeight;
        }
        if (customExportFields.intensity) {
          doc.text(`${isZh ? "強度" : "Intensity"}: ${record.intensity}%`, margin, yPos);
          yPos += lineHeight;
        }
        if (customExportFields.description) {
          const maxDescWidth = 180;
          const descLines = doc.splitTextToSize(`${isZh ? "描述" : "Description"}: ${description}`, maxDescWidth);
          doc.text(descLines, margin, yPos);
          yPos += lineHeight * descLines.length;
        }
        if (customExportFields.storage) {
          doc.text(`${isZh ? "儲存" : "Storage"}: ${isLocal ? (isZh ? "本地" : "Local") : "Walrus"}`, margin, yPos);
          yPos += lineHeight;
        }
        if (customExportFields.privacy) {
          doc.text(`${isZh ? "隱私" : "Privacy"}: ${record.is_public ? (isZh ? "公開" : "Public") : (isZh ? "私有" : "Private")}`, margin, yPos);
          yPos += lineHeight;
        }
        if (customExportFields.status) {
          const statusText = record.proof_status === "confirmed" ? (isZh ? "已驗證" : "Verified") : 
                           record.proof_status === "pending" ? (isZh ? "待處理" : "Pending") : 
                           (isZh ? "失敗" : "Failed");
          doc.text(`${isZh ? "狀態" : "Status"}: ${statusText}`, margin, yPos);
          yPos += lineHeight;
        }
        if (customExportFields.suiRef && record.sui_ref) {
          doc.text(`${isZh ? "Sui 引用" : "Sui Reference"}: ${record.sui_ref}`, margin, yPos);
          yPos += lineHeight;
        }
        if (customExportFields.transactionDigest && record.transaction_digest) {
          doc.text(`${isZh ? "鑄造交易" : "Mint Transaction"}: ${record.transaction_digest}`, margin, yPos);
          yPos += lineHeight;
        }
        
        yPos += 5;
        
        // 分隔線
        if (index < records.length - 1) {
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPos, 200 - margin, yPos);
          yPos += 5;
        }
      });
      
      doc.save(`emotion-records-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: t("timeline.exportSuccess") || "匯出成功",
        description: (t("timeline.exportSuccessPDF", { count: records.length }) || `已匯出 ${records.length} 條記錄為 PDF 格式`).replace("{{count}}", records.length.toString()),
      });
    } else if (format === "markdown") {
      // 匯出為 Markdown - 支持自定義字段
      const mdContent: string[] = [];
      
      // 標題
      mdContent.push(`# ${isZh ? "情緒記錄報告" : "Emotion Records Report"}\n`);
      mdContent.push(`${isZh ? "導出日期" : "Export Date"}: ${new Date().toLocaleString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US')}\n`);
      mdContent.push(`${isZh ? "記錄數量" : "Total Records"}: ${records.length}\n\n`);
      mdContent.push("---\n\n");
      
      // 記錄列表
      records.forEach((record, index) => {
        const isLocal = isLocalRecord(record);
        const emotionValue = getEmotionValue(record);
        const emotionLabel = emotionLabels[emotionValue as keyof typeof emotionLabels]?.label || emotionValue;
        const emotionEmoji = emotionLabels[emotionValue as keyof typeof emotionLabels]?.emoji || "😊";
        const dateStr = formatDate(record.created_at);
        const description = descriptions[record.id] || record.description || (isZh ? "無描述" : "No description");
        
        // 根據自定義字段顯示內容
        if (customExportFields.emotion) {
          mdContent.push(`## ${emotionEmoji} ${emotionLabel}\n\n`);
        }
        
        if (customExportFields.date) {
          mdContent.push(`**${isZh ? "日期" : "Date"}**: ${dateStr}  \n`);
        }
        if (customExportFields.intensity) {
          mdContent.push(`**${isZh ? "強度" : "Intensity"}**: ${record.intensity}%  \n`);
        }
        if (customExportFields.description) {
          mdContent.push(`**${isZh ? "描述" : "Description"}**: ${description}  \n`);
        }
        if (customExportFields.storage) {
          mdContent.push(`**${isZh ? "儲存" : "Storage"}**: ${isLocal ? (isZh ? "本地" : "Local") : "Walrus"}  \n`);
        }
        if (customExportFields.privacy) {
          mdContent.push(`**${isZh ? "隱私" : "Privacy"}**: ${record.is_public ? (isZh ? "公開" : "Public") : (isZh ? "私有" : "Private")}  \n`);
        }
        if (customExportFields.status) {
          const statusText = record.proof_status === "confirmed" ? (isZh ? "已驗證" : "Verified") : 
                           record.proof_status === "pending" ? (isZh ? "待處理" : "Pending") : 
                           (isZh ? "失敗" : "Failed");
          mdContent.push(`**${isZh ? "狀態" : "Status"}**: ${statusText}  \n`);
        }
        if (customExportFields.suiRef && record.sui_ref) {
          mdContent.push(`**${isZh ? "Sui 引用" : "Sui Reference"}**: ${record.sui_ref}  \n`);
        }
        if (customExportFields.transactionDigest && record.transaction_digest) {
          const txUrl = getSuiScanTransactionUrl(record.transaction_digest);
          if (txUrl) {
            mdContent.push(`**${isZh ? "鑄造交易" : "Mint Transaction"}**: [${record.transaction_digest}](${txUrl})  \n`);
          } else {
            mdContent.push(`**${isZh ? "鑄造交易" : "Mint Transaction"}**: ${record.transaction_digest}  \n`);
          }
        }
        
        mdContent.push("\n---\n\n");
      });
      
      const blob = new Blob([mdContent.join("")], { type: "text/markdown;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `emotion-records-${new Date().toISOString().split('T')[0]}.md`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: t("timeline.exportSuccess") || "匯出成功",
        description: (t("timeline.exportSuccessMarkdown", { count: records.length }) || `已匯出 ${records.length} 條記錄為 Markdown 格式`).replace("{{count}}", records.length.toString()),
      });
    }
  }, [t, i18n.language, emotionLabels, isLocalRecord, recordsToExport, descriptionsToExport, customExportFields, dateFormat, formatDate, getEmotionValue]);

  // 舊的導出函數（保持向後兼容）
  const exportData = useCallback((recordsToExport: EmotionRecord[], descriptions: Record<string, string>) => {
    handleExportClick(recordsToExport, descriptions);
  }, [handleExportClick]);

  // 刪除記錄
  const handleDeleteClick = useCallback((record: EmotionRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!recordToDelete) return;
    
    // 檢查是否為 NFT 記錄（id 和 sui_ref 相同）
    const isNFTRecord = recordToDelete.sui_ref && recordToDelete.id === recordToDelete.sui_ref;
    
    // 如果是 NFT 記錄，顯示特殊提示
    if (isNFTRecord) {
      const confirmMessage = "⚠️ 這是 NFT 記錄\n\n刪除操作只會從本地數據庫移除記錄，鏈上的 NFT 仍然存在且無法刪除。\n\n確定要繼續嗎？";
      if (!window.confirm(confirmMessage)) {
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
        return;
      }
    }
    
    setIsDeleting(true);
    try {
      const isLocal = isLocalRecord(recordToDelete);
      
      // CRITICAL: Execute deletion first, only update state if deletion succeeds
      // This prevents state inconsistency if deletion fails
      if (isLocal) {
        // 本地記錄：從本地儲存刪除
        await deleteEmotionRecord(recordToDelete.id, currentAccount?.address || null);
      } else {
        // Walrus 記錄：從 Supabase 刪除（鏈上資料無法真正刪除，只能標記）
        if (SUPABASE_ENABLED) {
          const session = await getSupabaseSessionSafe();
          if (session && recordToDelete.id) {
            const { error } = await supabase
              .from('emotion_records')
              .delete()
              .eq('id', recordToDelete.id);
            
            if (error) throw error;
          }
        } else {
          console.log("[Timeline] Supabase disabled; removing remote record locally only");
        }
      }
      
      // Only update state after successful deletion
      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
      setDecryptedDescriptions(prev => {
        const next = { ...prev };
        delete next[recordToDelete.id];
        return next;
      });
      setDecryptedAiResponses(prev => {
        const next = { ...prev };
        delete next[recordToDelete.id];
        return next;
      });
      setDecryptedEmotions(prev => {
        const next = { ...prev };
        delete next[recordToDelete.id];
        return next;
      });
      
      toast({
        title: t("timeline.deleteSuccess") || "刪除成功",
        description: isNFTRecord 
          ? "記錄已從數據庫刪除（鏈上 NFT 仍然存在）"
          : (t("timeline.deleteSuccessDesc") || "記錄已刪除"),
      });
      
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error: any) {
      console.error("[Timeline] Delete error:", error);
      toast({
        title: t("timeline.deleteError") || "刪除失敗",
        description: error?.message || t("timeline.deleteErrorDesc") || "無法刪除記錄",
        variant: "destructive",
      });
      // Don't update state if deletion failed - record should still be visible
    } finally {
      setIsDeleting(false);
    }
  }, [recordToDelete, currentAccount, toast, t, isLocalRecord, SUPABASE_ENABLED, getSupabaseSessionSafe]);

  // 批量操作
  const toggleSelection = useCallback((recordId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  }, [selectedIds.size, filteredRecords]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    const confirmMessage = t("timeline.batchDeleteConfirm", { count: selectedIds.size }) || 
      `確定要刪除 ${selectedIds.size} 條記錄嗎？此操作無法撤銷。`;
    
    if (!window.confirm(confirmMessage)) return;
    
    const idsToDelete = Array.from(selectedIds);
    
    // Use Promise.allSettled to handle partial failures gracefully
    const deletePromises = idsToDelete.map(async (id) => {
      const record = records.find(r => r.id === id);
      if (!record) {
        return { id, status: 'rejected' as const, error: new Error('Record not found') };
      }
      
      try {
        const isLocal = isLocalRecord(record);
        if (isLocal) {
          await deleteEmotionRecord(id, currentAccount?.address || null);
        } else {
          if (SUPABASE_ENABLED) {
            const session = await getSupabaseSessionSafe();
            if (session) {
              const { error } = await supabase.from('emotion_records').delete().eq('id', id);
              if (error) throw error;
            } else {
              throw new Error('No session for deleting remote record');
            }
          } else {
            console.log("[Timeline] Supabase disabled; removing remote record locally only (batch)");
          }
        }
        return { id, status: 'fulfilled' as const };
      } catch (error) {
        console.error(`[Timeline] Failed to delete record ${id}:`, error);
        return { id, status: 'rejected' as const, error: error instanceof Error ? error : new Error(String(error)) };
      }
    });
    
    const results = await Promise.allSettled(deletePromises);
    
    // Extract successful and failed deletions
    const successfulIds: string[] = [];
    const failedIds: string[] = [];
    
    results.forEach((result, index) => {
      const id = idsToDelete[index];
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
        successfulIds.push(id);
      } else {
        failedIds.push(id);
      }
    });
    
    // Only remove successfully deleted records from state
    if (successfulIds.length > 0) {
      setRecords(prev => prev.filter(r => !successfulIds.includes(r.id)));
      setDecryptedDescriptions(prev => {
        const next = { ...prev };
        successfulIds.forEach(id => delete next[id]);
        return next;
      });
      setDecryptedAiResponses(prev => {
        const next = { ...prev };
        successfulIds.forEach(id => delete next[id]);
        return next;
      });
      setDecryptedEmotions(prev => {
        const next = { ...prev };
        successfulIds.forEach(id => delete next[id]);
        return next;
      });
    }
    
    // Clear selection only if all deletions succeeded
    if (failedIds.length === 0) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      // Keep only failed IDs in selection so user can retry
      setSelectedIds(new Set(failedIds));
    }
    
    // Show appropriate toast message
    if (successfulIds.length === idsToDelete.length) {
      toast({
        title: t("timeline.batchDeleteComplete") || "批量刪除完成",
        description: t("timeline.batchDeleteCompleteDesc", { success: successfulIds.length, fail: 0 }) || 
          `成功刪除 ${successfulIds.length} 條記錄`,
      });
    } else if (successfulIds.length > 0) {
      toast({
        title: t("timeline.batchDeletePartial") || "部分刪除成功",
        description: t("timeline.batchDeleteCompleteDesc", { 
          success: successfulIds.length, 
          fail: failedIds.length 
        }) || `成功刪除 ${successfulIds.length} 條，失敗 ${failedIds.length} 條`,
        variant: "default",
      });
    } else {
      toast({
        title: t("timeline.batchDeleteError") || "批量刪除失敗",
        description: t("timeline.batchDeleteErrorDesc") || `所有 ${failedIds.length} 條記錄刪除失敗`,
        variant: "destructive",
      });
    }
  }, [selectedIds, records, currentAccount, toast, t, isLocalRecord, SUPABASE_ENABLED, getSupabaseSessionSafe]);

  const handleBatchExport = useCallback(() => {
    const recordsToExport = filteredRecords.filter(r => selectedIds.has(r.id));
    if (recordsToExport.length === 0) {
      toast({
        title: t("timeline.noSelection") || "未選擇記錄",
        description: t("timeline.noSelectionDesc") || "請先選擇要匯出的記錄",
      });
      return;
    }
    exportData(recordsToExport, decryptedDescriptions);
  }, [selectedIds, filteredRecords, decryptedDescriptions, exportData, toast, t]);

  // 查看記錄詳情
  const handleViewDetails = useCallback((record: EmotionRecord) => {
    setSelectedRecord(record);
    setDetailDialogOpen(true);
  }, []);

  // 監聽對話框關閉，強制清理 overlay 和 body lock
  useEffect(() => {
    if (!detailDialogOpen) {
      // 對話框已關閉，立即強制清理所有可能阻塞的元素
      const cleanup = () => {
        // 1. 確保 body 樣式完全恢復（最優先）
        document.body.style.removeProperty('pointer-events');
        document.body.style.removeProperty('overflow');
        document.body.classList.remove('overflow-hidden');
        
        // 2. 移除所有已關閉的 Radix portal（包括 overlay 和 content）
        const portals = document.querySelectorAll('[data-radix-portal]');
        portals.forEach(portal => {
          const hasClosedContent = portal.querySelector('[data-radix-dialog-content][data-state="closed"]');
          const hasClosedOverlay = portal.querySelector('[data-state="closed"]');
          if (hasClosedContent || hasClosedOverlay) {
            try {
              portal.remove();
            } catch (e) {
              try {
                if (portal.parentNode) {
                  portal.parentNode.removeChild(portal);
                }
              } catch (e2) {
                // 忽略錯誤
              }
            }
          }
        });
        
        // 3. 移除所有可能殘留的 overlay（直接查找所有可能的 overlay）
        const allOverlays = document.querySelectorAll('[data-radix-dialog-overlay], .fixed.inset-0.z-50');
        allOverlays.forEach(overlay => {
          const htmlEl = overlay as HTMLElement;
          const state = htmlEl.getAttribute('data-state');
          if (state === 'closed' || (!state && htmlEl.style.opacity === '0')) {
            try {
              htmlEl.remove();
            } catch (e) {
              try {
                if (htmlEl.parentNode) {
                  htmlEl.parentNode.removeChild(htmlEl);
                }
              } catch (e2) {
                // 忽略錯誤
              }
            }
          }
        });
        
        // 4. 移除所有可能殘留的 focus guard
        const focusGuards = document.querySelectorAll('[data-radix-focus-guard]');
        focusGuards.forEach(guard => {
          try {
            guard.remove();
          } catch (e) {
            try {
              if (guard.parentNode) {
                guard.parentNode.removeChild(guard);
              }
            } catch (e2) {
              // 忽略錯誤
            }
          }
        });
        
        // 5. 強制重新啟用所有交互元素
        const interactiveElements = document.querySelectorAll('button, a, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])');
        interactiveElements.forEach(el => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.pointerEvents === 'none') {
            htmlEl.style.pointerEvents = '';
          }
        });
      };
      
      // 立即執行清理
      cleanup();
      // 再延遲執行一次確保清理（等待動畫完成）
      const timeoutId = setTimeout(cleanup, 300);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [detailDialogOpen]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.back")}
          </Button>
          <div className="flex items-center gap-2">
            <GlobalControls />
            <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
              <Home className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Offline Status Banner */}
        {!isOnline && (
          <Card className="p-4 mb-4 bg-orange-500/10 border-orange-500/30">
            <div className="flex items-start gap-3">
              <div className="text-orange-500 mt-0.5">📡</div>
              <div className="flex-1 text-sm">
                <div className="font-semibold text-orange-600 dark:text-orange-400 mb-1">
                  {t("timeline.offline") || "網路已斷開"}
                </div>
                <div className="text-muted-foreground">
                  {t("timeline.offlineDesc") || "您只能查看已載入的記錄。"}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Testnet Warning Banner - 只顯示一次 */}
        {showWarningBanner && isTestnet && (
          <Card 
            key="testnet-warning-banner" 
            className="p-4 mb-4 bg-yellow-500/10 border-yellow-500/30"
          >
            <div className="text-sm">
              <div className="font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
                {t("timeline.testnetWarning")}
              </div>
              <div className="text-muted-foreground">
                {t("timeline.testnetWarningDesc")}
              </div>
            </div>
          </Card>
        )}

        {/* User Info Debug (if logged in) */}
        {session?.user && (
          <Card className="p-4 mb-4 bg-muted/30 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-4 h-4 text-primary" />
                <div>
                  <div className="font-medium">{t("timeline.currentAccount")}</div>
                  <div className="text-muted-foreground">
                    {session.user.email} <span className="text-xs opacity-70">(ID: {session.user.id.slice(0, 8)}...)</span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast({
                    title: t("timeline.loggedOut"),
                    description: t("timeline.loggedOutDesc"),
                  });
                  navigate("/auth");
                }}
              >
                {t("timeline.logout")}
              </Button>
            </div>
          </Card>
        )}

        {/* Header */}
        <div className="glass-card rounded-2xl p-8 mb-6">
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion shadow-md mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold">{t("timeline.title")}</h1>
            <p className="text-muted-foreground">{t("timeline.subtitle")}</p>
          </div>

          {/* Search, Filter, Sort and Export */}
          <div className="space-y-4 mb-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder={t("timeline.searchPlaceholder") || "搜尋情緒、描述或日期..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                aria-label={t("timeline.search") || "搜尋記錄"}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                  aria-label={t("timeline.clearSearch") || "清除搜尋"}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {searchQuery && (
                <div className="absolute right-12 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                  {filteredRecords.length} {t("timeline.results") || "结果"}
                </div>
              )}
            </div>

            {/* Filter, Sort and Export */}
            <div className="flex items-center gap-3 justify-between flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-2">
                  {(["all", "local", "walrus", "sealPolicies"] as FilterType[]).map((filterType) => {
                    const isSealPolicies = filterType === "sealPolicies";
                    const showCount = isSealPolicies && !checkingSealPolicies && filter === filterType;
                    const count = isSealPolicies ? recordsWithSealPolicies.size : 0;
                    
                    return (
                      <Button
                        key={filterType}
                        variant={filter === filterType ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setFilter(filterType);
                          if (isSealPolicies) {
                            console.log(`[Timeline] 🔍 切换到 Seal Access Policies 筛选器，当前有 ${count} 个记录`);
                          }
                        }}
                        className={filter === filterType ? "gradient-emotion" : ""}
                        disabled={isSealPolicies && checkingSealPolicies}
                        title={isSealPolicies && !checkingSealPolicies 
                          ? `找到 ${count} 个使用 Seal Access Policies 的记录`
                          : isSealPolicies && checkingSealPolicies
                          ? "正在检查 Seal Access Policies..."
                          : undefined
                        }
                      >
                        {isSealPolicies && checkingSealPolicies ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t(`timeline.filter.${filterType}`)}
                          </>
                        ) : (
                          <>
                            {t(`timeline.filter.${filterType}`)}
                            {showCount && count > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 text-xs bg-background/50 rounded">
                                {count}
                              </span>
                            )}
                          </>
                        )}
                      </Button>
                    );
                  })}
                </div>
                
                {/* Date Range */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "yyyy-MM-dd", { locale: i18n.language === 'zh-TW' ? zhTW : enUS })} - {format(dateRange.to, "yyyy-MM-dd", { locale: i18n.language === 'zh-TW' ? zhTW : enUS })}
                          </>
                        ) : (
                          format(dateRange.from, "yyyy-MM-dd", { locale: i18n.language === 'zh-TW' ? zhTW : enUS })
                        )
                      ) : (
                        t("timeline.dateRange") || "日期范围"
                      )}
                      {dateRange?.from && (
                        <X 
                          className="h-3 w-3 ml-1" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDateRange(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange?.from, to: dateRange?.to }}
                      onSelect={(range) => setDateRange(range)}
                      numberOfMonths={2}
                      locale={i18n.language === 'zh-TW' ? zhTW : enUS}
                    />
                  </PopoverContent>
                </Popover>

                {/* Tags Filter */}
                {availableTags.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" />
                        {selectedTags.length > 0 ? (
                          <>
                            {t("timeline.tagsFilter") || "標籤"} ({selectedTags.length})
                          </>
                        ) : (
                          t("timeline.tagsFilter") || "標籤"
                        )}
                        {selectedTags.length > 0 && (
                          <X 
                            className="h-3 w-3 ml-1" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTags([]);
                            }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          {t("timeline.selectTags") || "選擇標籤"}
                        </Label>
                        <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                          {availableTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setSelectedTags(prev => 
                                  prev.includes(tag) 
                                    ? prev.filter(t => t !== tag)
                                    : [...prev, tag]
                                );
                              }}
                              className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                                selectedTags.includes(tag)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background hover:bg-muted border-border"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        {selectedTags.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTags([])}
                            className="w-full mt-2"
                          >
                            {t("timeline.clearTags") || "清除標籤"}
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                
                {/* Sort */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">{t("timeline.sort.date") || "按日期"}</SelectItem>
                      <SelectItem value="intensity">{t("timeline.sort.intensity") || "按强度"}</SelectItem>
                      <SelectItem value="emotion">{t("timeline.sort.emotion") || "按情绪"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    aria-label={t("timeline.toggleSortOrder") || "切换排序顺序"}
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Batch Selection Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    setSelectedIds(new Set());
                  }}
                  className={selectionMode ? "bg-primary text-primary-foreground" : ""}
                >
                  {selectionMode ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
                  {t("timeline.batchMode") || "批量"}
                </Button>
                
                {/* Export Button */}
                {filteredRecords.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportData(filteredRecords, decryptedDescriptions)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {t("timeline.export") || "匯出"}
                  </Button>
                )}
                
                {/* 同步链上 NFT 按钮 */}
                {currentAccount && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncNFTsFromChain}
                    disabled={isQueryingOnChain}
                    title={t("timeline.syncNFTs.tooltip")}
                  >
                    {isQueryingOnChain ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("timeline.syncNFTs.syncing")}
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        {t("timeline.syncNFTs.button")}
                      </>
                    )}
                  </Button>
                )}
                
                {/* 一鍵解密按鈕 */}
                {filteredRecords.some(r => 
                  !r.is_public && 
                  !decryptedDescriptions[r.id] && 
                  !(isLocalRecord(r) && !r.encrypted_data) &&
                  (r.encrypted_data || (r.blob_id && !r.blob_id.startsWith("local_")))
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={decryptAllRecords}
                    disabled={isDecryptingAll}
                  >
                    {isDecryptingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("timeline.decryptAll.decrypting")}
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 mr-2" />
                        {t("timeline.decryptAll.button")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Batch Operations Toolbar */}
            {selectionMode && selectedIds.size > 0 && (
              <Card className="p-4 mb-4 bg-primary/10 border-primary/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {t("timeline.selectedCount", { count: selectedIds.size }) || `已選擇 ${selectedIds.size} 條記錄`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleSelectAll}
                    >
                      {selectedIds.size === filteredRecords.length ? t("timeline.deselectAll") || "取消全選" : t("timeline.selectAll") || "全選"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchExport}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {t("timeline.batchExport") || "批量匯出"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBatchDelete}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("timeline.batchDelete") || "批量刪除"}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <Card className="p-4 glass-card">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">{t("timeline.stats.total")}</div>
            </Card>
            <Card className="p-4 glass-card">
              <div className="text-2xl font-bold">{stats.local}</div>
              <div className="text-xs text-muted-foreground">{t("timeline.stats.local")}</div>
            </Card>
            <Card className="p-4 glass-card">
              <div className="text-2xl font-bold">{stats.walrus}</div>
              <div className="text-xs text-muted-foreground">{t("timeline.stats.walrus")}</div>
            </Card>
            <Card className="p-4 glass-card">
              <div className="text-2xl font-bold">{stats.avgIntensity}%</div>
              <div className="text-xs text-muted-foreground">{t("timeline.stats.averageIntensity")}</div>
            </Card>
          </div>

          {/* Charts */}
          {records.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4 mb-6 overflow-x-auto">
              {/* Emotion Distribution Pie Chart */}
              {emotionChartData.length > 0 && (
                <Card className="p-6 glass-card overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">{t("timeline.chart.emotionDistribution")}</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full overflow-hidden">
                    <PieChart>
                      <Pie
                        data={emotionChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, emoji }) => `${emoji} ${value}`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {emotionChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </Card>
              )}

              {/* Storage Distribution Pie Chart */}
              {storageChartData.some(d => d.value > 0) && (
                <Card className="p-6 glass-card overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">{t("timeline.chart.storageDistribution")}</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full overflow-hidden">
                    <PieChart>
                      <Pie
                        data={storageChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {storageChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </Card>
              )}
            </div>
          )}

          {/* Timeline Chart with View Period Toggle */}
          {records.length > 0 && timelineChartData.some(d => d.count > 0) && (
            <Card className="p-6 glass-card mb-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t("timeline.chart.timelineChart")}</h3>
                <div className="flex gap-2">
                  <Button
                    variant={viewPeriod === "week" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewPeriod("week")}
                  >
                    {t("timeline.viewPeriod.week") || "週"}
                  </Button>
                  <Button
                    variant={viewPeriod === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewPeriod("month")}
                  >
                    {t("timeline.viewPeriod.month") || "月"}
                  </Button>
                  <Button
                    variant={viewPeriod === "year" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewPeriod("year")}
                  >
                    {t("timeline.viewPeriod.year") || "年"}
                  </Button>
                </div>
              </div>
              <ChartContainer config={chartConfig} className="h-[200px] w-full overflow-hidden">
                <AreaChart data={timelineChartData} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="avgIntensity" 
                    stroke="hsl(var(--chart-2))" 
                    fill="hsl(var(--chart-2))" 
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ChartContainer>
            </Card>
          )}

          {/* Emotion Trend Prediction */}
          {emotionTrendData && Object.keys(emotionTrendData).length > 0 && (
            <Card className="p-6 glass-card mb-6 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5" />
                <h3 className="text-lg font-semibold">{t("timeline.chart.emotionTrend") || "情緒趨勢預測"}</h3>
              </div>
              <div className="space-y-4">
                {Object.entries(emotionTrendData).slice(0, 3).map(([emotion, data]) => {
                  const config = emotionLabels[emotion as keyof typeof emotionLabels];
                  if (!config) return null;
                  
                  const actualData = data.actual.map((value, index) => ({ 
                    period: index + 1, 
                    value, 
                    predicted: null
                  }));
                  const predictedData = data.predicted.map((value, index) => ({ 
                    period: data.actual.length + index + 1, 
                    value: null,
                    predicted: value
                  }));
                  const chartData = [...actualData, ...predictedData];
                  
                  return (
                    <div key={emotion} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{config.emoji}</span>
                          <span className="font-medium">{config.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${
                            data.trend === 'up' ? 'text-green-500' : 
                            data.trend === 'down' ? 'text-red-500' : 
                            'text-muted-foreground'
                          }`}>
                            {data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'} 
                            {t(`timeline.trend.${data.trend}`) || data.trend}
                          </span>
                        </div>
                      </div>
                      <ChartContainer config={chartConfig} className="h-[120px] w-full">
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                          <XAxis dataKey="period" hide />
                          <YAxis hide />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={config.color}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="predicted" 
                            stroke={config.color}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ChartContainer>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Emotion Correlation Analysis */}
          {emotionCorrelationData && emotionCorrelationData.length > 0 && (
            <Card className="p-6 glass-card mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Link2 className="h-5 w-5" />
                <h3 className="text-lg font-semibold">{t("timeline.chart.emotionCorrelation") || "情緒關聯分析"}</h3>
              </div>
              <div className="space-y-2">
                {emotionCorrelationData.slice(0, 5).map((correlation, index) => {
                  const fromConfig = emotionLabels[correlation.from as keyof typeof emotionLabels];
                  const toConfig = emotionLabels[correlation.to as keyof typeof emotionLabels];
                  if (!fromConfig || !toConfig) return null;
                  
                  return (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-lg">{fromConfig.emoji}</span>
                        <span className="font-medium">{fromConfig.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="font-medium">{toConfig.label}</span>
                        <span className="text-lg">{toConfig.emoji}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-[120px] justify-end">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${correlation.strength}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">
                          {correlation.strength}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Emotion Calendar Heatmap */}
          {Object.keys(emotionCalendarData).length > 0 && (
            <Card className="p-6 glass-card mb-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="h-5 w-5" />
                <h3 className="text-lg font-semibold">{t("timeline.chart.emotionCalendar") || "情緒日曆"}</h3>
              </div>
              <div className="space-y-4">
                <Calendar
                  mode="single"
                  className="rounded-md border"
                  modifiers={{
                    hasRecord: (date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      return !!emotionCalendarData[dateKey];
                    },
                    highIntensity: (date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const data = emotionCalendarData[dateKey];
                      return data && data.avgIntensity >= 70;
                    },
                    mediumIntensity: (date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const data = emotionCalendarData[dateKey];
                      return data && data.avgIntensity >= 40 && data.avgIntensity < 70;
                    },
                    lowIntensity: (date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const data = emotionCalendarData[dateKey];
                      return data && data.avgIntensity < 40;
                    },
                  }}
                  modifiersStyles={{
                    hasRecord: {
                      backgroundColor: 'hsl(var(--primary) / 0.2)',
                    },
                    highIntensity: {
                      backgroundColor: 'hsl(var(--primary) / 0.5)',
                    },
                    mediumIntensity: {
                      backgroundColor: 'hsl(var(--primary) / 0.3)',
                    },
                    lowIntensity: {
                      backgroundColor: 'hsl(var(--primary) / 0.15)',
                    },
                  }}
                  classNames={{
                    day: "relative",
                  }}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/50" />
                    <span>{t("timeline.calendar.highIntensity") || "高強度 (≥70%)"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/30" />
                    <span>{t("timeline.calendar.mediumIntensity") || "中強度 (40-69%)"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/15" />
                    <span>{t("timeline.calendar.lowIntensity") || "低強度 (<40%)"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-muted" />
                    <span>{t("timeline.calendar.noRecord") || "無記錄"}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Records List */}
        <div className="glass-card rounded-2xl p-4 md:p-8">
          {isLoading ? (
            <div className="space-y-4">
              {/* 骨架屏：统计卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-20" />
                  </Card>
                ))}
              </div>
              {/* 骨架屏：记录列表 */}
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 md:p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-20 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
              </div>
            </div>
          ) : (
            <>
              {filteredRecords.length === 0 ? (
                <Card className="p-12 text-center border-dashed">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/30 flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {searchQuery || dateRange?.from || filter !== "all" 
                      ? t("timeline.noResults") || "沒有找到記錄"
                      : t("timeline.noRecords") || "還沒有記錄"}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {searchQuery || dateRange?.from || filter !== "all"
                      ? t("timeline.noResultsDesc") || "嘗試調整搜尋條件或篩選器"
                      : t("timeline.noRecordsDesc") || "開始記錄您的情緒，追蹤您的情感變化，獲得 AI 分析建議。"}
                  </p>
                  <div className="flex gap-3 justify-center">
                    {searchQuery || dateRange?.from || filter !== "all" ? (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSearchQuery("");
                            setDateRange(undefined);
                            setFilter("all");
                          }}
                        >
                          {t("timeline.clearFilters") || "清除篩選"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => navigate("/record")} className="gradient-emotion">
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t("timeline.recordFirst") || "記錄第一條情緒"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            // 可以添加教程或幫助
                            toast({
                              title: t("timeline.getStarted") || "開始使用",
                              description: t("timeline.getStartedDesc") || "選擇情緒、填寫描述，然後儲存您的第一條記錄。",
                            });
                          }}
                        >
                          {t("timeline.viewTutorial") || "查看使用教程"}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ) : (
                <div 
                  ref={parentRef}
                  className="overflow-auto relative"
                  style={{ 
                    height: 'calc(100vh - 420px)', 
                    minHeight: '300px',
                    maxHeight: 'calc(100vh - 200px)',
                  }}
                >
              {filteredRecords.length > 0 && virtualizer.getVirtualItems().map((virtualItem) => {
                const record = filteredRecords[virtualItem.index];
                // 安全檢查：確保記錄存在
                if (!record) return null;
                
                const displayEmotion = getEmotionValue(record);
                const emotionKey = displayEmotion as keyof typeof emotionLabels;
                const emotionConfig = emotionLabels[emotionKey] || {
                  label: displayEmotion.charAt(0).toUpperCase() + displayEmotion.slice(1),
                  emoji: "😊",
                  gradient: "from-gray-400 to-slate-400",
                  color: "#94a3b8",
                };
                const isLocal = isLocalRecord(record);
                
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <Card className={`p-4 md:p-6 hover:border-primary/50 transition-all mb-3 md:mb-4 ${selectionMode && selectedIds.has(record.id) ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="flex items-start gap-3 md:gap-4">
                      {/* Selection Checkbox */}
                      {selectionMode && (
                        <button
                          onClick={() => toggleSelection(record.id)}
                          className="mt-2 flex-shrink-0"
                          aria-label={selectedIds.has(record.id) ? t("timeline.deselect") || "取消選擇" : t("timeline.select") || "選擇"}
                        >
                          {selectedIds.has(record.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      
                      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-gradient-to-br ${emotionConfig.gradient} shadow-md flex-shrink-0`}>
                        <span className="text-xl md:text-2xl">{emotionConfig.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-base md:text-lg truncate">{emotionConfig.label}</h3>
                            <p className="text-xs md:text-sm text-muted-foreground">{t("timeline.intensityValue", { value: record.intensity })}</p>
                          </div>
                          <div className="text-right flex-shrink-0 flex items-center gap-2">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-muted-foreground">
                                {new Date(record.created_at).toLocaleDateString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full inline-block ${
                                isLocal 
                                  ? "bg-purple-500/10 text-purple-500" 
                                  : "bg-cyan-500/10 text-cyan-500"
                              }`}>
                                {isLocal ? "💾 " + t("timeline.filter.local") : "☁️ " + t("timeline.filter.walrus")}
                              </span>
                            </div>
                            {/* 訪問權限管理按鈕 - 僅當記錄是 NFT 時顯示 */}
                            {!selectionMode && record.sui_ref && record.id === record.sui_ref && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRecordForAccessControl(record);
                                  setAccessControlDialogOpen(true);
                                }}
                                className="h-8 px-2 gap-1.5"
                                title={t("timeline.accessControl") || "訪問權限管理"}
                              >
                                <Users className="h-4 w-4" />
                                <span className="hidden sm:inline text-xs">
                                  {t("timeline.accessControl") || "訪問權限管理"}
                                </span>
                              </Button>
                            )}
                            {/* Actions Menu */}
                            {!selectionMode && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewDetails(record)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    {t("timeline.viewDetails") || "查看詳情"}
                                  </DropdownMenuItem>
                                  {/* 訪問權限管理 - 僅當記錄是 NFT 時顯示 */}
                                  {record.sui_ref && record.id === record.sui_ref && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          setSelectedRecordForAccessControl(record);
                                          setAccessControlDialogOpen(true);
                                        }}
                                      >
                                        <Users className="mr-2 h-4 w-4" />
                                        {t("timeline.accessControl") || "訪問權限管理"}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(record)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t("timeline.delete") || "刪除"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        <div className="mb-2">
                          {record.is_public ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Unlock className="w-3 h-3" />
                              <span>{t("timeline.publicRecord")}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Lock className="w-3 h-3" />
                              <span>{t("timeline.privateRecord")}</span>
                            </div>
                          )}
                        </div>
                        {/* Tags */}
                        {record.tags && record.tags.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {record.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-1 rounded-md text-xs bg-primary/10 text-primary border border-primary/20"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {record.is_public && (
                          <div className="mb-3 space-y-2">
                            {/* 公開記錄：如果已有 description，直接顯示 */}
                            {record.description ? (
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {record.description}
                                </p>
                              </div>
                            ) : decryptedDescriptions[record.id] ? (
                              // 已解密，顯示內容
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                  <Unlock className="w-3 h-3 text-green-500" />
                                  <span className="text-green-500">{t("timeline.decrypted")}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {decryptedDescriptions[record.id]}
                                </p>
                              </div>
                            ) : decryptErrors[record.id] ? (
                              // 解密失敗，顯示錯誤資訊和重試按鈕（與私密記錄一致）
                              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 text-xs text-red-500 mb-1">
                                      <Lock className="w-3 h-3" />
                                      <span>{t("timeline.decryptFailed")}</span>
                                    </div>
                                    <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                                      {decryptErrors[record.id]}
                                    </p>
                                    
                                    {/* 詳細錯誤資訊（可展開） */}
                                    {decryptErrorDetails[record.id] && (
                                      <div className="mt-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setExpandedErrorDetails(prev => {
                                              const next = new Set(prev);
                                              if (next.has(record.id)) {
                                                next.delete(record.id);
                                              } else {
                                                next.add(record.id);
                                              }
                                              return next;
                                            });
                                          }}
                                          className="text-xs"
                                        >
                                          {expandedErrorDetails.has(record.id) ? (
                                            <>
                                              <EyeOff className="w-3 h-3 mr-1" />
                                              {t("timeline.hideDetails")}
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="w-3 h-3 mr-1" />
                                              {t("timeline.showDetails")}
                                            </>
                                          )}
                                        </Button>
                                        
                                        {expandedErrorDetails.has(record.id) && (
                                          <div className="mt-2 p-3 rounded bg-red-500/5 border border-red-500/10 text-xs space-y-2">
                                            <div>
                                              <span className="font-semibold text-red-700 dark:text-red-300">
                                                {t("timeline.errorDetail.type")}:
                                              </span>
                                              <span className="ml-2 text-red-600 dark:text-red-400">
                                                {t(`timeline.errorType.${decryptErrorDetails[record.id].type}`)}
                                              </span>
                                            </div>
                                            
                                            {decryptErrorDetails[record.id].statusCode && (
                                              <div>
                                                <span className="font-semibold text-red-700 dark:text-red-300">
                                                  {t("timeline.errorDetail.statusCode")}:
                                                </span>
                                                <span className="ml-2 text-red-600 dark:text-red-400 font-mono">
                                                  {decryptErrorDetails[record.id].statusCode}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {decryptErrorDetails[record.id].blobId && (
                                              <div>
                                                <span className="font-semibold text-red-700 dark:text-red-300">
                                                  {t("timeline.errorDetail.blobId")}:
                                                </span>
                                                <span className="ml-2 text-red-600 dark:text-red-400 font-mono text-xs break-all">
                                                  {decryptErrorDetails[record.id].blobId}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {decryptErrorDetails[record.id].suggestions && decryptErrorDetails[record.id].suggestions.length > 0 && (
                                              <div>
                                                <span className="font-semibold text-red-700 dark:text-red-300 block mb-1">
                                                  {t("timeline.errorDetail.suggestions")}:
                                                </span>
                                                <ul className="list-disc list-inside space-y-1 text-red-600 dark:text-red-400">
                                                  {decryptErrorDetails[record.id].suggestions.map((suggestion, idx) => (
                                                    <li key={idx} className="text-xs whitespace-pre-wrap">{suggestion}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // 清除失敗標記和錯誤資訊，允許重試
                                    setFailedAutoDecrypts(prev => {
                                      const next = new Set(prev);
                                      next.delete(record.id);
                                      return next;
                                    });
                                    setDecryptErrors(prev => {
                                      const next = { ...prev };
                                      delete next[record.id];
                                      return next;
                                    });
                                    setDecryptErrorDetails(prev => {
                                      const next = { ...prev };
                                      delete next[record.id];
                                      return next;
                                    });
                                    decryptDescription(record);
                                  }}
                                  disabled={decryptingRecords.has(record.id)}
                                  className="mt-2"
                                >
                                  {decryptingRecords.has(record.id) ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      {t("timeline.decrypting")}
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="w-4 h-4 mr-2" />
                                      {t("timeline.retryDecrypt")}
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : decryptingRecords.has(record.id) ? (
                              // 正在解密
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>{t("timeline.decrypting")}</span>
                                </div>
                              </div>
                            ) : !isLocalRecord(record) && (record.encrypted_data || record.blob_id) ? (
                              // Walrus 記錄，顯示解密按鈕（雖然應該自動解密，但以防萬一）
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // 清除失敗標記，允許重試
                                    setFailedAutoDecrypts(prev => {
                                      const next = new Set(prev);
                                      next.delete(record.id);
                                      return next;
                                    });
                                    decryptDescription(record);
                                  }}
                                  disabled={decryptingRecords.has(record.id)}
                                >
                                  {decryptingRecords.has(record.id) ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      {t("timeline.decrypting")}
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="w-4 h-4 mr-2" />
                                      {t("timeline.decryptAndView")}
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        )}
                        {!record.is_public && (
                          <div className="mb-3 space-y-2">
                            {/* 本地記錄：如果已有 description，直接顯示（已在讀取時自動解密） */}
                            {isLocal && record.description ? (
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                  <Unlock className="w-3 h-3 text-green-500" />
                                  <span className="text-green-500">{t("timeline.decrypted")}</span>
                                  <span className="text-muted-foreground">（本地儲存）</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {record.description}
                                </p>
                              </div>
                            ) : decryptedDescriptions[record.id] ? (
                              // 已解密，顯示內容
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Unlock className="w-3 h-3 text-green-500" />
                                    <span className="text-green-500">{t("timeline.decrypted")}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // 隱藏解密內容
                                      setDecryptedDescriptions(prev => {
                                        const next = { ...prev };
                                        delete next[record.id];
                                        return next;
                                      });
                                      setDecryptedEmotions(prev => {
                                        const next = { ...prev };
                                        delete next[record.id];
                                        return next;
                                      });
                                      // 清除錯誤資訊
                                      setDecryptErrors(prev => {
                                        const next = { ...prev };
                                        delete next[record.id];
                                        return next;
                                      });
                                    }}
                                    className="h-6 px-2 text-xs"
                                  >
                                    <EyeOff className="w-3 h-3 mr-1" />
                                    {t("timeline.hideContent")}
                                  </Button>
                                </div>
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {decryptedDescriptions[record.id]}
                                </p>
                                {decryptedAiResponses[record.id] && (
                                  <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                                    <div className="flex items-start gap-2">
                                      <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                      <div className="flex-1">
                                        <p className="text-xs font-medium text-primary mb-1">AI 回饋</p>
                                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                                          {decryptedAiResponses[record.id]}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : decryptErrors[record.id] ? (
                              // 解密失敗，顯示錯誤資訊和重試按鈕
                              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 text-xs text-red-500 mb-1">
                                      <Lock className="w-3 h-3" />
                                      <span>{t("timeline.decryptFailed")}</span>
                                    </div>
                                    <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                                      {decryptErrors[record.id]}
                                    </p>
                                    
                                    {/* 詳細錯誤資訊（可展開） */}
                                    {decryptErrorDetails[record.id] && (
                                      <div className="mt-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setExpandedErrorDetails(prev => {
                                              const next = new Set(prev);
                                              if (next.has(record.id)) {
                                                next.delete(record.id);
                                              } else {
                                                next.add(record.id);
                                              }
                                              return next;
                                            });
                                          }}
                                          className="h-6 px-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                        >
                                          {expandedErrorDetails.has(record.id) ? (
                                            <>
                                              <EyeOff className="w-3 h-3 mr-1" />
                                              {t("timeline.hideDetails")}
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="w-3 h-3 mr-1" />
                                              {t("timeline.showDetails")}
                                            </>
                                          )}
                                        </Button>
                                        
                                        {expandedErrorDetails.has(record.id) && (
                                          <div className="mt-2 p-3 rounded bg-red-500/5 border border-red-500/10 text-xs space-y-2">
                                            <div>
                                              <span className="font-semibold text-red-700 dark:text-red-300">
                                                {t("timeline.errorDetail.type")}:
                                              </span>
                                              <span className="ml-2 text-red-600 dark:text-red-400">
                                                {t(`timeline.errorType.${decryptErrorDetails[record.id].type}`)}
                                              </span>
                                            </div>
                                            
                                            {decryptErrorDetails[record.id].statusCode && (
                                              <div>
                                                <span className="font-semibold text-red-700 dark:text-red-300">
                                                  {t("timeline.errorDetail.statusCode")}:
                                                </span>
                                                <span className="ml-2 text-red-600 dark:text-red-400 font-mono">
                                                  {decryptErrorDetails[record.id].statusCode}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {decryptErrorDetails[record.id].blobId && (
                                              <div>
                                                <span className="font-semibold text-red-700 dark:text-red-300">
                                                  {t("timeline.errorDetail.blobId")}:
                                                </span>
                                                <span className="ml-2 text-red-600 dark:text-red-400 font-mono text-[10px] break-all">
                                                  {decryptErrorDetails[record.id].blobId?.slice(0, 20)}...{decryptErrorDetails[record.id].blobId?.slice(-10)}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {record.sui_ref && getSuiScanUrl(record.sui_ref) && (
                                              <div>
                                                <span className="font-semibold text-red-700 dark:text-red-300">
                                                  {t("timeline.errorDetail.suiScan")}:
                                                </span>
                                                <a
                                                  href={getSuiScanUrl(record.sui_ref)!}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="ml-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                                                >
                                                  {t("timeline.viewOnSuiScan")}
                                                  <span className="ml-1">↗</span>
                                                </a>
                                              </div>
                                            )}
                                            
                                            <div>
                                              <span className="font-semibold text-red-700 dark:text-red-300">
                                                {t("timeline.errorDetail.timestamp")}:
                                              </span>
                                              <span className="ml-2 text-red-600 dark:text-red-400">
                                                {new Date(decryptErrorDetails[record.id].timestamp).toLocaleString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                                              </span>
                                            </div>
                                            
                                            {decryptErrorDetails[record.id].suggestions.length > 0 && (
                                              <div>
                                                <span className="font-semibold text-red-700 dark:text-red-300 block mb-1">
                                                  {t("timeline.errorDetail.suggestions")}:
                                                </span>
                                                <ul className="list-disc list-inside space-y-1 text-red-600 dark:text-red-400">
                                                  {decryptErrorDetails[record.id].suggestions.map((suggestion, idx) => (
                                                    <li key={idx}>{suggestion}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {!isLocal && record.blob_id && !record.blob_id.startsWith("local_") && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        // 清除錯誤資訊並重試
                                        setDecryptErrors(prev => {
                                          const next = { ...prev };
                                          delete next[record.id];
                                          return next;
                                        });
                                        setDecryptErrorDetails(prev => {
                                          const next = { ...prev };
                                          delete next[record.id];
                                          return next;
                                        });
                                        setExpandedErrorDetails(prev => {
                                          const next = new Set(prev);
                                          next.delete(record.id);
                                          return next;
                                        });
                                        decryptDescription(record);
                                      }}
                                      disabled={decryptingRecords.has(record.id)}
                                      className="h-7 px-3 text-xs ml-2"
                                    >
                                      {decryptingRecords.has(record.id) ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          {t("timeline.decrypting")}
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="w-3 h-3 mr-1" />
                                          {t("timeline.retryDecrypt")}
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // 未解密，顯示加密提示和解密按鈕
                              <div className="p-3 rounded-lg bg-muted/10 border border-border/30">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-muted-foreground italic">
                                    {t("timeline.encryptedContent")}
                                  </p>
                                  {/* 本地記錄不需要解密按鈕（已在讀取時自動解密），只顯示 Walrus 記錄的解密按鈕 */}
                                  {!isLocal && record.blob_id && !record.blob_id.startsWith("local_") && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => decryptDescription(record)}
                                      disabled={decryptingRecords.has(record.id)}
                                      className="h-7 px-3 text-xs"
                                    >
                                      {decryptingRecords.has(record.id) ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          {t("timeline.decrypting")}
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="w-3 h-3 mr-1" />
                                          {t("timeline.decryptButton")}
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {!isLocal && (
                          <div className="mb-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-cyan-600 dark:text-cyan-400 flex-1">
                                {record.blob_id && !record.blob_id.startsWith("local_") 
                                  ? t("timeline.walrusSaved", { blobId: record.blob_id })
                                  : record.walrus_url && !record.walrus_url.startsWith("local://")
                                  ? t("timeline.walrusSaved", { blobId: record.walrus_url.split("/").pop() || record.walrus_url })
                                  : t("timeline.walrusSaved", { blobId: "N/A" })
                                }
                              </p>
                              {record.sui_ref && getSuiScanUrl(record.sui_ref) && (
                                <a
                                  href={getSuiScanUrl(record.sui_ref)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:underline flex items-center gap-1 whitespace-nowrap"
                                >
                                  {t("timeline.viewOnSuiScan")}
                                  <span>↗</span>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="space-y-2 text-xs">
                          {record.is_public && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Shield className="w-3 h-3" />
                              <span className="font-mono truncate">Blob: {record.blob_id.slice(0, 8)}...{record.blob_id.slice(-8)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 本地儲存的記錄不顯示狀態（用戶已明確選擇本地儲存） */}
                            {!isLocal && (
                              <>
                                {record.proof_status === "confirmed" ? (
                                  <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs">{t("timeline.verified")}</span>
                                ) : record.proof_status === "pending" ? (
                                  <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs">{t("timeline.pending")}</span>
                                ) : (
                                  <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs">{t("timeline.failed")}</span>
                                )}
                              </>
                            )}
                            {/* 檢查是否為 NFT 記錄：id 和 sui_ref 相同，且 blob_id 以 nft_ 開頭或沒有 walrus_url */}
                            {record.sui_ref && record.id === record.sui_ref && (
                              <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                NFT
                              </span>
                            )}
                            {record.sui_ref && (
                              <>
                                <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">{t("timeline.onChain")}</span>
                                {getSuiScanUrl(record.sui_ref) && (
                                  <a
                                    href={getSuiScanUrl(record.sui_ref)!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs hover:bg-blue-500/20 transition-colors inline-flex items-center gap-1"
                                  >
                                    {t("timeline.viewOnSuiScan")}
                                    <span>↗</span>
                                  </a>
                                )}
                                {/* 如果是 NFT 記錄且有交易 digest，顯示查看鑄造交易的鏈接 */}
                                {record.sui_ref && record.id === record.sui_ref && record.transaction_digest && getSuiScanTransactionUrl(record.transaction_digest) && (
                                  <a
                                    href={getSuiScanTransactionUrl(record.transaction_digest)!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs hover:bg-purple-500/20 transition-colors inline-flex items-center gap-1"
                                    title="查看鑄造交易"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    查看鑄造交易
                                    <span>↗</span>
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                  </div>
                );
              })}
              {/* 虛擬滾動的總高度佔位 - 只在有記錄時顯示 */}
              {filteredRecords.length > 0 && (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%' }} />
              )}
            </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("timeline.deleteConfirmTitle") || "確認刪除"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("timeline.deleteConfirmDesc") || "確定要刪除這條記錄嗎？此操作無法撤銷。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "取消"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("timeline.deleting") || "刪除中..."}
                </>
              ) : (
                t("timeline.delete") || "刪除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Record Details Dialog */}
      {selectedRecord && (
        <Dialog 
          key={selectedRecord.id}
          open={detailDialogOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setDetailDialogOpen(false);
              // 立即清理狀態
              setSelectedRecord(null);
            } else {
              setDetailDialogOpen(true);
            }
          }}
        >
          <DialogContent 
            className="max-w-2xl max-h-[80vh] overflow-y-auto"
            onOpenAutoFocus={(e) => {
              // 防止自動聚焦導致問題
              e.preventDefault();
            }}
          >
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">
                    {emotionLabels[selectedRecord.emotion as keyof typeof emotionLabels]?.emoji || "😊"}
                  </span>
                  {emotionLabels[selectedRecord.emotion as keyof typeof emotionLabels]?.label || selectedRecord.emotion}
                </DialogTitle>
                <DialogDescription>
                  {new Date(selectedRecord.created_at).toLocaleString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("timeline.intensity") || "強度"}</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                        style={{ width: `${selectedRecord.intensity}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{selectedRecord.intensity}%</span>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("timeline.description") || "描述"}</h4>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {decryptedDescriptions[selectedRecord.id] || selectedRecord.description || t("timeline.noDescription") || "無描述"}
                    </p>
                  </div>
                </div>
                
                {decryptedAiResponses[selectedRecord.id] && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">{t("timeline.aiResponse") || "AI 建議"}</h4>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {decryptedAiResponses[selectedRecord.id]}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">{t("timeline.storage") || "儲存位置"}</h4>
                    <p className="text-sm">
                      {isLocalRecord(selectedRecord) ? "💾 " + t("timeline.filter.local") : "☁️ " + t("timeline.filter.walrus")}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">{t("timeline.privacy") || "隱私"}</h4>
                    <p className="text-sm">
                      {selectedRecord.is_public ? "🔓 " + t("timeline.publicRecord") : "🔒 " + t("timeline.privateRecord")}
                    </p>
                  </div>
                  {selectedRecord.blob_id && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Blob ID</h4>
                      <p className="text-xs font-mono break-all">{selectedRecord.blob_id}</p>
                    </div>
                  )}
                  {selectedRecord.sui_ref && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">{t("timeline.suiRef") || "Sui 引用"}</h4>
                      <a
                        href={getSuiScanUrl(selectedRecord.sui_ref) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        {selectedRecord.sui_ref.slice(0, 16)}...
                      </a>
                    </div>
                  )}
                  {/* 如果是 NFT 記錄且有交易 digest，顯示鑄造交易鏈接 */}
                  {selectedRecord.sui_ref && selectedRecord.id === selectedRecord.sui_ref && selectedRecord.transaction_digest && getSuiScanTransactionUrl(selectedRecord.transaction_digest) && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">鑄造交易</h4>
                      <a
                        href={getSuiScanTransactionUrl(selectedRecord.transaction_digest)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-500 hover:underline inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        {selectedRecord.transaction_digest.slice(0, 16)}...
                        <span>↗</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* 訪問權限管理對話框 */}
      <Dialog open={accessControlDialogOpen} onOpenChange={setAccessControlDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("timeline.accessControl") || "訪問權限管理"}
            </DialogTitle>
            <DialogDescription>
              {selectedRecordForAccessControl && (
                <>
                  {t("timeline.accessControlDesc") || "管理此記錄的訪問權限，授權他人訪問或撤銷訪問權限"}
                  {selectedRecordForAccessControl.sui_ref && (
                    <span className="block mt-2 text-xs font-mono text-muted-foreground">
                      NFT ID: {selectedRecordForAccessControl.sui_ref.slice(0, 10)}...{selectedRecordForAccessControl.sui_ref.slice(-8)}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedRecordForAccessControl && selectedRecordForAccessControl.sui_ref && (
            <AccessControlManager
              entryNftId={selectedRecordForAccessControl.sui_ref}
              network={selectedRecordNetwork}
              onAccessChanged={() => {
                toast({
                  title: t("timeline.accessControlUpdated") || "訪問權限已更新",
                  description: t("timeline.accessControlUpdatedDesc") || "訪問權限變更已成功",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Export Format Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("timeline.export") || "匯出"}</DialogTitle>
            <DialogDescription>
              {t("timeline.exportDialogDesc", { count: recordsToExport.length }) || `選擇匯出格式和選項（共 ${recordsToExport.length} 條記錄）`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* 格式選擇 */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                {t("timeline.exportFormat") || "匯出格式"}
              </Label>
              <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as "csv" | "json" | "pdf" | "markdown")}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="csv" id="format-csv" />
                    <Label htmlFor="format-csv" className="cursor-pointer flex-1">
                      <div className="font-medium">CSV</div>
                      <div className="text-xs text-muted-foreground">{t("timeline.exportFormatCSV") || "表格格式，適合 Excel"}</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="json" id="format-json" />
                    <Label htmlFor="format-json" className="cursor-pointer flex-1">
                      <div className="font-medium">JSON</div>
                      <div className="text-xs text-muted-foreground">{t("timeline.exportFormatJSON") || "結構化數據格式"}</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="pdf" id="format-pdf" />
                    <Label htmlFor="format-pdf" className="cursor-pointer flex-1">
                      <div className="font-medium">PDF</div>
                      <div className="text-xs text-muted-foreground">{t("timeline.exportFormatPDF") || "可打印文檔格式"}</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="markdown" id="format-markdown" />
                    <Label htmlFor="format-markdown" className="cursor-pointer flex-1">
                      <div className="font-medium">Markdown</div>
                      <div className="text-xs text-muted-foreground">{t("timeline.exportFormatMarkdown") || "文檔格式，適合閱讀"}</div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* 自定義字段選擇 */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                {t("timeline.exportFields") || "選擇要匯出的字段"}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-date"
                    checked={customExportFields.date}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, date: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-date" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldDate") || "日期"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-emotion"
                    checked={customExportFields.emotion}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, emotion: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-emotion" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldEmotion") || "情緒"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-intensity"
                    checked={customExportFields.intensity}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, intensity: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-intensity" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldIntensity") || "強度"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-description"
                    checked={customExportFields.description}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, description: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-description" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldDescription") || "描述"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-storage"
                    checked={customExportFields.storage}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, storage: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-storage" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldStorage") || "儲存類型"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-privacy"
                    checked={customExportFields.privacy}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, privacy: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-privacy" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldPrivacy") || "隱私設置"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-status"
                    checked={customExportFields.status}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, status: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-status" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldStatus") || "狀態"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-suiRef"
                    checked={customExportFields.suiRef}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, suiRef: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-suiRef" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldSuiRef") || "Sui 引用"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-transactionDigest"
                    checked={customExportFields.transactionDigest}
                    onCheckedChange={(checked) =>
                      setCustomExportFields(prev => ({ ...prev, transactionDigest: checked as boolean }))
                    }
                  />
                  <Label htmlFor="field-transactionDigest" className="cursor-pointer text-sm">
                    {t("timeline.exportFieldTransactionDigest") || "鑄造交易"}
                  </Label>
                </div>
              </div>
            </div>

            {/* 日期格式選擇 */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                {t("timeline.exportDateFormat") || "日期格式"}
              </Label>
              <RadioGroup value={dateFormat} onValueChange={(value) => setDateFormat(value as "locale" | "iso" | "custom")}>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="locale" id="date-locale" />
                    <Label htmlFor="date-locale" className="cursor-pointer flex-1 text-sm">
                      {t("timeline.exportDateFormatLocale") || "本地格式（根據系統語言）"}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="iso" id="date-iso" />
                    <Label htmlFor="date-iso" className="cursor-pointer flex-1 text-sm">
                      {t("timeline.exportDateFormatISO") || "ISO 8601 格式（YYYY-MM-DDTHH:mm:ss.sssZ）"}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="custom" id="date-custom" />
                    <Label htmlFor="date-custom" className="cursor-pointer flex-1 text-sm">
                      {t("timeline.exportDateFormatCustom") || "自定義格式（YYYY-MM-DD HH:mm:ss）"}
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              {t("common.cancel") || "取消"}
            </Button>
            <Button onClick={() => executeExport(exportFormat)}>
              <Download className="w-4 h-4 mr-2" />
              {t("timeline.export") || "匯出"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
};

export default Timeline;
