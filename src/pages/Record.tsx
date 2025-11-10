import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sparkles, ArrowLeft, Loader2, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { encryptData, generateUserKey } from "@/lib/encryption";
import { prepareEmotionSnapshot } from "@/lib/walrus";
import { validateAndSanitizeDescription, emotionSnapshotSchema } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { addEmotionRecord } from "@/lib/localIndex";
import type { EmotionRecord } from "@/lib/dataSchema";
import { postEmotion } from "@/lib/api";

const emotionTags = [
  { label: "😊 Joy", value: "joy", color: "from-yellow-400 to-orange-400" },
  { label: "😢 Sadness", value: "sadness", color: "from-blue-400 to-indigo-400" },
  { label: "😠 Anger", value: "anger", color: "from-red-400 to-rose-400" },
  { label: "😰 Anxiety", value: "anxiety", color: "from-purple-400 to-pink-400" },
  { label: "🤔 Confusion", value: "confusion", color: "from-gray-400 to-slate-400" },
  { label: "✨ Peace", value: "peace", color: "from-green-400 to-teal-400" },
];

const Record = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const currentAccount = useCurrentAccount();
  const [selectedEmotion, setSelectedEmotion] = useState<string>("");
  const [intensity, setIntensity] = useState([50]);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "encrypting" | "uploading" | "saving" | "success" | "error">("idle");

  const handleSubmit = async () => {
    if (!selectedEmotion || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an emotion and add a description.",
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
        const apiRes = await postEmotion({
          emotion: selectedEmotion,
          intensity: intensityValue,
          description: sanitizedDescription,
          encryptedData: encryptedString,
          isPublic,
          walletAddress: null,
        });
        setUploadStatus("success");
        toast({
          title: "情緒已記錄！✨",
          description: `已儲存至 Walrus: ${apiRes.record.blobId.slice(0, 8)}...`,
        });
        setTimeout(() => navigate("/timeline"), 1200);
        return;
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

      // Step 5: Upload to backend API
      setUploadStatus("uploading");
      toast({
        title: "上傳中...",
        description: "正在加密並儲存您的情緒快照",
      });

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // 沒有 Supabase session：走自建 API（後端存 Walrus + 本地檔案）作為主線
        const apiRes = await postEmotion({
          emotion: selectedEmotion,
          intensity: intensityValue,
          description: sanitizedDescription,
          encryptedData: encryptedString,
          isPublic,
          walletAddress: currentAccount.address,
        });
        setUploadStatus("success");
        toast({
          title: "情緒已記錄！✨",
          description: `已儲存至 Walrus: ${apiRes.record.blobId.slice(0, 8)}...`,
        });
        setTimeout(() => navigate("/timeline"), 1200);
        return;
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
        title: "情緒已記錄！✨",
        description: `已儲存至 Walrus: ${result.record.blobId.slice(0, 8)}...`,
      });

      // Navigate to timeline
      setTimeout(() => navigate("/timeline"), 1500);
    } catch (error) {
      console.error("[INTERNAL] Error recording emotion:", error);
      
      // Show user-friendly error messages
      let errorMessage = "Please try again.";
      if (error instanceof Error) {
        // Check if it's a validation error
        if (error.message.includes("Invalid") || 
            error.message.includes("must be") ||
            error.message.includes("cannot be") ||
            error.message.includes("contains potentially unsafe")) {
          errorMessage = error.message;
        } else if (error.message.includes("Network error") ||
                   error.message.includes("connection")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes("Storage") ||
                   error.message.includes("upload") ||
                   error.message.includes("Walrus")) {
          errorMessage = "Failed to save your emotion. Please try again.";
        } else if (error.message.includes("encrypt") ||
                   error.message.includes("decrypt")) {
          errorMessage = "Encryption error. Please try again.";
        }
      }

      toast({
        title: "記錄失敗",
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
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion glow-primary mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Record Your Emotion</h1>
            <p className="text-muted-foreground">
              Capture this moment, encrypted and verified on-chain
            </p>
          </div>

          <div className="space-y-6">
            {/* Emotion Tag Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">How are you feeling?</Label>
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
                Intensity: {intensity[0]}%
              </Label>
              <Slider
                value={intensity}
                onValueChange={setIntensity}
                max={100}
                step={1}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtle</span>
                <span>Moderate</span>
                <span>Intense</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <Label htmlFor="description" className="text-base font-semibold">
                發生了什麼事？
              </Label>
              <Textarea
                id="description"
                placeholder="描述觸發這個情緒的事件...（將被加密）"
                value={description}
                onChange={(e) => {
                  // Limit input length client-side
                  const value = e.target.value;
                  if (value.length <= 5000) {
                    setDescription(value);
                  }
                }}
                maxLength={5000}
                className="glass-input min-h-[150px] resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  🔒 您的描述在儲存前會在客戶端加密
                </p>
                <p className="text-xs text-muted-foreground">
                  {description.length}/5000 字元
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
                      {isPublic ? "公開分享" : "私人記錄"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isPublic 
                        ? "任何人都可以看到 blob_id 和驗證狀態" 
                        : "🔒 已加密保存（需授權存取）"}
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

            {/* Upload Status */}
            {uploadStatus !== "idle" && uploadStatus !== "success" && (
              <Card className="p-3 bg-secondary/10 border-secondary/20">
                <div className="flex items-center gap-2 text-sm">
                  {uploadStatus === "encrypting" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>正在加密...</span>
                    </>
                  )}
                  {uploadStatus === "uploading" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>上傳至 Walrus...</span>
                    </>
                  )}
                  {uploadStatus === "saving" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>儲存記錄...</span>
                    </>
                  )}
                  {uploadStatus === "error" && (
                    <span className="text-destructive">❌ 上傳失敗</span>
                  )}
                </div>
              </Card>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-12 text-base font-semibold gradient-emotion hover:opacity-90 disabled:opacity-50"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {currentAccount ? "記錄情緒並鑄造 NFT" : "記錄情緒（上傳 Walrus）"}
                </>
              )}
            </Button>

            <Card className="p-4 bg-secondary/10 border-secondary/20">
              <p className="text-xs text-center text-muted-foreground">
                💡 您的情緒快照將被加密並儲存在 Walrus 上，同時在 Sui 上鑄造 NFT 作為證明
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Record;
