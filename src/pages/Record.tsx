import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sparkles, ArrowLeft, Loader2, Lock, Unlock, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentAccount, useCurrentWallet, useSuiClient } from "@mysten/dapp-kit";
import { toBase64 } from "@mysten/sui/utils";
import { encryptData, generateUserKey, generateUserKeyFromId, PUBLIC_SEAL_KEY } from "@/lib/encryption";
import { prepareEmotionSnapshot, uploadToWalrusWithSDK, createSignerFromWallet } from "@/lib/walrus";
import { validateAndSanitizeDescription, emotionSnapshotSchema } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { addEmotionRecord, initializeEncryptedStorage } from "@/lib/localIndex";
import type { EmotionRecord } from "@/lib/dataSchema";
import { postEmotion } from "@/lib/api";
import { getOrCreateJournal, mintEntry } from "@/lib/mintContract";
import GlobalControls from "@/components/GlobalControls";
import WalletConnect from "@/components/WalletConnect";
import { getOrCreateAnonymousUserKey, getOrCreateAnonymousUserId } from "@/lib/anonymousIdentity";
import { TagInput } from "@/components/TagInput";
import { useSelectedNetwork } from "@/hooks/useSelectedNetwork";
import { getNetworkConfig } from "@/lib/networkConfig";

const isBackendUnavailable = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  return (
    message.includes("Failed to fetch") ||
    message.includes("ERR_CONNECTION_REFUSED") ||
    message.includes("Network error") ||
    message.includes("fetch") ||
    message.includes("connection refused")
  );
};

