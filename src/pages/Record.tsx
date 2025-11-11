import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sparkles, ArrowLeft, Loader2, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentAccount, useCurrentWallet } from "@mysten/dapp-kit";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { encryptData, generateUserKey } from "@/lib/encryption";
import { prepareEmotionSnapshot, uploadToWalrusWithSDK, createSignerFromWallet } from "@/lib/walrus";
import { validateAndSanitizeDescription, emotionSnapshotSchema } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { addEmotionRecord } from "@/lib/localIndex";
import type { EmotionRecord } from "@/lib/dataSchema";
import { postEmotion } from "@/lib/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import WalletConnect from "@/components/WalletConnect";

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
  const { t } = useTranslation();
  const currentAccount = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();

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
  const [isPublic, setIsPublic] = useState(false);
  const [saveLocally, setSaveLocally] = useState(true); // 默认保存到本地
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "encrypting" | "uploading" | "saving" | "success" | "error">("idle");

  const saveToLocalIndex = async (
    sanitizedDescription: string,
    emotionValue: string,
    isPublicValue: boolean
  ) => {
    const mvpEmotion =
      emotionValue === "joy"
        ? "joy"
        : emotionValue === "sadness"
        ? "sadness"
        : emotionValue === "anger"
        ? "anger"
        : "joy";

    const localRecord: EmotionRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      emotion: mvpEmotion as "joy" | "sadness" | "anger",
      note: sanitizedDescription,
      proof: null,
      version: "1.0.0",
      isPublic: isPublicValue,
    };

    await addEmotionRecord(localRecord);
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
          await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic);
          setUploadStatus("success");
          
          toast({
            title: t("record.success.recordedLocal"),
            description: t("record.success.recordedLocalDesc"),
            variant: "default",
          });
          setTimeout(() => navigate("/timeline"), 1200);
          return;
        }
        
        // 建立匿名 payload（不含錢包位址）
        const anonPayload = {
          emotion: selectedEmotion,
          intensity: intensityValue,
          description: sanitizedDescription,
          timestamp: Date.now(),
          walletAddress: null,
          version: "1.0.0",
        };
        // 使用隨機 key 加密
        const randomKey = crypto.randomUUID();
        const encrypted = await encryptData(JSON.stringify(anonPayload), randomKey);
        const encryptedString = JSON.stringify(encrypted);
        setUploadStatus("uploading");
        
        try {
          const apiRes = await postEmotion({
            emotion: selectedEmotion,
            intensity: intensityValue,
            description: sanitizedDescription,
            encryptedData: encryptedString,
            isPublic,
            walletAddress: null,
          });
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
          setTimeout(() => navigate("/timeline"), 1200);
          return;
        } catch (apiError) {
          // Only fallback to local if backend is unavailable (not if user explicitly chose not to save locally)
          if (isBackendUnavailable(apiError)) {
            console.log("[Client] API failed, saving to local storage as fallback");
            setUploadStatus("saving");
            await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic);
            setUploadStatus("success");
            
            toast({
              title: t("record.success.recordedLocal"),
              description: t("record.success.recordedLocalDesc"),
              variant: "default",
            });
            setTimeout(() => navigate("/timeline"), 1200);
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

      // Step 3: Generate secure encryption key
      const userKey = await generateUserKey(currentAccount.address);
      
      // Step 4: Encrypt snapshot
      const encryptedData = await encryptData(JSON.stringify(snapshot), userKey);
      const encryptedString = JSON.stringify(encryptedData);

      // Step 5: Check if user wants to save locally only
      if (saveLocally) {
        // User chose to save locally only - skip Walrus upload
        console.log("[Record] User chose to save locally only, skipping Walrus upload");
        setUploadStatus("saving");
        await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic);
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

      // Try SDK method first if wallet is connected (this will trigger transaction popup)
      if (currentWallet && currentAccount) {
        try {
          console.log("[Record] Attempting SDK upload with wallet - THIS WILL TRIGGER TRANSACTION POPUP");
          
          const suiClient = new SuiClient({
            url: getFullnodeUrl("testnet"),
          });
          
          const signer = createSignerFromWallet(currentWallet, currentAccount.address, suiClient);
          const sdkResult = await uploadToWalrusWithSDK(encryptedString, signer, 5);
          
          console.log("[Record] ✅ SDK upload successful:", sdkResult);
          
          setUploadStatus("success");
          toast({
            title: t("record.success.recorded"),
            description: t("record.success.recordedSDK", { blobId: sdkResult.blobId.slice(0, 8) }),
          });
          
          // Try to save metadata to backend (optional)
          try {
            await postEmotion({
              emotion: selectedEmotion,
              intensity: intensityValue,
              description: sanitizedDescription,
              encryptedData: encryptedString,
              isPublic,
              walletAddress: currentAccount.address,
            });
          } catch (metadataError) {
            console.warn("[Record] Metadata save failed (not critical):", metadataError);
          }
          
          setTimeout(() => navigate("/timeline"), 1200);
          return;
        } catch (sdkError: any) {
          console.warn("[Record] SDK upload failed, falling back to HTTP API:", sdkError);
          
          // Show specific error message for SDK failures
          if (sdkError.message.includes("餘額不足") || sdkError.message.includes("Insufficient balance") || sdkError.message.toLowerCase().includes("insufficient")) {
            toast({
              title: t("record.wallet.insufficientBalance"),
              description: t("record.wallet.insufficientBalanceDesc"),
              variant: "destructive",
            });
          } else if (sdkError.message.includes("簽名失敗") || sdkError.message.includes("Sign failed") || sdkError.message.toLowerCase().includes("sign")) {
            toast({
              title: t("record.wallet.signFailed"),
              description: t("record.wallet.signFailedDesc"),
              variant: "destructive",
            });
          } else if (sdkError.message.includes("交易已取消") || sdkError.message.includes("Transaction cancelled") || sdkError.message.toLowerCase().includes("cancelled")) {
            toast({
              title: t("record.wallet.transactionCancelled"),
              description: t("record.wallet.transactionCancelledDesc"),
              variant: "default",
            });
            setIsSubmitting(false);
            return;
          }
          // Continue to HTTP API fallback below
        }
      }

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // 沒有 Supabase session：走自建 API（後端存 Walrus + 本地檔案）作為主線
        try {
          const apiRes = await postEmotion({
            emotion: selectedEmotion,
            intensity: intensityValue,
            description: sanitizedDescription,
            encryptedData: encryptedString,
            isPublic,
            walletAddress: currentAccount.address,
          });
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
          setTimeout(() => navigate("/timeline"), 1200);
          return;
        } catch (apiError) {
          const canFallback = saveLocally || isBackendUnavailable(apiError);
          if (canFallback) {
            console.log("[Client] API failed, saving to local storage as fallback");
            setUploadStatus("saving");
            await saveToLocalIndex(sanitizedDescription, selectedEmotion, isPublic);
            setUploadStatus("success");
            
            toast({
              title: t("record.success.recordedLocal"),
              description: t("record.success.recordedLocalDesc"),
              variant: "default",
            });
            setTimeout(() => navigate("/timeline"), 1200);
            return;
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
      setTimeout(() => navigate("/timeline"), 1500);
    } catch (error) {
      console.error("[INTERNAL] Error recording emotion:", error);
      
      // Show user-friendly error messages
      let errorMessage = t("record.errors.tryAgain");
      let errorTitle = t("record.errors.recordFailed");
      
      if (error instanceof Error) {
        const msg = error.message;
        
        // Check if it's a validation error
        if (msg.includes("Invalid") || 
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
        // Check for encryption errors
        else if (msg.includes("encrypt") ||
                 msg.includes("decrypt")) {
          errorTitle = t("record.errors.encryptionError");
          errorMessage = t("record.errors.encryptionErrorDesc");
        }
        // Check for data size errors
        else if (msg.includes("Data too large") ||
                 msg.includes("Maximum size")) {
          errorTitle = t("record.errors.dataTooLarge");
          errorMessage = t("record.errors.dataTooLargeDesc");
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
    <div className="min-h-screen p-6">
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
          <LanguageSwitcher />
        </div>

        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion glow-primary mb-4">
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
              <div className="grid grid-cols-2 gap-3">
                {emotionTags.map((emotion) => (
                  <button
                    key={emotion.value}
                    onClick={() => setSelectedEmotion(emotion.value)}
                    className={`
                      p-4 rounded-xl border-2 transition-all duration-300
                      ${
                        selectedEmotion === emotion.value
                          ? "border-primary bg-primary/10 scale-105"
                          : !selectedEmotion
                          ? "border-destructive/50 hover:border-destructive"
                          : "border-border hover:border-primary/50"
                      }
                    `}
                  >
                    <div className="text-2xl mb-1">{emotion.label.split(" ")[0]}</div>
                    <div className="text-sm font-medium">{emotion.label.split(" ")[1]}</div>
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
                className={`glass-input min-h-[150px] resize-none ${
                  !description.trim() ? "border-destructive/50 focus:border-destructive" : ""
                }`}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {t("record.descriptionHint")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("record.characters", { count: description.length })}
                </p>
              </div>
            </div>

            {/* Privacy Control */}
            <Card className="p-4 border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Unlock className="h-5 w-5 text-primary" />
                  ) : (
                    <Lock className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <Label htmlFor="privacy" className="text-sm font-semibold cursor-pointer">
                      {isPublic ? t("record.privacy.public") : t("record.privacy.private")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
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
              className="w-full h-12 text-base font-semibold gradient-emotion hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
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

export default Record;
