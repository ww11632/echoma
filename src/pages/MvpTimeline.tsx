import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listEmotionRecords, clearEmotionRecords } from "@/lib/localIndex";
import type { EmotionRecord } from "@/lib/dataSchema";
import { ArrowLeft, Clock, Sparkles, Trash2 } from "lucide-react";
import MvpGlobalControls from "@/components/MvpGlobalControls";

const MvpTimeline = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [records, setRecords] = useState<EmotionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const list = await listEmotionRecords();
      setRecords(list);
      setLoading(false);
    };
    load();
  }, []);

  const handleClear = async () => {
    await clearEmotionRecords();
    setRecords([]);
  };

  return (
    <div className="min-h-screen p-6">
      {/* Global Controls */}
      <div className="fixed top-4 right-4 z-50">
        <MvpGlobalControls />
      </div>
      
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          {records.length > 0 && (
            <Button variant="destructive" onClick={handleClear} className="gap-2">
              <Trash2 className="h-4 w-4" />
              清空
            </Button>
          )}
        </div>

        <div className="glass-card rounded-2xl p-8">
          <div className="text-center space-y-2 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion shadow-md mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">MVP 本機時間軸</h1>
            <p className="text-muted-foreground">可在重新開啟 app 時看到記錄</p>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
          ) : records.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">目前沒有記錄</h3>
              <p className="text-muted-foreground mb-4">去新增一個吧！</p>
              <Button onClick={() => navigate("/mvp")} className="gradient-emotion">記錄情緒</Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {records.map((r) => (
                <Card key={r.id} className="p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </div>
                      <div className="mt-1 font-semibold">
                        {r.emotion === "joy" ? "😊 Joy" : r.emotion === "sadness" ? "😢 Sadness" : "😠 Anger"}
                      </div>
                      <div className="mt-2 text-sm whitespace-pre-wrap">
                        {r.note}
                      </div>
                    </div>
                    {r.proof && <span className="text-xs text-primary">已產生 proof</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MvpTimeline;


