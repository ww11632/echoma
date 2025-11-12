import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home, Sparkles, Shield, Clock, Lock, Unlock, Loader2, BookOpen, BarChart3, Filter, Eye, EyeOff } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { supabase } from "@/integrations/supabase/client";
import { listEmotionRecords } from "@/lib/localIndex";
import { getEmotions, getEmotionsByWallet } from "@/lib/api";
import { queryWalrusBlobsByOwner, getWalrusUrl, readFromWalrus } from "@/lib/walrus";
import { decryptData, decryptDataWithMigration, generateUserKey, generateUserKeyFromId, DecryptionError, DecryptionErrorType } from "@/lib/encryption";
import type { EncryptedData } from "@/lib/encryption";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";

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
}

type FilterType = "all" | "local" | "walrus";

const Timeline = () => {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>("all");

  const emotionLabels = {
    joy: { label: t("emotions.joy"), emoji: "😊", gradient: "from-yellow-400 to-orange-400", color: "#fbbf24" },
    sadness: { label: t("emotions.sadness"), emoji: "😢", gradient: "from-blue-400 to-indigo-400", color: "#60a5fa" },
    anger: { label: t("emotions.anger"), emoji: "😠", gradient: "from-red-400 to-rose-400", color: "#f87171" },
    anxiety: { label: t("emotions.anxiety"), emoji: "😰", gradient: "from-purple-400 to-pink-400", color: "#a78bfa" },
    confusion: { label: t("emotions.confusion"), emoji: "🤔", gradient: "from-gray-400 to-slate-400", color: "#94a3b8" },
    peace: { label: t("emotions.peace"), emoji: "✨", gradient: "from-green-400 to-teal-400", color: "#34d399" },
  };
  const [records, setRecords] = useState<EmotionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueryingOnChain, setIsQueryingOnChain] = useState(false);
  const [decryptingRecords, setDecryptingRecords] = useState<Set<string>>(new Set());
  const [decryptedDescriptions, setDecryptedDescriptions] = useState<Record<string, string>>({});
  const [decryptErrors, setDecryptErrors] = useState<Record<string, string>>({});
  const [decryptErrorDetails, setDecryptErrorDetails] = useState<Record<string, {
    type: string;
    message: string;
    statusCode?: number;
    blobId?: string;
    timestamp: string;
    suggestions: string[];
  }>>({});
  const [expandedErrorDetails, setExpandedErrorDetails] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      const allRecords: EmotionRecord[] = [];

      try {
        // 1. 尝试从本地存储加载记录
        try {
          const localRecords = await listEmotionRecords();
          const convertedLocalRecords: EmotionRecord[] = localRecords.map((r) => ({
            id: r.id,
            emotion: r.emotion,
            intensity: 50,
            description: r.note,
            blob_id: `local_${r.id.slice(0, 8)}`,
            walrus_url: `local://${r.id}`,
            payload_hash: "",
            is_public: r.isPublic ?? false,
            proof_status: "pending" as const,
            sui_ref: null,
            created_at: r.timestamp,
          }));
          allRecords.push(...convertedLocalRecords);
        } catch (localError) {
          console.log("[Timeline] No local records or error loading:", localError);
        }

        // 2. 尝试从 API 加载记录（无论是否有钱包）
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // 如果有Supabase session，使用Supabase function
            try {
              const response = await supabase.functions.invoke('get-emotions');
              if (!response.error && response.data?.success) {
                const convertedRecords: EmotionRecord[] = response.data.records.map((r: any) => {
                  // 如果 blob_id 或 walrus_url 是 null/undefined，視為本地記錄
                  const hasWalrusData = r.blob_id && r.walrus_url;
                  const isLocal = !hasWalrusData || 
                                r.walrus_url?.startsWith("local://") || 
                                r.blob_id?.startsWith("local_");
                  
                  // 為沒有 Walrus 數據的記錄生成本地 ID
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
                    emotion: r.emotion,
                    intensity: r.intensity || 50,
                    description: r.description,
                    blob_id: blobId,
                    walrus_url: walrusUrl,
                    payload_hash: r.payload_hash || "",
                    is_public: r.is_public || false,
                    proof_status: r.proof_status || "pending",
                    sui_ref: r.sui_ref || null,
                    created_at: r.created_at || r.timestamp,
                  };
                });
                allRecords.push(...convertedRecords);
              }
            } catch (supabaseFuncError) {
              console.log("[Timeline] Supabase function error:", supabaseFuncError);
              // 如果Supabase function失败，尝试使用直接API调用
              try {
                const apiRecords = await getEmotions(session.access_token);
                const convertedApiRecords: EmotionRecord[] = apiRecords.map((r: any) => {
                  // 如果 blob_id 或 walrus_url 是 null/undefined，視為本地記錄
                  const hasWalrusData = r.blob_id && r.walrus_url;
                  const isLocal = !hasWalrusData || 
                                r.walrus_url?.startsWith("local://") || 
                                r.blob_id?.startsWith("local_");
                  
                  // 為沒有 Walrus 數據的記錄生成本地 ID
                  const blobId = hasWalrusData 
                    ? r.blob_id 
                    : `local_${r.id.slice(0, 8)}`;
                  
                  const walrusUrl = hasWalrusData
                    ? r.walrus_url
                    : `local://${r.id}`;
                  
                  return {
                    id: r.id,
                    emotion: r.emotion,
                    intensity: r.intensity || 50,
                    description: r.description,
                    blob_id: blobId,
                    walrus_url: walrusUrl,
                    payload_hash: r.payload_hash || "",
                    is_public: r.is_public || false,
                    proof_status: r.proof_status || "pending",
                    sui_ref: r.sui_ref || null,
                    created_at: r.created_at || r.timestamp,
                  };
                });
                allRecords.push(...convertedApiRecords);
              } catch (apiError) {
                console.log("[Timeline] API error (expected if server not running):", apiError);
              }
            }
          }
          
          // 如果有钱包连接，尝试查询链上的 Walrus blob 对象
          if (currentAccount?.address) {
            console.log("[Timeline] Wallet connected, querying on-chain blobs for:", currentAccount.address);
            try {
              setIsQueryingOnChain(true);
              console.log("[Timeline] Querying on-chain Walrus blobs for address:", currentAccount.address);
              console.log("[Timeline] Environment check:", {
                hasSession: !!session,
                hasWallet: !!currentAccount,
                walletAddress: currentAccount.address,
                apiBase: import.meta.env.VITE_API_BASE || "http://localhost:3001"
              });
              
              // 显示开始查询的 toast
              toast({
                title: t("timeline.queryingOnChain"),
                description: t("timeline.queryingOnChainDesc"),
              });
                
                const onChainBlobs = await queryWalrusBlobsByOwner(currentAccount.address);
                console.log(`[Timeline] Found ${onChainBlobs.length} on-chain Walrus blobs`);
                
                // 显示查询完成的 toast
                if (onChainBlobs.length > 0) {
                  toast({
                    title: t("timeline.queryCompleted"),
                    description: t("timeline.queryCompletedDesc", { count: onChainBlobs.length }),
                  });
                }

                // 将链上的 blob 转换为记录
                for (const blob of onChainBlobs) {
                  // 检查是否已经存在（通过 blob_id 或 sui_ref）
                  const existing = allRecords.find(
                    r => r.blob_id === blob.blobId || r.sui_ref === blob.objectId
                  );

                  if (!existing) {
                    // 创建新的链上记录
                    // 注意：链上记录可能没有 emotion/intensity 等信息，这些在加密的 blob 中
                    // 我们可以尝试从 blob 读取，或者使用默认值
                    const onChainRecord: EmotionRecord = {
                      id: `onchain_${blob.objectId}`,
                      emotion: "peace", // 默认值，实际应该从 blob 读取
                      intensity: 50, // 默认值
                      description: "", // 加密内容，需要解密才能显示
                      blob_id: blob.blobId,
                      walrus_url: getWalrusUrl(blob.blobId),
                      payload_hash: "",
                      is_public: false,
                      proof_status: "confirmed", // 链上记录肯定是已确认的
                      sui_ref: blob.objectId,
                      created_at: blob.createdAt || new Date().toISOString(),
                    };
                    allRecords.push(onChainRecord);
                    console.log(`[Timeline] ✅ Added on-chain record:`, {
                      blobId: blob.blobId,
                      objectId: blob.objectId,
                      walrusUrl: getWalrusUrl(blob.blobId)
                    });
                  } else {
                    // 如果已存在，更新 sui_ref
                    if (!existing.sui_ref && blob.objectId) {
                      existing.sui_ref = blob.objectId;
                      existing.proof_status = "confirmed";
                      console.log(`[Timeline] Updated existing record with on-chain ref: ${blob.objectId}`);
                    }
                  }
                }
              } catch (onChainError) {
                console.error("[Timeline] Error querying on-chain Walrus blobs:", onChainError);
                // 显示查询失败的 toast
                toast({
                  title: t("timeline.queryFailed"),
                  description: t("timeline.queryFailedDesc"),
                  variant: "destructive",
                });
                // 不阻止其他记录的加载
              } finally {
                setIsQueryingOnChain(false);
              }
            }
          } catch (supabaseError) {
          console.log("[Timeline] Supabase error:", supabaseError);
        }

        // 3. 去重并排序（按时间倒序）
        const uniqueRecords = Array.from(
          new Map(allRecords.map(r => [r.id, r])).values()
        ).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // 统计信息
        const localCount = uniqueRecords.filter(r => 
          r.blob_id?.startsWith("local_") || r.walrus_url?.startsWith("local://")
        ).length;
        const walrusCount = uniqueRecords.length - localCount;
        
        console.log(`[Timeline] Loaded ${uniqueRecords.length} total records:`, {
          total: uniqueRecords.length,
          local: localCount,
          walrus: walrusCount,
          records: uniqueRecords.map(r => {
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
        
        // 特别检查 Walrus 记录
        const walrusRecords = uniqueRecords.filter(r => {
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

        setRecords(uniqueRecords);
      } catch (error) {
        console.error("Error loading records:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecords();
  }, [currentAccount]);

  // 生成 Sui Scan 链接
  const getSuiScanUrl = (objectId: string | null): string | null => {
    if (!objectId) return null;
    // Sui Scan testnet URL format: https://suiscan.xyz/testnet/object/{objectId}
    return `https://suiscan.xyz/testnet/object/${objectId}`;
  };

  // 判断记录是否为本地存储
  const isLocalRecord = (record: EmotionRecord) => {
    // 检查 blob_id 和 walrus_url 来判断是否为本地记录
    // 如果 blob_id 以 "local_" 开头，或者 walrus_url 以 "local://" 开头，则为本地记录
    const blobId = record.blob_id || "";
    const walrusUrl = record.walrus_url || "";
    
    const isLocalBlob = blobId.startsWith("local_");
    const isLocalUrl = walrusUrl.startsWith("local://");
    
    // 只有当明确是本地格式时，才返回 true
    // 其他情况（包括 walrus_url 是 https://aggregator.testnet.walrus.space 开头，或者 blob_id 是正常的 Walrus ID）都是 Walrus 记录
    const isLocal = isLocalBlob || isLocalUrl;
    
    // 调试日志
    if (!isLocal && (blobId || walrusUrl)) {
      console.log(`[Timeline] Walrus record detected:`, {
        id: record.id,
        blob_id: blobId,
        walrus_url: walrusUrl,
        isLocalBlob,
        isLocalUrl,
        isLocal
      });
    }
    
    return isLocal;
  };

  // 解密记录描述
  const decryptDescription = useCallback(async (record: EmotionRecord) => {
    // 如果正在解密，则跳过
    if (decryptingRecords.has(record.id)) {
      return;
    }
    
    // 如果已经解密，不需要重新解密
    if (decryptedDescriptions[record.id]) {
      return;
    }

    // 如果是公开记录或本地记录，不需要解密
    if (record.is_public || isLocalRecord(record)) {
      return;
    }

    // 如果没有 blob_id，无法解密
    if (!record.blob_id || record.blob_id.startsWith("local_")) {
      return;
    }

    // 标记为正在解密
    setDecryptingRecords(prev => new Set(prev).add(record.id));

    try {
      // 从 Walrus 读取加密数据
      const encryptedDataString = await readFromWalrus(record.blob_id);
      
      // 解析加密数据
      const encryptedData: EncryptedData = JSON.parse(encryptedDataString);
      
      // 生成用户密钥
      let userKey: string;
      try {
        // 优先尝试使用 Supabase 用户 ID
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          userKey = await generateUserKeyFromId(session.user.id);
        } else if (currentAccount?.address) {
          // 如果没有 Supabase session，使用钱包地址
          userKey = await generateUserKey(currentAccount.address);
        } else {
          throw new Error("无法生成用户密钥：需要登录或连接钱包");
        }
      } catch (keyError) {
        console.error("[Timeline] Failed to generate user key:", keyError);
        throw new Error("无法生成解密密钥");
      }
      
      // 解密数据（支持旧格式自动迁移）
      const decryptedString = await decryptDataWithMigration(encryptedData, userKey);
      
      // 解析解密后的 JSON 获取快照
      const snapshot = JSON.parse(decryptedString);
      
      // 存储解密后的描述
      setDecryptedDescriptions(prev => ({
        ...prev,
        [record.id]: snapshot.description || '',
      }));
      
      // 清除之前的错误信息
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
      
      // 提取详细错误信息
      let errorType = "unknown";
      let errorMessage = t("timeline.decryptFailedDesc");
      let statusCode: number | undefined;
      let suggestions: string[] = [];
      
      // 检查是否是 DecryptionError（新的错误类型）
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
        // 处理其他类型的错误（网络错误等）
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
          errorMessage = t("timeline.decryptNotFound");
          statusCode = 404;
          suggestions = [
            t("timeline.errorSuggestion.dataExpired"),
            t("timeline.errorSuggestion.contactSupport"),
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
        } else if (error.message.includes("无法生成") || error.message.includes("密钥") || error.message.includes("key")) {
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
      
      // 尝试从错误对象中提取状态码
      if (error.status) {
        statusCode = error.status;
      } else if (error.response?.status) {
        statusCode = error.response.status;
      }
      
      // 存储详细错误信息
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
      
      // 存储错误消息（不显示解密内容，只显示错误）
      setDecryptErrors(prev => ({
        ...prev,
        [record.id]: errorMessage,
      }));
    } finally {
      // 移除解密中标记
      setDecryptingRecords(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  }, [decryptedDescriptions, decryptingRecords, currentAccount, toast, t, isLocalRecord]);

  // 筛选后的记录
  const filteredRecords = useMemo(() => {
    if (filter === "all") return records;
    if (filter === "local") return records.filter(isLocalRecord);
    if (filter === "walrus") return records.filter(r => !isLocalRecord(r));
    return records;
  }, [records, filter]);

  // 统计数据
  const stats = useMemo(() => {
    const total = records.length;
    const local = records.filter(isLocalRecord).length;
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
      local,
      walrus,
      emotionCounts,
      avgIntensity,
      thisWeek,
      thisMonth,
    };
  }, [records]);

  // 情绪分布图表数据
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

  // 存储方式分布图表数据
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

  // 时间趋势数据（最近7天）
  const timelineChartData = useMemo(() => {
    const days = 7;
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = records.filter(r => {
        const recordDate = new Date(r.created_at);
        return recordDate >= date && recordDate < nextDate;
      }).length;
      
      data.push({
        date: date.toLocaleDateString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' }),
        count,
      });
    }
    
    return data;
  }, [records, i18n.language]);

  const chartConfig = {
    count: {
      label: t("timeline.stats.total"),
      color: "hsl(var(--chart-1))",
    },
  };

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

        {/* Header */}
        <div className="glass-card rounded-2xl p-8 mb-6">
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion shadow-md mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold">{t("timeline.title")}</h1>
            <p className="text-muted-foreground">{t("timeline.subtitle")}</p>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-3 justify-center mb-6">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-2">
              {(["all", "local", "walrus"] as FilterType[]).map((filterType) => (
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
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* Emotion Distribution Pie Chart */}
              {emotionChartData.length > 0 && (
                <Card className="p-6 glass-card">
                  <h3 className="text-lg font-semibold mb-4">{t("timeline.chart.emotionDistribution")}</h3>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <PieChart>
                      <Pie
                        data={emotionChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, emoji }) => `${emoji} ${value}`}
                        outerRadius={80}
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
                <Card className="p-6 glass-card">
                  <h3 className="text-lg font-semibold mb-4">{t("timeline.chart.storageDistribution")}</h3>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <PieChart>
                      <Pie
                        data={storageChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
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

          {/* Timeline Chart */}
          {records.length > 0 && timelineChartData.some(d => d.count > 0) && (
            <Card className="p-6 glass-card mb-6">
              <h3 className="text-lg font-semibold mb-4">{t("timeline.chart.timelineChart")}</h3>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={timelineChartData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </Card>
          )}
        </div>

        {/* Records List */}
        <div className="glass-card rounded-2xl p-8">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">{t("common.loading")}</p>
            </div>
          ) : (
            <>
              {filteredRecords.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    {filter === "all" ? t("timeline.noRecords") : t("timeline.noRecords")}
                  </h3>
                  <p className="text-muted-foreground mb-4">{t("timeline.noRecordsDesc")}</p>
                  <Button onClick={() => navigate("/record")} className="gradient-emotion">
                    {t("timeline.recordFirst")}
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
              {filteredRecords.map((record) => {
                const emotionKey = record.emotion as keyof typeof emotionLabels;
                const emotionConfig = emotionLabels[emotionKey] || {
                  label: record.emotion.charAt(0).toUpperCase() + record.emotion.slice(1),
                  emoji: "😊",
                  gradient: "from-gray-400 to-slate-400",
                  color: "#94a3b8",
                };
                const isLocal = isLocalRecord(record);
                
                return (
                  <Card key={record.id} className="p-6 hover:border-primary/50 transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br ${emotionConfig.gradient} shadow-md flex-shrink-0`}>
                        <span className="text-2xl">{emotionConfig.emoji}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{emotionConfig.label}</h3>
                            <p className="text-sm text-muted-foreground">{t("timeline.intensityValue", { value: record.intensity })}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">
                              {new Date(record.created_at).toLocaleDateString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${
                              isLocal 
                                ? "bg-purple-500/10 text-purple-500" 
                                : "bg-cyan-500/10 text-cyan-500"
                            }`}>
                              {isLocal ? "💾 " + t("timeline.filter.local") : "☁️ " + t("timeline.filter.walrus")}
                            </span>
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
                        {record.is_public && record.description && (
                          <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {record.description}
                            </p>
                          </div>
                        )}
                        {!record.is_public && (
                          <div className="mb-3 space-y-2">
                            {decryptedDescriptions[record.id] ? (
                              // 已解密，显示内容
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
                                      // 隐藏解密内容
                                      setDecryptedDescriptions(prev => {
                                        const next = { ...prev };
                                        delete next[record.id];
                                        return next;
                                      });
                                      // 清除错误信息
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
                              </div>
                            ) : decryptErrors[record.id] ? (
                              // 解密失败，显示错误信息和重试按钮
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
                                    
                                    {/* 详细错误信息（可展开） */}
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
                                        // 清除错误信息并重试
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
                              // 未解密，显示加密提示和解密按钮
                              <div className="p-3 rounded-lg bg-muted/10 border border-border/30">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-muted-foreground italic">
                                    {t("timeline.encryptedContent")}
                                  </p>
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
                            {record.proof_status === "confirmed" ? (
                              <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs">{t("timeline.verified")}</span>
                            ) : record.proof_status === "pending" ? (
                              <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs">{t("timeline.pending")}</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs">{t("timeline.failed")}</span>
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
                );
              })}
            </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
