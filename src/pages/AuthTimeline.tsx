import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home, Sparkles, Shield, Clock, Lock, Unlock, Loader2, BookOpen, BarChart3, Filter, Eye, EyeOff, Search, Download, ArrowUpDown, X, MoreVertical, Trash2, Calendar as CalendarIcon, CheckSquare, Square, TrendingUp, Link2 } from "lucide-react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readFromWalrus } from "@/lib/walrus";
import { decryptDataWithMigration, generateUserKeyFromId, DecryptionError, DecryptionErrorType, PUBLIC_SEAL_KEY } from "@/lib/encryption";
import type { EncryptedData } from "@/lib/encryption";
import { getAnonymousUserKey } from "@/lib/anonymousIdentity";
import { getEncryptedEmotionByBlob } from "@/lib/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";
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
}

type FilterType = "all" | "database" | "walrus"; // database = 数据库存储, walrus = Walrus 去中心化存储
type SortBy = "date" | "intensity" | "emotion";
type SortOrder = "asc" | "desc";
type ViewPeriod = "week" | "month" | "year";

const AuthTimeline = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  
  // 虛擬滾動容器引用
  const parentRef = useRef<HTMLDivElement>(null);
  
  // 實時同步輪詢間隔引用（用於清理）
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
  });
  const [dateFormat, setDateFormat] = useState<"locale" | "iso" | "custom">("locale");

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
  const [decryptingRecords, setDecryptingRecords] = useState<Set<string>>(new Set());
  const [decryptedDescriptions, setDecryptedDescriptions] = useState<Record<string, string>>({});
  const [decryptedAiResponses, setDecryptedAiResponses] = useState<Record<string, string>>({});
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

  // Get current session and user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setSession(session);
      setUser(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setSession(session);
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

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
        navigate('/auth-record');
      }
      // Escape: 清除搜尋
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    const currentUserId = user?.id; // 捕获当前的 user.id，避免竞态条件
    try {
      if (!currentUserId) {
        setRecords([]);
        return;
      }

      // Load records from Supabase
      const { data, error } = await supabase
        .from('emotion_records')
        .select('id, created_at, emotion, intensity, description, is_public, walrus_url, blob_id, encrypted_data, payload_hash, proof_status, sui_ref')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 再次检查 user 是否仍然匹配（避免竞态条件）
      if (user?.id !== currentUserId) {
        console.log('[AuthTimeline] User changed during load, ignoring results');
        return;
      }

      const allRecords: EmotionRecord[] = (data || []).map((r: any) => {
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
          created_at: r.created_at,
          wallet_address: null,
          encrypted_data: r.encrypted_data || null,
          tags: undefined, // Tags 存储在加密的 snapshot 中，解密后才会被设置
        };
      });

      // 去重并排序（按时间倒序）
      const uniqueRecords = sortRecordsByDate(
        Array.from(new Map(allRecords.map(r => [r.id, r])).values())
      );

      // 最后一次检查 user 是否仍然匹配
      if (user?.id === currentUserId) {
        setRecords(uniqueRecords);
      } else {
        console.log('[AuthTimeline] User changed after processing, ignoring results');
      }
    } catch (error: any) {
      console.error("Error loading records:", error);
      toast({
        title: t("timeline.loadError") || "載入失敗",
        description: error?.message || t("timeline.loadErrorDesc") || "無法載入記錄",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, t, sortRecordsByDate]);

  // Load records when user is available
  useEffect(() => {
    if (user) {
      loadRecords();
    }
  }, [user, loadRecords]);

  // 實時同步數據變化（使用 Supabase Realtime）
  useEffect(() => {
    if (!user) return;

    const currentUserId = user.id; // 捕获当前的 user.id，避免闭包问题

    const channel = supabase
      .channel('emotion_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emotion_records',
          filter: `user_id=eq.${currentUserId}`,
        },
        async (payload) => {
          console.log('[AuthTimeline] Realtime update:', payload);
          
          try {
            if (payload.eventType === 'INSERT') {
              // 新增記錄：從數據庫獲取完整記錄
              const { data: newRecord, error } = await supabase
                .from('emotion_records')
                .select('id, created_at, emotion, intensity, description, is_public, walrus_url, blob_id, encrypted_data, payload_hash, proof_status, sui_ref')
                .eq('id', payload.new.id)
                .single();
              
              if (error) {
                console.error('[AuthTimeline] Failed to fetch new record:', error);
                toast({
                  title: t("timeline.realtimeError") || "同步錯誤",
                  description: t("timeline.realtimeErrorDesc") || "無法獲取新記錄，將重新載入",
                  variant: "destructive",
                });
                loadRecords();
                return;
              }
              
              if (newRecord) {
                const hasWalrusData = newRecord.blob_id && newRecord.walrus_url;
                const blobId = hasWalrusData 
                  ? newRecord.blob_id 
                  : `local_${newRecord.id.slice(0, 8)}`;
                const walrusUrl = hasWalrusData
                  ? newRecord.walrus_url
                  : `local://${newRecord.id}`;
                
                const record: EmotionRecord = {
                  id: newRecord.id,
                  emotion: newRecord.emotion || "encrypted",
                  intensity: newRecord.intensity || 50,
                  description: newRecord.description,
                  blob_id: blobId,
                  walrus_url: walrusUrl,
                  payload_hash: newRecord.payload_hash || "",
                  is_public: newRecord.is_public || false,
                  proof_status: newRecord.proof_status || "pending",
                  sui_ref: newRecord.sui_ref || null,
                  created_at: newRecord.created_at,
                  wallet_address: null,
                  encrypted_data: newRecord.encrypted_data || null,
                  tags: undefined, // Tags 存储在加密的 snapshot 中，解密后才会被设置
                };
                
                setRecords(prev => sortRecordsByDate([record, ...prev]));
                toast({
                  title: t("timeline.newRecordAdded") || "新記錄已添加",
                  description: t("timeline.newRecordAddedDesc") || "時間線已更新",
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              // 更新記錄：只更新變化的字段
              const updatedRecord = payload.new;
              let encryptedDataChanged = false;
              
              setRecords(prev => {
                const currentRecord = prev.find(r => r.id === updatedRecord.id);
                // 檢查 encrypted_data 是否真的改變了
                encryptedDataChanged = currentRecord !== undefined &&
                                      updatedRecord.encrypted_data !== undefined && 
                                      updatedRecord.encrypted_data !== currentRecord.encrypted_data;
                
                const updated = prev.map(r => {
                  if (r.id !== updatedRecord.id) return r;
                  return {
                    ...r,
                    emotion: updatedRecord.emotion || r.emotion,
                    intensity: updatedRecord.intensity ?? r.intensity,
                    is_public: updatedRecord.is_public ?? r.is_public,
                    proof_status: updatedRecord.proof_status || r.proof_status,
                    sui_ref: updatedRecord.sui_ref || r.sui_ref,
                    encrypted_data: updatedRecord.encrypted_data !== undefined ? updatedRecord.encrypted_data : r.encrypted_data,
                    tags: encryptedDataChanged ? undefined : r.tags, // 如果加密數據更新，清除 tags（需要重新解密）
                  };
                });
                return sortRecordsByDate(updated);
              });
              
              // 如果 encrypted_data 更新了，清除相關的解密狀態
              if (encryptedDataChanged) {
                setDecryptedDescriptions(prev => {
                  const next = { ...prev };
                  delete next[updatedRecord.id];
                  return next;
                });
                setDecryptedAiResponses(prev => {
                  const next = { ...prev };
                  delete next[updatedRecord.id];
                  return next;
                });
                setDecryptErrors(prev => {
                  const next = { ...prev };
                  delete next[updatedRecord.id];
                  return next;
                });
                setDecryptErrorDetails(prev => {
                  const next = { ...prev };
                  delete next[updatedRecord.id];
                  return next;
                });
                setFailedAutoDecrypts(prev => {
                  const next = new Set(prev);
                  next.delete(updatedRecord.id);
                  return next;
                });
              }
            } else if (payload.eventType === 'DELETE') {
              // 刪除記錄：從列表中移除並清理所有相關狀態
              const deletedId = payload.old.id;
              setRecords(prev => prev.filter(r => r.id !== deletedId));
              setDecryptedDescriptions(prev => {
                const next = { ...prev };
                delete next[deletedId];
                return next;
              });
              setDecryptedAiResponses(prev => {
                const next = { ...prev };
                delete next[deletedId];
                return next;
              });
              setDecryptErrors(prev => {
                const next = { ...prev };
                delete next[deletedId];
                return next;
              });
              setDecryptErrorDetails(prev => {
                const next = { ...prev };
                delete next[deletedId];
                return next;
              });
              setFailedAutoDecrypts(prev => {
                const next = new Set(prev);
                next.delete(deletedId);
                return next;
              });
              setExpandedErrorDetails(prev => {
                const next = new Set(prev);
                next.delete(deletedId);
                return next;
              });
            }
          } catch (error) {
            console.error('[AuthTimeline] Error processing realtime update:', error);
            // 降級：如果處理失敗，重新載入所有記錄
            loadRecords();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AuthTimeline] Realtime subscription active');
          // 清除輪詢（如果存在）
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[AuthTimeline] Realtime subscription error, falling back to polling');
          toast({
            title: t("timeline.realtimeError") || "實時同步失敗",
            description: t("timeline.realtimeErrorDesc") || "將使用定期刷新來同步數據",
            variant: "default",
          });
          // 降級：如果訂閱失敗，定期重新載入（每30秒）
          if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(() => {
              // 使用 ref 或直接检查，避免闭包问题
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user?.id === currentUserId) {
                  loadRecords();
                }
              });
            }, 30000);
          }
        }
      });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user, loadRecords, sortRecordsByDate, toast, t]);

  // 生成 Sui Scan 链接
  const getSuiScanUrl = (objectId: string | null): string | null => {
    if (!objectId) return null;
    // Sui Scan testnet URL format: https://suiscan.xyz/testnet/object/{objectId}
    return `https://suiscan.xyz/testnet/object/${objectId}`;
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

  // 判斷記錄是否為數據庫儲存（非 Walrus）
  const isLocalRecord = (record: EmotionRecord) => {
    // 檢查 blob_id 和 walrus_url 來判斷是否為數據庫存儲
    // 數據庫存儲的標識：
    // 1. blob_id 以 "local_" 開頭
    // 2. walrus_url 以 "local://" 開頭
    // 3. 沒有 blob_id 但有 encrypted_data（數據庫 fallback）
    const blobId = record.blob_id || "";
    const walrusUrl = record.walrus_url || "";
    
    const isLocalBlob = blobId.startsWith("local_");
    const isLocalUrl = walrusUrl.startsWith("local://");
    const isDatabaseFallback = !blobId && record.encrypted_data;
    
    // 數據庫存儲：明確的本地格式或數據庫 fallback
    const isDatabase = isLocalBlob || isLocalUrl || isDatabaseFallback;
    
    return isDatabase;
  };

  // 獲取存儲類型標籤（用於顯示）
  const getStorageLabel = useCallback((record: EmotionRecord) => {
    const isDatabase = isLocalRecord(record);
    return isDatabase 
      ? t("timeline.filter.database")
      : t("timeline.filter.walrus");
  }, [t]);

  // 解密記錄描述
  const decryptDescription = useCallback(async (record: EmotionRecord) => {
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
        console.log(`[AuthTimeline] Using encrypted_data from database for record ${record.id}`);
        encryptedDataString = record.encrypted_data;
      } else {
        // 從 Walrus 讀取加密資料（帶重試機制）
        try {
          encryptedDataString = await retryWithBackoff(
            () => readFromWalrus(record.blob_id),
            3,
            1000
          );
        } catch (walrusError) {
          console.warn(`[Timeline] Walrus fetch failed for ${record.blob_id}, falling back to server backup`, walrusError);
          try {
            encryptedDataString = await retryWithBackoff(
              () => getEncryptedEmotionByBlob(record.blob_id),
              2,
              500
            );
          } catch (backupError) {
            throw new Error(`無法從 Walrus 或備份伺服器讀取資料：${(backupError as Error).message}`);
          }
        }
      }
      
      // 解析加密資料
      const encryptedData: EncryptedData = JSON.parse(encryptedDataString);
      
      // 嘗試所有可能的解密金鑰（因為記錄可能是在不同模式下加密的）
      const possibleKeys: Array<{key: string, type: string}> = [];
      
      try {
        // 在認證模式下，優先使用 Supabase 用戶密鑰
        // 1. 優先嘗試 Supabase 使用者 ID（認證模式的主要密鑰）
        if (user?.id) {
          const supabaseKey = await generateUserKeyFromId(user.id);
          possibleKeys.push({ key: supabaseKey, type: 'Supabase User' });
        }
        
        // 2. 如果是公開記錄，嘗試公開金鑰
        if (record.is_public) {
          possibleKeys.push({ key: PUBLIC_SEAL_KEY, type: 'Public Seal' });
        }
        
        // 3. 嘗試匿名金鑰（作為後備，處理從匿名模式遷移的記錄）
        const anonymousKey = await getAnonymousUserKey();
        if (anonymousKey) {
          possibleKeys.push({ key: anonymousKey, type: 'Anonymous' });
        }
        
        // 4. 如果不是公開記錄，也嘗試公開金鑰（以防記錄被錯誤標記）
        if (!record.is_public) {
          possibleKeys.push({ key: PUBLIC_SEAL_KEY, type: 'Public Seal (fallback)' });
        }
        
        if (possibleKeys.length === 0) {
          throw new Error("無法產生使用者密鑰：需要登入、連接錢包或保留匿名金鑰");
        }
      } catch (keyError) {
        console.error("[AuthTimeline] Failed to generate decryption keys:", keyError);
        throw new Error("無法產生解密密鑰");
      }
      
      // 依次嘗試所有可能的金鑰
      console.log(`[AuthTimeline] Attempting decryption for record ${record.id} with ${possibleKeys.length} possible keys`);
      let decryptedString: string | null = null;
      let successKeyType: string = '';
      let lastError: Error | null = null;
      
      for (const {key, type} of possibleKeys) {
        try {
          console.log(`[AuthTimeline] Trying decryption with ${type} key...`);
          decryptedString = await decryptDataWithMigration(encryptedData, key);
          successKeyType = type;
          console.log(`[AuthTimeline] ✅ Successfully decrypted with ${type} key`);
          break;
        } catch (keyAttemptError) {
          console.warn(`[AuthTimeline] ❌ Failed to decrypt with ${type} key:`, keyAttemptError);
          lastError = keyAttemptError as Error;
          continue;
        }
      }
      
      if (!decryptedString) {
        console.error(`[AuthTimeline] All ${possibleKeys.length} decryption attempts failed for record ${record.id}`);
        throw lastError || new Error(`Failed to decrypt with any available key (tried ${possibleKeys.length} keys)`);
      }
      
      console.log(`[AuthTimeline] 🎉 Record ${record.id} decrypted successfully using ${successKeyType} key`);
      
      // 解析解密後的 JSON 獲取快照
      const snapshot = JSON.parse(decryptedString);
      const snapshotTimestamp = snapshot.timestamp
        ? new Date(snapshot.timestamp).toISOString()
        : null;
      
      // 更新記錄的 metadata（例如真實時間戳與情緒/強度、標籤）
      if (snapshotTimestamp || snapshot.emotion || snapshot.intensity || snapshot.tags) {
        setRecords(prev =>
          sortRecordsByDate(prev.map(r => {
            if (r.id !== record.id) return r;
            return {
              ...r,
              created_at: snapshotTimestamp || r.created_at,
              emotion: snapshot.emotion || r.emotion,
              intensity: typeof snapshot.intensity === "number" ? snapshot.intensity : r.intensity,
              wallet_address: snapshot.walletAddress || r.wallet_address,
              tags: snapshot.tags || r.tags, // 從解密後的 snapshot 中提取 tags
            };
          }))
        );
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
      console.error(`[AuthTimeline] Failed to decrypt record ${record.id}:`, error);
      
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
            "⚠️ Walrus Testnet 資料會在 epochs 到期後被刪除",
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
      
      // 如果是 Walrus 記錄，添加 Walrus aggregator 提示（所有用戶都可能遇到）
      const isWalrusRecord = record.blob_id && !record.blob_id.startsWith("local_");
      
      if (isWalrusRecord) {
        // 在錯誤訊息中添加 Walrus aggregator 提示
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
      
      console.error(`[AuthTimeline] Detailed error for record ${record.id}:`, errorDetail);
      
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
  }, [decryptedDescriptions, decryptingRecords, user, toast, t, isLocalRecord, retryWithBackoff]);

  // 獲取所有可用的標籤
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
    
    // 1. 儲存類型過濾
    const isDatabaseStorage = (record: EmotionRecord) => {
      // 使用統一的判斷邏輯
      return isLocalRecord(record);
    };
    
    if (filter === "database") {
      filtered = filtered.filter(isDatabaseStorage);
    } else if (filter === "walrus") {
      filtered = filtered.filter(r => !isDatabaseStorage(r));
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
        const emotionMatch = record.emotion.toLowerCase().includes(query);
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
          comparison = a.emotion.localeCompare(b.emotion, i18n.language);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [records, filter, searchQuery, selectedTags, sortBy, sortOrder, decryptedDescriptions, i18n.language, dateRange]);

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
        console.error(`[AuthTimeline] Failed to decrypt record ${record.id} in batch:`, error);
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
        console.warn(`[AuthTimeline] Failed to auto-decrypt public record ${record.id}:`, error);
        // 記錄失敗的嘗試，避免無限重試
        setFailedAutoDecrypts(prev => new Set(prev).add(record.id));
      });
    });
  }, [records, decryptedDescriptions, decryptingRecords, decryptDescription, isLocalRecord, failedAutoDecrypts]);

  // 統計資料
  const stats = useMemo(() => {
    const total = records.length;
    const database = records.filter(isLocalRecord).length;
    const walrus = records.filter(r => !isLocalRecord(r)).length;
    
    const emotionCounts: Record<string, number> = {};
    records.forEach(r => {
      emotionCounts[r.emotion] = (emotionCounts[r.emotion] || 0) + 1;
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
      database,
      walrus,
      emotionCounts,
      avgIntensity,
      thisWeek,
      thisMonth,
    };
  }, [records]);

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
        name: t("timeline.filter.database"),
        value: stats.database,
        color: "#8b5cf6",
      },
      {
        name: t("timeline.filter.walrus"),
        value: stats.walrus,
        color: "#06b6d4",
      },
    ];
  }, [stats.database, stats.walrus, t]);

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
        if (!emotionCounts[r.emotion]) {
          emotionCounts[r.emotion] = new Array(days).fill(0);
        }
        emotionCounts[r.emotion][days - 1 - i] = (emotionCounts[r.emotion][days - 1 - i] || 0) + 1;
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
  }, [records, viewPeriod]);

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
      const from = sortedRecords[i].emotion;
      const to = sortedRecords[i + 1].emotion;
      
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
  }, [records]);

  // 情緒日曆熱力圖數據
  const emotionCalendarData = useMemo(() => {
    const data: Record<string, { count: number; avgIntensity: number; dominantEmotion: string }> = {};
    
    records.forEach(record => {
      const date = new Date(record.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      if (!data[dateKey]) {
        data[dateKey] = {
          count: 0,
          avgIntensity: 0,
          dominantEmotion: record.emotion,
        };
      }
      
      data[dateKey].count += 1;
      data[dateKey].avgIntensity = Math.round(
        (data[dateKey].avgIntensity * (data[dateKey].count - 1) + record.intensity) / data[dateKey].count
      );
    });
    
    return data;
  }, [records]);

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
      };

      const headers: string[] = [];
      const fieldOrder: Array<keyof typeof customExportFields> = ["date", "emotion", "intensity", "description", "storage", "privacy", "status", "suiRef"];
      
      fieldOrder.forEach(field => {
        if (customExportFields[field]) {
          headers.push(fieldLabels[field]);
        }
      });

      const rows = records.map(record => {
        const isLocal = isLocalRecord(record);
        const row: string[] = [];
        
        if (customExportFields.date) {
          row.push(formatDate(record.created_at));
        }
        if (customExportFields.emotion) {
          row.push(emotionLabels[record.emotion as keyof typeof emotionLabels]?.label || record.emotion);
        }
        if (customExportFields.intensity) {
          row.push(record.intensity.toString());
        }
        if (customExportFields.description) {
          row.push(descriptions[record.id] || record.description || "");
        }
        if (customExportFields.storage) {
          row.push(getStorageLabel(record));
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
        const data: any = {};
        
        if (customExportFields.date) {
          data.date = formatDate(record.created_at);
        }
        if (customExportFields.emotion) {
          data.emotion = record.emotion;
          data.emotionLabel = emotionLabels[record.emotion as keyof typeof emotionLabels]?.label || record.emotion;
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
        const emotionLabel = emotionLabels[record.emotion as keyof typeof emotionLabels]?.label || record.emotion;
        const emotionEmoji = emotionLabels[record.emotion as keyof typeof emotionLabels]?.emoji || "😊";
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
        const emotionLabel = emotionLabels[record.emotion as keyof typeof emotionLabels]?.label || record.emotion;
        const emotionEmoji = emotionLabels[record.emotion as keyof typeof emotionLabels]?.emoji || "😊";
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
  }, [t, i18n.language, emotionLabels, isLocalRecord, recordsToExport, descriptionsToExport, customExportFields, dateFormat, formatDate]);

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
    
    setIsDeleting(true);
    try {
      // Delete from Supabase
      if (!user || !recordToDelete.id) {
        throw new Error("User not authenticated or record ID missing");
      }
      
      const { error } = await supabase
        .from('emotion_records')
        .delete()
        .eq('id', recordToDelete.id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
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
      
      toast({
        title: t("timeline.deleteSuccess") || "刪除成功",
        description: t("timeline.deleteSuccessDesc") || "記錄已刪除",
      });
      
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error: any) {
      console.error("[AuthTimeline] Delete error:", error);
      toast({
        title: t("timeline.deleteError") || "刪除失敗",
        description: error?.message || t("timeline.deleteErrorDesc") || "無法刪除記錄",
        variant: "destructive",
      });
      // Don't update state if deletion failed - record should still be visible
    } finally {
      setIsDeleting(false);
    }
  }, [recordToDelete, user, toast, t]);

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
        if (!user) {
          throw new Error('User not authenticated');
        }
        const { error } = await supabase
          .from('emotion_records')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
        return { id, status: 'fulfilled' as const };
      } catch (error) {
        console.error(`[AuthTimeline] Failed to delete record ${id}:`, error);
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
  }, [selectedIds, records, user, toast, t]);

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
            <LanguageSwitcher />
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

        {/* Testnet Warning Banner */}
        {records.some(r => !isLocalRecord(r)) && (
          <Card className="p-4 mb-4 bg-yellow-500/10 border-yellow-500/30">
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
                  <div className="font-medium">{t("timeline.currentAccount") || "當前帳號"}</div>
                  <div className="text-muted-foreground">
                    {user?.email} <span className="text-xs opacity-70">(ID: {user?.id.slice(0, 8)}...)</span>
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
                  {(["all", "database", "walrus"] as FilterType[]).map((filterType) => (
                    <Button
                      key={filterType}
                      variant={filter === filterType ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter(filterType)}
                      className={filter === filterType ? "gradient-emotion" : ""}
                    >
                      {t(`timeline.filter.${filterType}`)}
                    </Button>
                  ))}
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
              <div className="text-2xl font-bold">{stats.database}</div>
              <div className="text-xs text-muted-foreground">{t("timeline.stats.database")}</div>
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
                        <Button onClick={() => navigate("/auth-record")} className="gradient-emotion">
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
                
                const emotionKey = record.emotion as keyof typeof emotionLabels;
                const emotionConfig = emotionLabels[emotionKey] || {
                  label: record.emotion.charAt(0).toUpperCase() + record.emotion.slice(1),
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
                                {isLocal ? "💾 " + getStorageLabel(record) : "☁️ " + getStorageLabel(record)}
                              </span>
                            </div>
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
                      {isLocalRecord(selectedRecord) ? "💾 " + getStorageLabel(selectedRecord) : "☁️ " + getStorageLabel(selectedRecord)}
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
                </div>
              </div>
          </DialogContent>
        </Dialog>
      )}
      
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

export default AuthTimeline;
