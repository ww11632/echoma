import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home, Sparkles, Shield, Clock, Lock, Unlock, Loader2 } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { supabase } from "@/integrations/supabase/client";
import { listEmotionRecords } from "@/lib/localIndex";
import { getEmotions } from "@/lib/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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

const Timeline = () => {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { t, i18n } = useTranslation();

  const emotionLabels = {
    joy: { label: t("emotions.joy"), emoji: "😊", gradient: "from-yellow-400 to-orange-400" },
    sadness: { label: t("emotions.sadness"), emoji: "😢", gradient: "from-blue-400 to-indigo-400" },
    anger: { label: t("emotions.anger"), emoji: "😠", gradient: "from-red-400 to-rose-400" },
    anxiety: { label: t("emotions.anxiety"), emoji: "😰", gradient: "from-purple-400 to-pink-400" },
    confusion: { label: t("emotions.confusion"), emoji: "🤔", gradient: "from-gray-400 to-slate-400" },
    peace: { label: t("emotions.peace"), emoji: "✨", gradient: "from-green-400 to-teal-400" },
  };
  const [records, setRecords] = useState<EmotionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      const allRecords: EmotionRecord[] = [];

      try {
        // 1. 尝试从本地存储加载记录
        try {
          const localRecords = await listEmotionRecords();
          // 转换本地记录格式到 Timeline 格式
          const convertedLocalRecords: EmotionRecord[] = localRecords.map((r) => ({
            id: r.id,
            emotion: r.emotion,
            intensity: 50, // 本地记录没有 intensity，使用默认值
            description: r.note,
            blob_id: `local_${r.id.slice(0, 8)}`,
            walrus_url: `local://${r.id}`,
            payload_hash: "",
            is_public: r.isPublic ?? false, // 使用保存的 isPublic 值，如果不存在则默认为 false
            proof_status: "pending" as const,
            sui_ref: null,
            created_at: r.timestamp,
          }));
          allRecords.push(...convertedLocalRecords);
        } catch (localError) {
          console.log("[Timeline] No local records or error loading:", localError);
        }

        // 2. 如果有钱包，尝试从 API 加载记录
        if (currentAccount) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              // 尝试从 Supabase 加载
              const response = await supabase.functions.invoke('get-emotions');
              if (!response.error && response.data?.success) {
                allRecords.push(...response.data.records);
              }
            } else {
              // 没有 Supabase session，尝试从本地 API 加载
              try {
                const apiRecords = await getEmotions();
                const convertedApiRecords: EmotionRecord[] = apiRecords.map((r: any) => ({
                  id: r.id,
                  emotion: r.emotion,
                  intensity: r.intensity,
                  description: r.description,
                  blob_id: r.blob_id || `local_${r.id.slice(0, 8)}`,
                  walrus_url: r.walrus_url || `local://${r.id}`,
                  payload_hash: r.payload_hash || "",
                  is_public: r.is_public || false,
                  proof_status: r.proof_status || "pending",
                  sui_ref: r.sui_ref || null,
                  created_at: r.created_at || r.timestamp,
                }));
                allRecords.push(...convertedApiRecords);
              } catch (apiError) {
                console.log("[Timeline] API error (expected if server not running):", apiError);
              }
            }
          } catch (supabaseError) {
            console.log("[Timeline] Supabase error:", supabaseError);
          }
        }

        // 3. 去重并排序（按时间倒序）
        const uniqueRecords = Array.from(
          new Map(allRecords.map(r => [r.id, r])).values()
        ).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setRecords(uniqueRecords);
      } catch (error) {
        console.error("Error loading records:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecords();
  }, [currentAccount]);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
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

        <div className="glass-card rounded-2xl p-8">
          <div className="text-center space-y-2 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion glow-primary mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">{t("timeline.title")}</h1>
            <p className="text-muted-foreground">{t("timeline.subtitle")}</p>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">{t("common.loading")}</p>
            </div>
          ) : records.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">{t("timeline.noRecords")}</h3>
              <p className="text-muted-foreground mb-4">{t("timeline.noRecordsDesc")}</p>
              <Button onClick={() => navigate("/record")} className="gradient-emotion">{t("timeline.recordFirst")}</Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {records.map((record) => {
                // 处理 emotion 类型映射
                const emotionKey = record.emotion as keyof typeof emotionLabels;
                const emotionConfig = emotionLabels[emotionKey] || {
                  label: record.emotion.charAt(0).toUpperCase() + record.emotion.slice(1),
                  emoji: "😊",
                  gradient: "from-gray-400 to-slate-400"
                };
                return (
                  <Card key={record.id} className="p-6 hover:border-primary/50 transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br ${emotionConfig.gradient} glow-primary flex-shrink-0`}>
                        <span className="text-2xl">{emotionConfig.emoji}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{emotionConfig.label}</h3>
                            <p className="text-sm text-muted-foreground">{t("timeline.intensityValue", { value: record.intensity })}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(record.created_at).toLocaleDateString(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US')}</span>
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
                        {/* 只顯示公開記錄的描述內容 */}
                        {record.is_public && record.description && (
                          <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {record.description}
                            </p>
                          </div>
                        )}
                        {!record.is_public && (
                          <div className="mb-3 p-3 rounded-lg bg-muted/10 border border-border/30">
                            <p className="text-sm text-muted-foreground italic">
                              {t("timeline.encryptedContent")}
                            </p>
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
                            {record.sui_ref && <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">{t("timeline.onChain")}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
