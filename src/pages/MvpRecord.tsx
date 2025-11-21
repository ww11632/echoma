import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { EMOTION_OPTIONS, type EmotionType, type EmotionRecord } from "@/lib/dataSchema";
import { addEmotionRecord } from "@/lib/localIndex";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ArrowLeft } from "lucide-react";
import { PasswordSetupDialog } from "@/components/PasswordSetupDialog";
import { hasPasswordSetup, passwordCache, getPasswordContext } from "@/lib/userPassword";

const MvpRecord = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [emotion, setEmotion] = useState<EmotionType | "">("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);

  // Check if password setup is needed on mount
  useEffect(() => {
    const setupComplete = hasPasswordSetup();
    const context = getPasswordContext(null, null); // anonymous context for MVP mode
    const cachedPassword = passwordCache.get(context);
    
    // Show password setup dialog if not completed and no cached password
    if (!setupComplete && !cachedPassword) {
      setShowPasswordSetup(true);
    }
  }, []);

  const handleSave = async () => {
    if (!emotion || !note.trim()) {
      toast({
        title: "缺少資訊",
        description: "請選擇一個情緒並輸入備註。",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const record: EmotionRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        emotion,
        note: note.trim(),
        proof: null,
        version: "1.0.0",
      };
      await addEmotionRecord(record);
      toast({
        title: "已儲存",
        description: "情緒紀錄已保存（本機）。",
      });
      navigate("/mvp-timeline");
    } catch (e) {
      toast({
        title: "儲存失敗",
        description: "請稍後再試。",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSetupComplete = (password: string) => {
    setShowPasswordSetup(false);
    toast({
      title: "密碼設置完成",
      description: "您的加密密碼已設置成功，數據將被安全加密。",
    });
  };

  const handlePasswordSetupSkip = () => {
    setShowPasswordSetup(false);
    toast({
      title: "已跳過密碼設置",
      description: "您可以稍後在設置中配置密碼。",
      variant: "default",
    });
  };

  return (
    <div className="min-h-screen p-6">
      <PasswordSetupDialog
        open={showPasswordSetup}
        onComplete={handlePasswordSetupComplete}
        onSkip={handlePasswordSetupSkip}
      />
      
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>

        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion shadow-md mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">MVP 情緒記錄（本機）</h1>
            <p className="text-muted-foreground">選擇情緒並留下簡短備註</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">你的情緒</Label>
              <div className="grid grid-cols-3 gap-3">
                {EMOTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEmotion(opt.value)}
                    className={`
                      p-3 rounded-xl border-2 transition-all duration-300 text-sm
                      ${emotion === opt.value ? "border-primary bg-primary/10 scale-105" : "border-border hover:border-primary/50"}
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="note" className="text-base font-semibold">
                備註
              </Label>
              <Textarea
                id="note"
                placeholder="寫下一兩句..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={5000}
                className="glass-input min-h-[120px] resize-none"
              />
              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">{note.length}/5000</p>
              </div>
            </div>

            <Card className="p-4 bg-secondary/10 border-secondary/20">
              <p className="text-xs text-center text-muted-foreground">
                此版本僅將資料儲存在本機，可離線瀏覽。未使用登入或上鏈。
              </p>
            </Card>

            <Button
              onClick={handleSave}
              disabled={isSaving || !emotion || !note.trim()}
              className="w-full h-12 text-base font-semibold gradient-emotion hover:opacity-90 disabled:opacity-50"
              size="lg"
            >
              {isSaving ? "儲存中..." : "儲存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MvpRecord;


