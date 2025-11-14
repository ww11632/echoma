import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home, Sparkles, Shield, Clock, Lock, Unlock, Loader2, BookOpen, BarChart3, Filter, Eye, EyeOff } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { supabase } from "@/integrations/supabase/client";
import { listEmotionRecords } from "@/lib/localIndex";
import { getEmotions, getEmotionsByWallet, getEncryptedEmotionByBlob } from "@/lib/api";
import { queryWalrusBlobsByOwner, getWalrusUrl, readFromWalrus } from "@/lib/walrus";
import { decryptData, decryptDataWithMigration, generateUserKey, generateUserKeyFromId, DecryptionError, DecryptionErrorType } from "@/lib/encryption";
import type { EncryptedData } from "@/lib/encryption";
import { getAnonymousUserKey } from "@/lib/anonymousIdentity";
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
  wallet_address?: string | null;
  encrypted_data?: string | null;
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
    encrypted: { label: t("timeline.encryptedEmotion"), emoji: "🔒", gradient: "from-slate-400 to-gray-500", color: "#94a3b8" },
  };
  const [records, setRecords] = useState<EmotionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueryingOnChain, setIsQueryingOnChain] = useState(false);
  const [decryptingRecords, setDecryptingRecords] = useState<Set<string>>(new Set());
  const [decryptedDescriptions, setDecryptedDescriptions] = useState<Record<string, string>>({});
  const [decryptedAiResponses, setDecryptedAiResponses] = useState<Record<string, string>>({});
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
  const sortRecordsByDate = useCallback((items: EmotionRecord[]) => {
    return [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, []);

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      const allRecords: EmotionRecord[] = [];

      try {
        // 1. 嘗試從本地儲存載入記錄
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
            wallet_address: null,
          }));
          allRecords.push(...convertedLocalRecords);
        } catch (localError) {
          console.log("[Timeline] No local records or error loading:", localError);
        }

        // 2. 嘗試從 API 載入記錄（無論是否有錢包）
        try {
          const { data: { session } } = await supabase.auth.getSession();
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
                  };
                });
                allRecords.push(...convertedApiRecords);
              } catch (apiError) {
                console.log("[Timeline] API error (expected if server not running):", apiError);
              }
            }
          }
          
          // 如果有錢包連接，嘗試查詢鏈上的 Walrus blob 物件
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
              
              // 顯示開始查詢的 toast
              toast({
                title: t("timeline.queryingOnChain"),
                description: t("timeline.queryingOnChainDesc"),
              });
                
                const onChainBlobs = await queryWalrusBlobsByOwner(currentAccount.address);
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
                  const existing = allRecords.find(
                    r => r.blob_id === blob.blobId || r.sui_ref === blob.objectId
                  );

                  if (!existing) {
                    // 創建新的鏈上記錄
                    // 注意：鏈上記錄可能沒有 emotion/intensity 等資訊，這些在加密的 blob 中
                    // 我們可以嘗試從 blob 讀取，或使用預設值
                    const onChainRecord: EmotionRecord = {
                      id: `onchain_${blob.objectId}`,
                      emotion: "encrypted", // 加密資料尚未解密前提示為已加密
                      intensity: 50, // 預設值
                      description: "", // 加密內容，需要解密才能顯示
                      blob_id: blob.blobId,
                      walrus_url: getWalrusUrl(blob.blobId),
                      payload_hash: "",
                      is_public: false,
                      proof_status: "confirmed", // 鏈上記錄肯定是已確認的
                      sui_ref: blob.objectId,
                      created_at: blob.createdAt || new Date().toISOString(),
                      wallet_address: currentAccount?.address || null,
                    };
                    allRecords.push(onChainRecord);
                    addedCount++;
                    console.log(`[Timeline] ✅ Added on-chain record:`, {
                      blobId: blob.blobId,
                      objectId: blob.objectId,
                      walrusUrl: getWalrusUrl(blob.blobId)
                    });
                  } else {
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
                    if (currentAccount?.address && !existing.wallet_address) {
                      existing.wallet_address = currentAccount.address;
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
            }
          } catch (supabaseError) {
          console.log("[Timeline] Supabase error:", supabaseError);
        }

        // 3. 去重并排序（按时间倒序）
        console.log(`[Timeline] Starting deduplication with ${allRecords.length} total records`);
        
        // 分析 blob_id 重複情況
        const blobIdCounts = new Map<string, number>();
        allRecords.forEach(record => {
          const key = record.blob_id || record.id;
          blobIdCounts.set(key, (blobIdCounts.get(key) || 0) + 1);
        });
        
        const duplicateBlobIds = Array.from(blobIdCounts.entries())
          .filter(([_, count]) => count > 1)
          .sort((a, b) => b[1] - a[1]);
        
        if (duplicateBlobIds.length > 0) {
          console.log(`[Timeline] Found ${duplicateBlobIds.length} blob_ids with duplicates:`);
          duplicateBlobIds.forEach(([blobId, count]) => {
            console.log(`  - ${blobId.substring(0, 20)}... appears ${count} times`);
          });
        }
        
        const deduplicationMap = allRecords.reduce((map, record) => {
          const key = record.blob_id || record.id;
          const existing = map.get(key);
          if (!existing) {
            map.set(key, record);
            return map;
          }

          const existingTime = new Date(existing.created_at).getTime();
          const recordTime = new Date(record.created_at).getTime();
          if (!Number.isNaN(recordTime) && recordTime > existingTime) {
            console.log(`[Timeline] Dedup: replacing ${existing.id} with ${record.id} for key ${key}`);
            map.set(key, record);
          } else {
            console.log(`[Timeline] Dedup: keeping ${existing.id} for key ${key}, skipping ${record.id}`);
          }
          return map;
        }, new Map<string, EmotionRecord>());
        
        console.log(`[Timeline] After deduplication: ${deduplicationMap.size} unique records (removed ${allRecords.length - deduplicationMap.size} duplicates)`);
        console.log(`[Timeline] This is EXPECTED: Multiple Sui objects can reference the same Walrus blob`);
        
        const uniqueRecords = sortRecordsByDate(Array.from(deduplicationMap.values()));

        // 統計資訊
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
        
        // 特別檢查 Walrus 記錄
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

  // 判斷記錄是否為本地儲存
  const isLocalRecord = (record: EmotionRecord) => {
    // 檢查 blob_id 和 walrus_url 來判斷是否為本地記錄
    // 如果 blob_id 以 "local_" 開頭，或 walrus_url 以 "local://" 開頭，則為本地記錄
    const blobId = record.blob_id || "";
    const walrusUrl = record.walrus_url || "";
    
    const isLocalBlob = blobId.startsWith("local_");
    const isLocalUrl = walrusUrl.startsWith("local://");
    
    // 只有當明確是本地格式時，才返回 true
    // 其他情況（包括 walrus_url 是 https://aggregator.testnet.walrus.space 開頭，或 blob_id 是正常的 Walrus ID）都是 Walrus 記錄
    const isLocal = isLocalBlob || isLocalUrl;
    
    // 除錯日誌
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

    // 如果是公開記錄，不需要解密
    if (record.is_public) {
      return;
    }

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
      // 優先使用資料庫中的 encrypted_data，否則從 Walrus 讀取
      let encryptedDataString: string;
      if (record.encrypted_data) {
        console.log(`[Timeline] Using encrypted_data from database for record ${record.id}`);
        encryptedDataString = record.encrypted_data;
      } else {
        // 從 Walrus 讀取加密資料（失敗時回退到本地伺服器備份）
        try {
          encryptedDataString = await readFromWalrus(record.blob_id);
        } catch (walrusError) {
          console.warn(`[Timeline] Walrus fetch failed for ${record.blob_id}, falling back to server backup`, walrusError);
          encryptedDataString = await getEncryptedEmotionByBlob(record.blob_id);
        }
      }
      
      // 解析加密資料
      const encryptedData: EncryptedData = JSON.parse(encryptedDataString);
      
      // 嘗試所有可能的解密金鑰（因為記錄可能是在不同模式下加密的）
      const possibleKeys: Array<{key: string, type: string}> = [];
      
      try {
        // 1. 優先嘗試 Supabase 使用者 ID（如果有登錄）
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const supabaseKey = await generateUserKeyFromId(session.user.id);
          possibleKeys.push({ key: supabaseKey, type: 'Supabase User' });
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
      const snapshotTimestamp = snapshot.timestamp
        ? new Date(snapshot.timestamp).toISOString()
        : null;
      
      // 更新記錄的 metadata（例如真實時間戳與情緒/強度）
      if (snapshotTimestamp || snapshot.emotion || snapshot.intensity) {
        setRecords(prev =>
          sortRecordsByDate(prev.map(r => {
            if (r.id !== record.id) return r;
            return {
              ...r,
              created_at: snapshotTimestamp || r.created_at,
              emotion: snapshot.emotion || r.emotion,
              intensity: typeof snapshot.intensity === "number" ? snapshot.intensity : r.intensity,
              wallet_address: snapshot.walletAddress || r.wallet_address,
            };
          }))
        );
      }
      
      // 儲存解密後的描述
      setDecryptedDescriptions(prev => ({
        ...prev,
        [record.id]: snapshot.description || '',
      }));
      
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
  }, [decryptedDescriptions, decryptingRecords, currentAccount, toast, t, isLocalRecord]);

  // 篩選後的記錄
  const filteredRecords = useMemo(() => {
    if (filter === "all") return records;
    
    // 內聯 isLocalRecord 邏輯以確保正確過濾
    const isLocal = (record: EmotionRecord) => {
      const blobId = record.blob_id || "";
      const walrusUrl = record.walrus_url || "";
      return blobId.startsWith("local_") || walrusUrl.startsWith("local://");
    };
    
    if (filter === "local") return records.filter(isLocal);
    if (filter === "walrus") return records.filter(r => !isLocal(r));
    return records;
  }, [records, filter]);

  // 統計資料
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

  // 時間趨勢資料（最近7天）
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

          {/* Timeline Chart */}
          {records.length > 0 && timelineChartData.some(d => d.count > 0) && (
            <Card className="p-6 glass-card mb-6 overflow-hidden">
              <h3 className="text-lg font-semibold mb-4">{t("timeline.chart.timelineChart")}</h3>
              <ChartContainer config={chartConfig} className="h-[200px] w-full overflow-hidden">
                <BarChart data={timelineChartData} margin={{ left: 0, right: 0 }}>
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
