import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sparkles, ArrowLeft, Loader2, Lock, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateAndSanitizeDescription } from "@/lib/validation";
import { encryptData, generateUserKeyFromId, PUBLIC_SEAL_KEY } from "@/lib/encryption";
import { prepareEmotionSnapshot } from "@/lib/walrus";
import { emotionSnapshotSchema } from "@/lib/validation";
import GlobalControls from "@/components/GlobalControls";
import type { User, Session } from "@supabase/supabase-js";

const emotionValues = [
  { value: "joy", color: "from-yellow-400 to-orange-400" },
  { value: "sadness", color: "from-blue-400 to-indigo-400" },
  { value: "anger", color: "from-red-400 to-rose-400" },
  { value: "anxiety", color: "from-purple-400 to-pink-400" },
  { value: "confusion", color: "from-gray-400 to-slate-400" },
  { value: "peace", color: "from-green-400 to-teal-400" },
];

const AuthRecord = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string>("");
  const [intensity, setIntensity] = useState([50]);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Track component mount status to prevent navigation after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Safe navigation function that checks mount status
  const navigateToTimeline = () => {
    if (isMountedRef.current) {
      navigate("/auth-timeline");
    }
  };

  useEffect(() => {
    // Check authentication
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: t("authRecord.success.signedOut"),
      description: t("authRecord.success.signedOutDesc"),
    });
    navigate("/");
  };

  const getAiResponse = async () => {
    if (!user) return;

    // 檢查是否有輸入描述
    if (!description.trim()) {
      toast({
        title: t("authRecord.errors.missingDescription"),
        description: t("authRecord.errors.missingDescriptionDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsAiLoading(true);
    setAiResponse("");

    try {
      const { data, error } = await supabase.functions.invoke('ai-emotion-response', {
        body: {
          emotion: selectedEmotion,
          intensity: intensity[0],
          description,
          language: i18n.language.startsWith('zh') ? 'zh-TW' : 'en',
        },
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
      let errorTitle = t("authRecord.errors.aiError");
      let errorDescription = t("authRecord.errors.aiErrorDesc");
      
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
        errorTitle = t("authRecord.errors.aiError");
        errorDescription = error?.error || error?.message || t("authRecord.errors.aiErrorDesc");
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

  const handleSubmit = async () => {
    if (!selectedEmotion || !description.trim()) {
      toast({
        title: t("authRecord.errors.missingInfo"),
        description: t("authRecord.errors.missingInfoDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!session) {
      toast({
        title: t("authRecord.errors.notAuthenticated"),
        description: t("authRecord.errors.notAuthenticatedDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const sanitizedDescription = validateAndSanitizeDescription(description);

      // 使用錢包地址或生成一個匿名地址（Secure Mode 使用 Supabase user ID 作為標識）
      // 注意：AuthRecord 使用 Supabase 認證，但 snapshot 需要 walletAddress
      // 我們使用 user.id 的哈希作為 walletAddress 的替代（格式：0x[64位hex]）
      // 這確保了加密密鑰的一致性
      const userIdHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(user.id)
      );
      const walletAddress = '0x' + Array.from(new Uint8Array(userIdHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // 創建包含 AI 回饋的 snapshot（如果有的話）
      const snapshot = prepareEmotionSnapshot(
        selectedEmotion,
        intensity[0],
        sanitizedDescription,
        walletAddress,
        aiResponse.trim() || undefined // 只有當 AI 回饋存在時才包含
      );

      // 驗證 snapshot
      emotionSnapshotSchema.parse(snapshot);

      // Generate encryption key based on privacy setting
      // Public records: use shared public key (anyone can decrypt)
      // Private records: use user-specific key (only user can decrypt)
      const encryptionKey = isPublic
        ? PUBLIC_SEAL_KEY
        : await generateUserKeyFromId(user.id);

      // Properly encrypt the data using AES-GCM
      const encrypted = await encryptData(JSON.stringify(snapshot), encryptionKey);
      const encryptedData = JSON.stringify(encrypted);

      // Call Supabase edge function to upload using fetch for better error handling
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      
      if (!session.data.session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/upload-emotion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            emotion: selectedEmotion,
            intensity: intensity[0],
            description: sanitizedDescription,
            encryptedData: encryptedData,
            isPublic: isPublic,
          }),
        }
      );

      // Parse response body regardless of status code
      let result;
      try {
        const responseText = await response.text();
        console.log('[AuthRecord] Response status:', response.status);
        console.log('[AuthRecord] Response text:', responseText);
        result = responseText ? JSON.parse(responseText) : null;
        console.log('[AuthRecord] Parsed result:', result);
      } catch (parseError) {
        console.error('[AuthRecord] Parse error:', parseError);
        throw new Error('Invalid response from server');
      }

      // Check if the function returned an error response
      if (!response.ok || !result || !result.success) {
        const errorMessage = result?.error || result?.message || `Server error (${response.status})`;
        console.error('[AuthRecord] Upload failed:', {
          status: response.status,
          result,
          errorMessage,
        });
        throw new Error(errorMessage);
      }

      // Verify we have a valid result
      if (!result.record) {
        throw new Error('Invalid response from server');
      }

      toast({
        title: t("authRecord.success.recorded"),
        description: t("authRecord.success.recordedDesc"),
      });

      // Reset form
      setSelectedEmotion("");
      setIntensity([50]);
      setDescription("");
      setIsPublic(false);
      setAiResponse("");

      // Navigate to timeline
      setTimeout(navigateToTimeline, 1500);
    } catch (error: any) {
      console.error("Upload error:", error);
      
      // Extract error message from various possible formats
      let errorMessage = "Failed to record emotion. Please try again.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Truncate very long error messages to prevent UI issues
      if (errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 200) + "...";
      }
      
      toast({
        title: t("authRecord.errors.uploadFailed"),
        description: errorMessage || t("authRecord.errors.uploadFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <GlobalControls />
      </div>
      
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("authRecord.backToHome")}
          </Button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("authRecord.signOut")}
            </Button>
          </div>
        </div>

        <Card className="glass-card p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion shadow-md animate-float mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">{t("authRecord.title")}</h1>
            <p className="text-muted-foreground">{t("authRecord.subtitle")}</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t("authRecord.howAreYouFeeling")}</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {emotionValues.map((emotion) => (
                  <Button
                    key={emotion.value}
                    variant={selectedEmotion === emotion.value ? "default" : "outline"}
                    className={`h-auto py-4 text-base ${
                      selectedEmotion === emotion.value
                        ? `bg-gradient-to-r ${emotion.color} text-white hover:opacity-90`
                        : "glass-card"
                    }`}
                    onClick={() => setSelectedEmotion(emotion.value)}
                  >
                    {t(`emotions.${emotion.value}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {t("authRecord.intensityValue", { value: intensity[0] })}
              </Label>
              <Slider
                value={intensity}
                onValueChange={setIntensity}
                max={100}
                step={1}
                className="py-4"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="description" className="text-base font-semibold">
                {t("authRecord.describeYourFeelings")}
              </Label>
              <Textarea
                id="description"
                placeholder={t("authRecord.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] glass-card resize-none"
              />
              <p className="text-sm text-muted-foreground">
                {t("authRecord.characters", { count: description.length })}
              </p>

              {/* AI Response Button */}
              <Button
                type="button"
                variant="outline"
                onClick={getAiResponse}
                disabled={isAiLoading || !selectedEmotion}
                className="w-full mt-2"
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("authRecord.aiThinking")}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("authRecord.getAiResponse")}
                  </>
                )}
              </Button>

              {/* AI Response Display - 默认显示 */}
              <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 animate-in fade-in-50 slide-in-from-bottom-2">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary mb-2">{t("authRecord.aiResponse")}</p>
                    {aiResponse ? (
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {aiResponse}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {t("authRecord.getAiResponse")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between glass-card p-4 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">{t("authRecord.makePublic")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("authRecord.makePublicDesc")}
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedEmotion || !description.trim()}
              className="w-full h-14 text-lg font-semibold gradient-emotion shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("authRecord.recording")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {t("authRecord.recordEmotion")}
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AuthRecord;
