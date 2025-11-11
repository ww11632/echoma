import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home, Sparkles, Shield, Clock, Lock, Unlock, Loader2, BookOpen, BarChart3, Filter } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { supabase } from "@/integrations/supabase/client";
import { listEmotionRecords } from "@/lib/localIndex";
import { getEmotions } from "@/lib/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";

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

        // 2. 如果有钱包，尝试从 API 加载记录
        if (currentAccount) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const response = await supabase.functions.invoke('get-emotions');
              if (!response.error && response.data?.success) {
                allRecords.push(...response.data.records);
              }
            } else {
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

  // 判断记录是否为本地存储
  const isLocalRecord = (record: EmotionRecord) => {
    return record.blob_id.startsWith("local_") || record.walrus_url.startsWith("local://");
  };

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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion glow-primary mb-4">
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
          ) : filteredRecords.length === 0 ? (
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
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br ${emotionConfig.gradient} glow-primary flex-shrink-0`}>
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