const Record = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const currentAccount = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const suiClient = useSuiClient(); // 使用 dapp-kit 提供的 SuiClient，避免 CORS 问题
  const currentNetwork = useSelectedNetwork(); // 获取当前选择的网络
  
  // Track if component is mounted to prevent navigation after unmount
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Safe navigation function that checks if component is still mounted
  const navigateToTimeline = () => {
    if (isMountedRef.current) {
      navigate("/timeline");
    }
  };
  
  // Check wallet connection before critical operations
  const checkWalletConnection = () => {
    if (!currentWallet || !currentAccount) {
      throw new Error("Wallet disconnected during operation. Please reconnect your wallet and try again.");
    }
  };

  const emotionTags = [
    { label: t("emotions.joy"), value: "joy", color: "from-yellow-400 to-orange-400" },
    { label: t("emotions.sadness"), value: "sadness", color: "from-blue-400 to-indigo-400" },
    { label: t("emotions.anger"), value: "anger", color: "from-red-400 to-rose-400" },
    { label: t("emotions.anxiety"), value: "anxiety", color: "from-purple-400 to-pink-400" },
    { label: t("emotions.confusion"), value: "confusion", color: "from-gray-400 to-slate-400" },
    { label: t("emotions.peace"), value: "peace", color: "from-green-400 to-teal-400" },
  ];
  const [selectedEmotion, setSelectedEmotion] = useState<string>("");
  const [intensity, setIntensity] = useState([50]);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [saveLocally, setSaveLocally] = useState(true); // 默认保存到本地
  const [backupToDatabase, setBackupToDatabase] = useState(true); // 是否備份到 Supabase
  const [mintAsNFT, setMintAsNFT] = useState(false); // 是否鑄造為 NFT
  const [epochs, setEpochs] = useState([200]); // Walrus 儲存期限（epochs），預設 200 epochs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "encrypting" | "uploading" | "saving" | "success" | "error">("idle");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 標籤建議（可以從本地存儲中獲取常用標籤）
  const tagSuggestions = [
    t("tags.work") || "工作",
    t("tags.family") || "家庭",
    t("tags.health") || "健康",
    t("tags.study") || "學習",
    t("tags.relationship") || "關係",
    t("tags.finance") || "財務",
    t("tags.hobby") || "興趣",
    t("tags.travel") || "旅行",
  ];

  const getAiResponse = async () => {
    // 檢查是否有輸入描述
    if (!description.trim()) {
      toast({
        title: t("record.errors.missingDescription"),
        description: t("record.errors.missingDescriptionDesc"),
        variant: "destructive",
      });
      return;
    }

    // 檢查是否選擇了情緒
    if (!selectedEmotion) {
      toast({
        title: t("record.errors.missingEmotion"),
        description: t("record.errors.missingEmotionDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsAiLoading(true);
    setAiResponse("");

    try {
      // 獲取匿名 ID（如果沒有登入）
      const { data: { session } } = await supabase.auth.getSession();
      const anonymousId = session?.user?.id ? undefined : getOrCreateAnonymousUserId();

      // 調用 AI 回應 function（匿名用戶不需要 auth header）
      const { data, error } = await supabase.functions.invoke('ai-emotion-response', {
        body: {
          emotion: selectedEmotion,
          intensity: intensity[0],
          description,
          language: i18n.language.startsWith('zh') ? 'zh-TW' : 'en',
          anonymousId: anonymousId,
        },
        // 如果有 session，使用 auth header；否則匿名調用
        ...(session?.access_token ? {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        } : {}),
      });

      if (error) throw error;

      if (data?.success && data?.response) {
        setAiResponse(data.response);
      } else {
        throw new Error(data?.error || 'Failed to get AI response');
      }
    } catch (error: any) {
      console.error('AI response error:', error);
      
      // 区分不同类型的错误
      let errorTitle = t("record.errors.aiError");
      let errorDescription = t("record.errors.aiErrorDesc");
      
      // 检查错误消息（可能是英文或中文）
      const errorMsg = (error?.message || error?.error || '').toLowerCase();
      
      // 检查速率限制错误（支持中英文）
      if (errorMsg.includes('rate limit') || 
          errorMsg.includes('too many requests') ||
          errorMsg.includes('请求过于频繁') ||
          errorMsg.includes('rate_limit_exceeded') ||
          error?.errorCode === 'RATE_LIMIT') {
        errorTitle = t("record.errors.rateLimitExceeded");
        errorDescription = t("record.errors.rateLimitExceededDesc");
      } 
      // 检查服务不可用错误（支持中英文）
      else if (errorMsg.includes('service unavailable') || 
               errorMsg.includes('服务暂时不可用') ||
               errorMsg.includes('503') ||
               error?.errorCode === 'SERVICE_UNAVAILABLE') {
        errorTitle = t("record.errors.serviceUnavailable");
        errorDescription = t("record.errors.serviceUnavailableDesc");
      }
      // 检查安全阻止错误
      else if (errorMsg.includes('sensitive content') ||
               errorMsg.includes('检测到敏感内容') ||
               error?.errorCode === 'SECURITY_BLOCKED') {
        errorTitle = t("record.errors.aiError");
        errorDescription = error?.error || error?.message || t("record.errors.aiErrorDesc");
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const saveToLocalIndex = async (
    sanitizedDescription: string,
    emotionValue: string,
    isPublicValue: boolean,
    intensityValue?: number,
    tagsValue?: string[]
  ) => {
    // Validate intensity value if provided
    if (intensityValue !== undefined) {
      if (intensityValue < 0 || intensityValue > 100) {
        throw new Error("Intensity must be between 0 and 100");
      }
    }

    // Validate and map emotion type (support all emotion types)
    const validEmotions: EmotionRecord["emotion"][] = ["joy", "sadness", "anger", "anxiety", "confusion", "peace"];
    const emotion = validEmotions.includes(emotionValue as EmotionRecord["emotion"])
      ? (emotionValue as EmotionRecord["emotion"])
      : "joy"; // Default to joy if invalid

    // Note: We don't initialize encrypted storage here anymore.
    // The addEmotionRecord function will handle encryption key selection and storage initialization
    // based on the record's privacy setting and user context.
    // This ensures consistency between public and private records.

    const localRecord: EmotionRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      emotion: emotion,
      note: sanitizedDescription,
      proof: null,
      version: "1.0.0",
      isPublic: isPublicValue,
      intensity: intensityValue, // 保存強度值（如果提供）
      tags: tagsValue && tagsValue.length > 0 ? tagsValue : [], // 統一使用空數組表示無標籤
    };

    // The addEmotionRecord function will handle encryption key selection and storage
    // based on the record's privacy setting and user context
    try {
      await addEmotionRecord(localRecord, currentAccount?.address);
    } catch (error: any) {
      console.error("[Record] Failed to save to local index:", error);
      // Re-throw with user-friendly message
      const errorMessage = error?.message || "保存失敗";
      // Check for storage quota exceeded error
      if (errorMessage === "STORAGE_QUOTA_EXCEEDED" || 
          (error as any)?.errorCode === "STORAGE_QUOTA_EXCEEDED" ||
          errorMessage.includes("QuotaExceeded")) {
        // This will be handled in handleSubmit's error handling
        const quotaError = new Error("STORAGE_QUOTA_EXCEEDED");
        (quotaError as any).errorCode = "STORAGE_QUOTA_EXCEEDED";
        throw quotaError;
      }
      // Check if this is a decryption error that can be recovered
      if (error?.isDecryptionError && error?.canForceClear) {
        // Re-throw with the original message (it already contains helpful instructions)
        throw error;
      }
      throw new Error(`保存到本地儲存失敗：${errorMessage}`);
    }
  };

  const handleSubmit = async () => {
    if (!selectedEmotion || !description.trim()) {
      toast({
        title: t("record.errors.missingInfo"),
        description: t("record.errors.missingInfoDesc"),
        variant: "destructive",
      });
      return;
    }

    // Debug: Log all relevant states at submit time
    console.log("[Record] 📝 Submit started with states:", {
      mintAsNFT,
      saveLocally,
      currentAccount: currentAccount?.address,
      walletConnected: !!currentWallet,
    });

    setIsSubmitting(true);
    setUploadStatus("encrypting");

    try {
      // Step 1: Validate and sanitize inputs
      const sanitizedDescription = validateAndSanitizeDescription(description);
      
      // Validate emotion type
      const validEmotions = ["joy", "sadness", "anger", "anxiety", "confusion", "peace"];
      if (!validEmotions.includes(selectedEmotion)) {
        throw new Error("Invalid emotion type selected");
      }

      // Validate intensity
      const intensityValue = intensity[0];
      if (intensityValue < 0 || intensityValue > 100) {
        throw new Error("Intensity must be between 0 and 100");
      }

      // 無錢包：匿名上傳 Walrus（使用隨機金鑰加密）
      if (!currentAccount) {
        // 如果用戶選擇保存到本地，直接保存，不上傳
        if (saveLocally) {
          console.log("[Record] Anonymous user chose to save locally only, skipping Walrus upload");
          setUploadStatus("saving");
          await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic, intensityValue, tags);
          setUploadStatus("success");
          
          toast({
            title: t("record.success.recordedLocal"),
            description: t("record.success.recordedLocalDesc"),
            variant: "default",
          });
          setTimeout(navigateToTimeline, 1200);
          return;
        }
        
        // 建立匿名 payload（不含錢包位址）
        const anonPayload = {
          emotion: selectedEmotion,
          intensity: intensityValue,
          description: sanitizedDescription,
          timestamp: new Date().toISOString(), // 統一使用 ISO 字符串格式
          walletAddress: null,
          version: "1.0.0",
        };
        // 根據隱私設置選擇加密金鑰
        // 公開記錄：使用共享公開金鑰（任何人都可以解密）
        // 私密記錄：使用用戶專屬金鑰（只有用戶可以解密）
        const { data: { session } } = await supabase.auth.getSession();
        const anonymousKey = isPublic
          ? PUBLIC_SEAL_KEY
          : (session?.user?.id
              ? await generateUserKeyFromId(session.user.id)
              : await getOrCreateAnonymousUserKey());

        const encrypted = await encryptData(JSON.stringify(anonPayload), anonymousKey);
        const encryptedString = JSON.stringify(encrypted);
        setUploadStatus("uploading");
        
        try {
          const selectedEpochs = epochs[0];
          const apiRes = await postEmotion({
            emotion: selectedEmotion,
            intensity: intensityValue,
            description: sanitizedDescription,
            encryptedData: encryptedString,
            isPublic,
            walletAddress: null,
            epochs: selectedEpochs,
            network: currentNetwork, // 传递当前选择的网络
          });
          
          // Backup encrypted_data to Supabase (if user chose to backup)
          if (backupToDatabase) {
            if (!session?.user?.id) {
              console.warn("[Record] ⚠️ Backup requested but no Supabase session. User needs to login.");
              toast({
                title: t("record.backup.cannotBackup"),
                description: t("record.backup.cannotBackupDesc"),
                variant: "default",
              });
            } else if (apiRes.record.blobId) {
              try {
                console.log("[Record] Backing up encrypted_data to Supabase...");
                const { error: backupError } = await supabase
                  .from('emotion_records')
                  .insert([{
                    user_id: session.user.id,
                    emotion: selectedEmotion as any,
                    intensity: intensityValue,
                    blob_id: apiRes.record.blobId,
                    walrus_url: apiRes.record.walrusUrl,
                    payload_hash: apiRes.record.payloadHash,
                    encrypted_data: encryptedString,
                    is_public: isPublic,
                    proof_status: apiRes.record.proof.status as any,
                    sui_ref: apiRes.record.proof.suiRef,
                  }]);
                
                if (backupError) {
                  console.error("[Record] Failed to backup to Supabase:", backupError);
                  toast({
                    title: t("record.backup.backupFailed"),
                    description: t("record.backup.backupFailedDesc"),
                    variant: "default",
                  });
                } else {
                  console.log("[Record] ✅ Successfully backed up to Supabase");
                }
              } catch (backupErr) {
                console.error("[Record] Backup error:", backupErr);
              }
            }
          }
          
          setUploadStatus("success");
          
          // Show warning if Walrus upload failed
          if (apiRes.warning) {
            toast({
              title: t("record.success.recordedLocal"),
              description: t("record.success.recordedLocalServer"),
              variant: "default",
            });
          } else {
            toast({
              title: t("record.success.recorded"),
              description: t("record.success.recordedWalrus", { blobId: apiRes.record.blobId.slice(0, 8) }),
            });
          }
          setTimeout(navigateToTimeline, 1200);
          return;
        } catch (apiError) {
          // Only fallback to local if backend is unavailable (not if user explicitly chose not to save locally)
          if (isBackendUnavailable(apiError)) {
            console.log("[Client] API failed, saving to local storage as fallback");
            setUploadStatus("saving");
            await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic, intensityValue, tags);
            setUploadStatus("success");
            
            toast({
              title: t("record.success.recordedLocal"),
              description: t("record.success.recordedLocalDesc"),
              variant: "default",
            });
            setTimeout(navigateToTimeline, 1200);
            return;
          }
          throw apiError;
        }
      }

      // Step 2: Generate emotion snapshot with validated inputs
      const snapshot = prepareEmotionSnapshot(
        selectedEmotion,
        intensityValue,
        sanitizedDescription,
        currentAccount.address
      );

      // Validate snapshot with zod schema
      emotionSnapshotSchema.parse(snapshot);

      // Step 3: Generate secure encryption key based on privacy setting
      // Public records: use shared public key (anyone can decrypt)
      // Private records: use user-specific key (only user can decrypt)
      const encryptionKey = isPublic 
        ? PUBLIC_SEAL_KEY 
        : await generateUserKey(currentAccount.address);
      
      // Step 4: Encrypt snapshot
      const encryptedData = await encryptData(JSON.stringify(snapshot), encryptionKey);
      const encryptedString = JSON.stringify(encryptedData);

      // Step 5: Check if user wants to save locally only
      if (saveLocally) {
        // User chose to save locally only - skip Walrus upload
        console.log("[Record] User chose to save locally only, skipping Walrus upload");
        setUploadStatus("saving");
        await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic, intensityValue, tags);
        setUploadStatus("success");
        
        toast({
          title: "情緒已記錄（本地儲存）",
          description: "資料已保存到本地瀏覽器。",
          variant: "default",
        });
        setTimeout(() => navigate("/timeline"), 1200);
        return;
      }

      // Step 6: Upload to Walrus (only if saveLocally is false)
      setUploadStatus("uploading");
      toast({
        title: t("record.success.uploading"),
        description: t("record.success.uploadingDesc"),
      });

      // If user chose Walrus upload, wallet must be connected
      checkWalletConnection();

      // Try SDK method first (this will trigger transaction popup)
      try {
        // Check wallet connection again before SDK upload
        checkWalletConnection();
        
        console.log("[Record] Attempting SDK upload with wallet - THIS WILL TRIGGER TRANSACTION POPUP");
        console.log("[Record] Wallet:", currentWallet?.name, "Account:", currentAccount.address);
        console.log("[Record] Current network:", currentNetwork);
        
        // 使用 dapp-kit 提供的 SuiClient，它会自动处理 CORS 和网络配置
        const signer = createSignerFromWallet(currentWallet, currentAccount.address, suiClient, currentNetwork);
        const selectedEpochs = epochs[0];
        const sdkResult = await uploadToWalrusWithSDK(encryptedString, signer, selectedEpochs, currentNetwork);
        
        // Check wallet connection again after SDK upload
        checkWalletConnection();
        
        console.log("[Record] ✅ SDK upload successful:", sdkResult);
        console.log("[Record] 🔍 Debug info:", {
          mintAsNFT,
          currentAccount: currentAccount?.address,
          walletConnected: !!currentWallet,
        });
        
        // Mint NFT if user selected the option
        let nftId: string | null = null;
        let nftTransactionDigest: string | null = null;
        if (mintAsNFT) {
          console.log("[Record] 🎨 NFT minting is ENABLED, starting process...");
          // Declare variables outside try block so they're accessible in catch
          let journalId: string | null = null;
          let moodScore: number = 0;
          try {
            console.log("[Record] 🎨 Starting NFT minting process...");
            setUploadStatus("uploading"); // Keep uploading status for NFT minting
            
            // Import checkContractDeployed
            const { checkContractDeployed } = await import("@/lib/mintContract");
            
            // Check if contract is deployed
            console.log("[Record] Checking if contract is deployed on", currentNetwork, "...");
            const isDeployed = await checkContractDeployed(currentNetwork);
            if (!isDeployed) {
              throw new Error(`合約尚未部署到 ${currentNetwork}。請先部署合約或聯繫開發者。`);
            }
            
            // Get or create Journal
            // Use signer's signAndExecuteTransaction method (from createSignerFromWallet)
            const signAndExecute = async ({ transaction, chain }: any) => {
              console.log("[Record] Signing transaction for NFT minting...");
              try {
                const result = await signer.signAndExecuteTransaction({
                  transaction,
                  client: suiClient,
                });
                console.log("[Record] Transaction signed and executed:", result.digest);
                return result;
              } catch (signError: any) {
                console.error("[Record] Transaction signing error:", signError);
                throw new Error(`交易簽名失敗: ${signError.message || "未知錯誤"}`);
              }
            };
            
            console.log("[Record] Getting or creating Journal on", currentNetwork, "...");
            journalId = await getOrCreateJournal(signAndExecute, currentAccount.address, currentNetwork);
            if (!journalId) {
              throw new Error("無法獲取或創建 Journal，請檢查錢包連接和餘額");
            }
            console.log("[Record] Journal ID:", journalId);
            
            // 檢查今天是否已經鑄造過 NFT
            const { checkTodayMinted } = await import("@/lib/mintContract");
            const alreadyMintedToday = await checkTodayMinted(journalId, currentNetwork);
            if (alreadyMintedToday) {
              throw new Error("今天已經鑄造過 NFT，每天只能鑄造一次。請明天再試。");
            }
            
            // Calculate mood score (1-10) from intensity (0-100)
            moodScore = Math.max(1, Math.min(10, Math.round(intensityValue / 10)));
            
            // Prepare tags CSV
            const tagsCsv = tags.length > 0 ? tags.join(",") : "";
            
            // Use Echoma logo for mainnet NFTs, Walrus URL for testnet (backward compatible)
            let imageUrl: string;
            let imageMime: string;
            
            if (currentNetwork === "mainnet") {
              // Mainnet: use Echoma logo if configured
              const config = getNetworkConfig("mainnet");
              imageUrl = config.nftLogoUrl || sdkResult.walrusUrl || "";
              imageMime = config.nftLogoUrl ? "image/png" : "text/plain"; // Logo is PNG, fallback to text/plain
              
              console.log("[Record] Mainnet NFT image configuration:", {
                network: currentNetwork,
                nftLogoUrl: config.nftLogoUrl,
                walrusUrl: sdkResult.walrusUrl,
                finalImageUrl: imageUrl,
                imageMime,
              });
            } else {
              // Testnet: use Walrus URL (backward compatible)
              imageUrl = sdkResult.walrusUrl || "";
              imageMime = "text/plain"; // Since we're storing encrypted data
            }
            
            // Mint the NFT
            console.log("[Record] Minting Entry NFT with params:", {
              journalId,
              moodScore,
              descriptionLength: sanitizedDescription.length,
              tagsCsv,
              imageUrl: imageUrl ? `${imageUrl.substring(0, 80)}...` : "empty",
              imageMime,
            });
            
            const mintResult = await mintEntry(
              signAndExecute,
              journalId,
              moodScore,
              sanitizedDescription,
              tagsCsv,
              imageUrl,
              imageMime,
              undefined, // imageSha256 - optional
              undefined, // audioUrl - optional
              undefined, // audioMime - optional
              undefined, // audioSha256 - optional
              undefined, // audioDurationMs - optional
              currentAccount.address, // sender
              currentNetwork // network - 确保使用正确的网络
            );
            
            if (!mintResult || !mintResult.nftId) {
              throw new Error("NFT 鑄造完成但未返回 NFT ID");
            }
            
            nftId = mintResult.nftId;
            nftTransactionDigest = mintResult.transactionDigest;
            
            console.log("[Record] ✅ NFT minted successfully! NFT ID:", nftId, "Transaction:", nftTransactionDigest);
          } catch (nftError: any) {
            console.error("[Record] ❌ NFT minting failed:", nftError);
            console.error("[Record] Error details:", {
              message: nftError?.message,
              stack: nftError?.stack,
              name: nftError?.name,
              code: nftError?.code,
              cause: nftError?.cause,
            });
            
            // 記錄詳細錯誤信息到本地存儲（用於調試）
            try {
              const errorLog = {
                timestamp: new Date().toISOString(),
                error: {
                  message: nftError?.message,
                  name: nftError?.name,
                  code: nftError?.code,
                  stack: nftError?.stack?.substring(0, 500), // 限制長度
                },
                context: {
                  walletAddress: currentAccount?.address,
                  recordId: "unknown",
                  intensity,
                },
              };
              const existingLogs = JSON.parse(localStorage.getItem("nft_mint_errors") || "[]");
              existingLogs.push(errorLog);
              // 只保留最近 10 條錯誤記錄
              const recentLogs = existingLogs.slice(-10);
              localStorage.setItem("nft_mint_errors", JSON.stringify(recentLogs));
            } catch (logError) {
              console.warn("[Record] Failed to log NFT error:", logError);
            }
            
            // Don't fail the entire operation if NFT minting fails
            // Show warning toast but continue
            let errorMessage = nftError?.message || "未知錯誤";
            
            // 提供更友好的錯誤訊息
            if (errorMessage.includes("合約尚未部署") || errorMessage.includes("Contract not found")) {
              errorMessage = "合約尚未部署到 testnet，請聯繫開發者";
            } else if (errorMessage.includes("餘額不足") || errorMessage.includes("Insufficient")) {
              errorMessage = "錢包餘額不足，請確保有足夠的 SUI 代幣支付 Gas 費用";
            } else if (errorMessage.includes("E_DUP_DAY") || errorMessage.includes("duplicate")) {
              errorMessage = "今天已經鑄造過 NFT，每天只能鑄造一次";
            } else if (errorMessage.includes("Missing transaction sender")) {
              errorMessage = "交易發送者缺失，請重新連接錢包";
            }
            
            toast({
              title: t("record.errors.nftMintFailed") || "NFT 鑄造失敗",
              description: errorMessage.length > 100 
                ? `${errorMessage.substring(0, 100)}...` 
                : errorMessage,
              variant: "destructive",
            });
          }
        } else {
          console.log("[Record] ⚠️ NFT minting is DISABLED (mintAsNFT = false)");
        }
        
        setUploadStatus("success");
        // Show success toast with NFT info if minted
        // 如果用户选择了铸造 NFT 但失败了，需要明确告知
        if (mintAsNFT && !nftId) {
          // 用户选择了铸造但失败了，显示警告但记录已保存
          toast({
            title: t("record.success.recorded") || "記錄已保存",
            description: t("record.success.recordedButNFTFailed") || "記錄已保存到 Walrus，但 NFT 鑄造失敗。您可以在 Timeline 中查看記錄，稍後可以重新嘗試鑄造。",
            variant: "default",
          });
        } else if (nftId) {
          // NFT 铸造成功
          toast({
            title: t("record.success.recorded"),
            description: t("record.success.recordedWithNFT") || `記錄已保存並鑄造為 NFT！NFT ID: ${nftId.slice(0, 8)}...`,
          });
        } else {
          // 没有选择铸造 NFT 或铸造成功
          toast({
            title: t("record.success.recorded"),
            description: t("record.success.recordedSDK", { blobId: sdkResult.blobId.slice(0, 8) }),
          });
        }
        
        // Try to save metadata to backend and Supabase (optional)
        try {
          const selectedEpochs = epochs[0];
          await postEmotion({
            emotion: selectedEmotion,
            intensity: intensityValue,
            description: sanitizedDescription,
            encryptedData: encryptedString,
            isPublic,
            walletAddress: currentAccount.address,
            epochs: selectedEpochs,
            network: currentNetwork, // 传递当前选择的网络
          });
          
          // Backup encrypted_data to Supabase (if user chose to backup)
          const { data: { session: backupSession } } = await supabase.auth.getSession();
          if (backupToDatabase) {
            if (!backupSession?.user?.id) {
              console.warn("[Record] ⚠️ Backup requested but no Supabase session.");
            } else {
              console.log("[Record] Backing up encrypted_data to Supabase after SDK upload...");
              // 優先使用 NFT ID 作為 sui_ref（如果已鑄造），否則使用 Walrus blob 的 object ID
              const suiRef = nftId || sdkResult.suiRef;
              
              // 準備插入數據，transaction_digest 是可選的
              const recordData: any = {
                user_id: backupSession.user.id,
                emotion: selectedEmotion as any,
                intensity: intensityValue,
                blob_id: sdkResult.blobId,
                walrus_url: sdkResult.walrusUrl, // 使用 SDK 返回的 walrusUrl，它已经包含正确的网络信息
                payload_hash: '',
                encrypted_data: encryptedString,
                is_public: isPublic,
                proof_status: 'confirmed' as any,
                sui_ref: suiRef, // 使用 NFT ID（如果已鑄造）或 Walrus blob object ID
                wallet_address: currentAccount.address,
              };
              
              // 只有在有 transaction_digest 時才添加（避免數據庫字段不存在時出錯）
              if (nftTransactionDigest) {
                recordData.transaction_digest = nftTransactionDigest;
              }
              
              const { error: backupError } = await supabase
                .from('emotion_records')
                .insert([recordData]);
              
              if (backupError) {
                console.error("[Record] Failed to backup to Supabase:", backupError);
                // 如果是 transaction_digest 字段不存在的錯誤，記錄但不影響主流程
                if (backupError.message?.includes("transaction_digest") || backupError.message?.includes("column")) {
                  console.warn("[Record] ⚠️ transaction_digest field may not exist in database. Please run migration.");
                }
              } else {
                console.log("[Record] ✅ Successfully backed up to Supabase", nftId ? `with NFT ID: ${nftId}` : "", nftTransactionDigest ? `and transaction: ${nftTransactionDigest.slice(0, 8)}...` : "");
              }
            }
          }
        } catch (metadataError) {
          console.warn("[Record] Metadata save failed (not critical):", metadataError);
        }
        
        // Wait a bit before navigating to show success message
        // If NFT was minted, wait a bit longer to show the NFT ID
        const delay = nftId ? 2000 : 1200;
        console.log("[Record] Navigating to timeline in", delay, "ms, NFT ID:", nftId);
        setTimeout(() => navigate("/timeline"), delay);
        return;
      } catch (sdkError: any) {
        console.error("[Record] SDK upload failed:", sdkError);
        
        // Show specific error message for SDK failures
        if (sdkError.message.includes("餘額不足") || sdkError.message.includes("Insufficient balance") || sdkError.message.toLowerCase().includes("insufficient")) {
          toast({
            title: t("record.wallet.insufficientBalance"),
            description: t("record.wallet.insufficientBalanceDesc"),
            variant: "destructive",
          });
          setUploadStatus("error");
          setIsSubmitting(false);
          return;
        } else if (sdkError.message.includes("簽名失敗") || sdkError.message.includes("Sign failed") || sdkError.message.toLowerCase().includes("sign")) {
          toast({
            title: t("record.wallet.signFailed"),
            description: t("record.wallet.signFailedDesc"),
            variant: "destructive",
          });
          setUploadStatus("error");
          setIsSubmitting(false);
          return;
        } else if (sdkError.message.includes("交易已取消") || sdkError.message.includes("Transaction cancelled") || sdkError.message.toLowerCase().includes("cancelled") || sdkError.message.toLowerCase().includes("user rejected")) {
          toast({
            title: t("record.wallet.transactionCancelled"),
            description: t("record.wallet.transactionCancelledDesc"),
            variant: "default",
          });
          setUploadStatus("idle"); // 用戶取消，恢復到初始狀態
          setIsSubmitting(false);
          return;
        }
        
        // For other SDK errors, throw to prevent fallback to local storage
        // User explicitly chose Walrus upload, so we should not silently fallback to local
        throw new Error(`Walrus SDK upload failed: ${sdkError.message || "Unknown error"}`);
      }

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // 沒有 Supabase session：走自建 API（後端存 Walrus + 本地檔案）作為主線
        // Check wallet connection before API call
        checkWalletConnection();
        try {
          const selectedEpochs = epochs[0];
          const apiRes = await postEmotion({
            emotion: selectedEmotion,
            intensity: intensityValue,
            description: sanitizedDescription,
            encryptedData: encryptedString,
            isPublic,
            walletAddress: currentAccount.address,
            epochs: selectedEpochs,
          });
          
          // Backup encrypted_data to Supabase (if user chose to backup)
          const { data: { session: backupSession } } = await supabase.auth.getSession();
          if (backupToDatabase) {
            if (!backupSession?.user?.id) {
              console.warn("[Record] ⚠️ Backup requested but no Supabase session.");
            } else if (apiRes.record.blobId) {
              try {
                console.log("[Record] Backing up encrypted_data to Supabase...");
                const { error: backupError } = await supabase
                  .from('emotion_records')
                  .insert([{
                    user_id: backupSession.user.id,
                    emotion: selectedEmotion as any,
                    intensity: intensityValue,
                    blob_id: apiRes.record.blobId,
                    walrus_url: apiRes.record.walrusUrl,
                    payload_hash: apiRes.record.payloadHash,
                    encrypted_data: encryptedString,
                    is_public: isPublic,
                    proof_status: apiRes.record.proof.status as any,
                    sui_ref: apiRes.record.proof.suiRef,
                    wallet_address: currentAccount.address,
                  }]);
                
                if (backupError) {
                  console.error("[Record] Failed to backup to Supabase:", backupError);
                } else {
                  console.log("[Record] ✅ Successfully backed up to Supabase");
                }
              } catch (backupErr) {
                console.error("[Record] Backup error:", backupErr);
              }
            }
          }
          
          setUploadStatus("success");
          
          // Show warning if Walrus upload failed
          if (apiRes.warning) {
            toast({
              title: t("record.success.recordedLocal"),
              description: t("record.success.recordedLocalServer"),
              variant: "default",
            });
          } else {
            toast({
              title: t("record.success.recorded"),
              description: t("record.success.recordedWalrus", { blobId: apiRes.record.blobId.slice(0, 8) }),
            });
          }
          setTimeout(navigateToTimeline, 1200);
          return;
        } catch (apiError) {
          // If user chose Walrus upload (saveLocally = false), don't fallback to local storage
          // Only fallback if user explicitly chose local storage OR backend is completely unavailable
          if (saveLocally) {
            // User chose local storage, so fallback is OK
            console.log("[Client] API failed, saving to local storage as fallback");
            setUploadStatus("saving");
            await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic, intensityValue, tags);
            setUploadStatus("success");
            
            toast({
              title: t("record.success.recordedLocal"),
              description: t("record.success.recordedLocalDesc"),
              variant: "default",
            });
            setTimeout(navigateToTimeline, 1200);
            return;
          } else if (isBackendUnavailable(apiError)) {
            // Backend is completely unavailable, but user chose Walrus upload
            // Still don't silently fallback - show error instead
            throw new Error("Backend service is unavailable. Please try again later or check your network connection.");
          }
          throw apiError;
        }
      }

      const response = await supabase.functions.invoke('upload-emotion', {
        body: {
          emotion: selectedEmotion,
          intensity: intensityValue,
          description: sanitizedDescription,
          encryptedData: encryptedString,
          isPublic,
          network: currentNetwork, // 传递当前选择的网络
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Upload failed');
      }

      const result = response.data;
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadStatus("success");
      
      toast({
        title: t("record.success.recorded"),
        description: t("record.success.recordedWalrus", { blobId: result.record.blobId.slice(0, 8) }),
      });

      // Navigate to timeline
      setTimeout(navigateToTimeline, 1500);
    } catch (error) {
      console.error("[INTERNAL] Error recording emotion:", error);
      
      // Show user-friendly error messages
      let errorMessage = t("record.errors.tryAgain");
      let errorTitle = t("record.errors.recordFailed");
      
      if (error instanceof Error) {
        const msg = error.message;
        
        // Check if it's a validation error
        if (msg === "INVALID_RECORD_DATA" || 
            (error as any)?.errorCode === "INVALID_RECORD_DATA") {
          errorTitle = t("record.errors.missingInfo");
          errorMessage = t("record.errors.missingInfoDesc");
        } else if (msg === "EMPTY_RECORD_NOTE" || 
                   (error as any)?.errorCode === "EMPTY_RECORD_NOTE") {
          errorTitle = t("record.errors.missingInfo");
          errorMessage = t("record.errors.missingInfoDesc");
        } else if (msg.includes("Invalid") || 
            msg.includes("must be") ||
            msg.includes("cannot be") ||
            msg.includes("contains potentially unsafe")) {
          errorMessage = msg;
        } 
        // Check for Walrus service errors
        else if (msg.includes("Walrus service endpoint not found") ||
                 msg.includes("Walrus service error")) {
          errorTitle = t("record.errors.serviceUnavailable");
          errorMessage = t("record.errors.serviceUnavailableDesc");
        } 
        // Check for network errors
        else if (msg.includes("Network error") ||
                 msg.includes("connection") ||
                 msg.includes("Failed to connect")) {
          errorTitle = t("record.errors.networkError");
          errorMessage = t("record.errors.networkErrorDesc");
        } 
        // Check for storage/upload errors
        else if (msg.includes("Storage") ||
                 msg.includes("upload") ||
                 msg.includes("Walrus upload failed")) {
          errorTitle = t("record.errors.uploadFailed");
          errorMessage = t("record.errors.uploadFailedDesc");
        } 
        // Check for encryption/decryption errors
        else if (msg.includes("encrypt") ||
                 msg.includes("decrypt") ||
                 msg === "SAVE_BLOCKED_DECRYPTION_ERROR" ||
                 (error as any).isDecryptionError) {
          // Special handling for decryption errors that block saving
          if ((error as any).isDecryptionError && (error as any).canForceClear) {
            errorTitle = t("timeline.localStorage.saveBlockedTitle");
            errorMessage = `${t("timeline.localStorage.saveBlockedDesc")}\n\n${t("timeline.localStorage.saveBlockedSolution1")}\n${t("timeline.localStorage.saveBlockedSolution2")}\n\n${t("timeline.localStorage.saveBlockedNote")}`;
          } else {
            errorTitle = t("record.errors.encryptionError");
            errorMessage = t("record.errors.encryptionErrorDesc");
          }
        }
        // Check for data size errors
        else if (msg.includes("Data too large") ||
                 msg.includes("Maximum size")) {
          errorTitle = t("record.errors.dataTooLarge");
          errorMessage = t("record.errors.dataTooLargeDesc");
        }
        // Check for storage quota exceeded errors
        else if (msg === "STORAGE_QUOTA_EXCEEDED" ||
                 (error as any)?.errorCode === "STORAGE_QUOTA_EXCEEDED" ||
                 msg.includes("QuotaExceeded") ||
                 msg.includes("空間不足")) {
          errorTitle = t("record.errors.storageQuotaExceeded");
          errorMessage = t("record.errors.storageQuotaExceededDesc");
        }
        // Check for local storage save errors
        else if (msg.includes("保存到本地儲存失敗") || 
                 msg.includes("Failed to save to local")) {
          // Extract the underlying error message
          const underlyingError = msg.split("：").pop() || msg.split(":").pop() || msg;
          errorTitle = t("record.errors.uploadFailed");
          errorMessage = underlyingError;
        }
        // Use the error message directly if it's already user-friendly
        else if (msg.length > 0 && msg.length < 200) {
          errorMessage = msg;
        }
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      setUploadStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.back")}
        </Button>
          <GlobalControls />
        </div>

        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion shadow-md mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">{t("record.title")}</h1>
            <p className="text-muted-foreground">
              {t("record.subtitle")}
            </p>
          </div>

          <div className="space-y-6">
            {/* Emotion Tag Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t("record.howAreYouFeelingRequired")}
              </Label>
              {!selectedEmotion && (
                <p className="text-sm text-muted-foreground italic">
                  {t("record.selectEmotionFirst")}
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {emotionTags.map((emotion) => (
                  <button
                    key={emotion.value}
                    onClick={() => setSelectedEmotion(emotion.value)}
                    className={`
                      p-3 md:p-4 rounded-xl border-2 transition-all duration-300 min-h-[80px] md:min-h-[100px]
                      active:scale-[0.98] touch-manipulation
                      ${
                        selectedEmotion === emotion.value
                          ? "border-primary bg-primary/10 scale-[1.02] shadow-sm"
                          : !selectedEmotion
                          ? "border-border/50 hover:border-primary/30 bg-card"
                          : "border-border hover:border-primary/30 bg-card"
                      }
                    `}
                    aria-label={emotion.label}
                    aria-pressed={selectedEmotion === emotion.value}
                  >
                    <div className="text-xl md:text-2xl mb-1">{emotion.label.split(" ")[0]}</div>
                    <div className="text-xs md:text-sm font-medium">{emotion.label.split(" ")[1]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity Slider */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t("record.intensityValue", { value: intensity[0] })}
              </Label>
              <Slider
                value={intensity}
                onValueChange={setIntensity}
                max={100}
                step={1}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("record.subtle")}</span>
                <span>{t("record.moderate")}</span>
                <span>{t("record.intense")}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <Label htmlFor="description" className="text-base font-semibold">
                {t("record.whatHappenedRequired")}
              </Label>
              {!description.trim() && (
                <p className="text-sm text-muted-foreground italic">
                  {t("record.addDescriptionFirst")}
                </p>
              )}
              <Textarea
                id="description"
                placeholder={t("record.descriptionPlaceholder")}
                value={description}
                onChange={(e) => {
                  // Limit input length client-side
                  const value = e.target.value;
                  if (value.length <= 5000) {
                    setDescription(value);
                  }
                }}
                maxLength={5000}
                className={`glass-input min-h-[120px] md:min-h-[150px] resize-none ${
                  !description.trim() ? "border-destructive/50 focus:border-destructive" : ""
                }`}
                aria-invalid={!description.trim()}
                aria-describedby="description-hint description-count"
              />
              <div className="flex justify-between items-center">
                <p id="description-hint" className="text-xs text-muted-foreground">
                  {t("record.descriptionHint")}
                </p>
                <p 
                  id="description-count" 
                  className={`text-xs ${
                    description.length > 4500 
                      ? "text-destructive" 
                      : description.length > 4000 
                      ? "text-yellow-600 dark:text-yellow-400" 
                      : "text-muted-foreground"
                  }`}
                  aria-live="polite"
                >
                  {t("record.characters", { count: description.length })} / 5000
                </p>
              </div>

              {/* AI Response Button */}
              <Button
                type="button"
                variant="outline"
                onClick={getAiResponse}
                disabled={isAiLoading || !selectedEmotion || !description.trim()}
                className="w-full mt-2"
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("record.aiThinking")}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("record.getAiResponse")}
                  </>
                )}
              </Button>

              {/* AI Response Display */}
              <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 animate-in fade-in-50 slide-in-from-bottom-2">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary mb-2">{t("record.aiResponse")}</p>
                    {aiResponse ? (
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {aiResponse}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {t("record.getAiResponse")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t("record.tags") || "標籤/分類"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("record.tagsDesc") || "為記錄添加標籤以便分類和查找（可選）"}
              </p>
              <TagInput
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                placeholder={t("record.tagsPlaceholder") || "輸入標籤並按 Enter..."}
                maxTags={10}
              />
            </div>

            {/* Privacy Control */}
            <Card className="p-4 border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {isPublic ? (
                      <Unlock className="h-5 w-5 text-primary" />
                    ) : (
                      <Lock className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="privacy" className="text-sm font-semibold cursor-pointer">
                      {isPublic ? t("record.privacy.public") : t("record.privacy.private")}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPublic 
                        ? t("record.privacy.publicDesc")
                        : t("record.privacy.privateDesc")}
                    </p>
                  </div>
                </div>
                <Switch
                  id="privacy"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
            </Card>

            {/* Database Backup Option - Available for all users */}
            <Card className="p-4 border-border/50 bg-card/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="backup" className="text-sm font-semibold cursor-pointer">
                      {backupToDatabase ? t("record.backup.title") : t("record.backup.titleDisabled")}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {backupToDatabase 
                        ? t("record.backup.description")
                        : t("record.backup.descriptionDisabled")}
                    </p>
                    {backupToDatabase && !currentAccount && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        {t("record.backup.anonymousWarning")}
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  id="backup"
                  checked={backupToDatabase}
                  onCheckedChange={setBackupToDatabase}
                />
              </div>
            </Card>

            {/* Storage Option */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t("record.storage.title")}
              </Label>
              <div className="space-y-3">
                <Button
                  type="button"
                  variant={saveLocally ? "default" : "outline"}
                  onClick={() => setSaveLocally(true)}
                  className={`
                    w-full h-auto py-4 px-4 flex flex-col items-start gap-2
                    ${saveLocally 
                      ? "gradient-emotion border-primary" 
                      : "border-border hover:border-primary/50"}
                  `}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-lg">💾</span>
                    <span className="font-semibold">{t("record.storage.local")}</span>
                  </div>
                  <p className="text-xs text-left opacity-80 whitespace-normal break-words">
                    {t("record.storage.localOnly")}
                  </p>
                </Button>
                <Button
                  type="button"
                  variant={!saveLocally ? "default" : "outline"}
                  onClick={() => setSaveLocally(false)}
                  className={`
                    w-full h-auto py-4 px-4 flex flex-col items-start gap-2
                    ${!saveLocally 
                      ? "gradient-cool border-secondary" 
                      : "border-border hover:border-secondary/50"}
                  `}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-lg">☁️</span>
                    <span className="font-semibold">{t("record.storage.walrus")}</span>
                  </div>
                  <p className="text-xs text-left opacity-80 whitespace-normal break-words">
                    {t("record.storage.walrusOnly")}
                    </p>
                </Button>
                {!saveLocally && (
                  <>
                    <Card className="p-3 bg-blue-500/10 border-blue-500/20">
                      <p className="text-xs text-center text-blue-600 dark:text-blue-400">
                        {t("record.storage.walrusHint")}
                      </p>
                    </Card>
                    {/* Epoch Selection */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">
                        {t("record.storage.epoch")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t("record.storage.epochDesc")}
                      </p>
                      <Slider
                        value={epochs}
                        onValueChange={setEpochs}
                        min={1}
                        max={1000}
                        step={1}
                        className="py-4"
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                          {t("record.storage.epochValue", { 
                            value: epochs[0], 
                            days: Math.round(epochs[0]) 
                          })}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEpochs([5])}
                            className="h-7 text-xs"
                          >
                            5
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEpochs([200])}
                            className="h-7 text-xs"
                          >
                            200
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEpochs([365])}
                            className="h-7 text-xs"
                          >
                            365
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* NFT Minting Option */}
                    {currentAccount && (
                      <Card className="p-4 border-border/50 bg-card/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                              <Sparkles className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor="mintNFT" className="text-sm font-semibold cursor-pointer">
                                {mintAsNFT ? (t("record.nft.mint") || "鑄造為 NFT") : (t("record.nft.mintDisabled") || "不鑄造 NFT")}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {mintAsNFT 
                                  ? (t("record.nft.mintDesc") || "將此記錄鑄造為 Sui 鏈上 NFT，永久保存")
                                  : (t("record.nft.mintDisabledDesc") || "僅保存到 Walrus，不鑄造 NFT")}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id="mintNFT"
                            checked={mintAsNFT}
                            onCheckedChange={setMintAsNFT}
                          />
                        </div>
                      </Card>
                    )}
                  </>
                )}
                  </div>
                </div>

            {/* Wallet Connect Section */}
            {!saveLocally && (
              <div className="space-y-3">
                {!currentAccount && (
                  <Card className="p-3 bg-orange-500/10 border-orange-500/20">
                    <p className="text-sm text-center text-orange-600 dark:text-orange-400 mb-3">
                      {t("record.storage.walletRequired")}
                    </p>
                  </Card>
                )}
                <WalletConnect />
              </div>
            )}

            {/* Upload Status */}
            {uploadStatus !== "idle" && uploadStatus !== "success" && (
              <Card className="p-3 bg-secondary/10 border-secondary/20">
                <div className="flex items-center gap-2 text-sm">
                  {uploadStatus === "encrypting" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("record.status.encrypting")}</span>
                    </>
                  )}
                  {uploadStatus === "uploading" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{saveLocally ? t("record.status.uploadingWithFallback") : t("record.status.uploading")}</span>
                    </>
                  )}
                  {uploadStatus === "saving" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("record.status.saving")}</span>
                    </>
                  )}
                  {uploadStatus === "error" && (
                    <span className="text-destructive">{t("record.status.error")}</span>
                  )}
                </div>
              </Card>
            )}

            {/* Required Fields Hint */}
            {(!selectedEmotion || !description.trim()) && (
              <Card className="p-3 bg-yellow-500/10 border-yellow-500/20">
                <p className="text-sm text-center text-yellow-600 dark:text-yellow-400">
                  {t("record.requiredFieldsHint")}
                </p>
              </Card>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedEmotion || !description.trim()}
              className="w-full h-12 md:h-14 text-base font-semibold gradient-emotion hover:opacity-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              size="lg"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("common.processing")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {saveLocally 
                    ? t("record.submit.local")
                    : (currentAccount ? t("record.submit.nft") : t("record.submit.walrus"))
                  }
                </>
              )}
            </Button>

            <Card className="p-4 bg-secondary/10 border-secondary/20">
              <p className="text-xs text-center text-muted-foreground">
                {saveLocally ? (
                  t("record.hint.local")
                ) : (
                  t("record.hint.walrus")
                )}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// 使用 React.memo 优化性能
export default React.memo(Record);
