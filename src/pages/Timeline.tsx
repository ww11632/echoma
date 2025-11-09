import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Lock, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface EmotionSnapshot {
  id: string;
  emotion: string;
  intensity: number;
  timestamp: string;
  moodTag: string;
  walrusUri?: string;
  verified: boolean;
}

// Mock data - replace with actual Sui chain queries
const mockSnapshots: EmotionSnapshot[] = [
  {
    id: "1",
    emotion: "joy",
    intensity: 85,
    timestamp: new Date().toISOString(),
    moodTag: "😊 Joy",
    verified: true,
  },
  {
    id: "2",
    emotion: "peace",
    intensity: 70,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    moodTag: "✨ Peace",
    verified: true,
  },
];

const Timeline = () => {
  const navigate = useNavigate();
  const [snapshots] = useState<EmotionSnapshot[]>(mockSnapshots);

  const emotionColors: Record<string, string> = {
    joy: "from-yellow-400 to-orange-400",
    sadness: "from-blue-400 to-indigo-400",
    anger: "from-red-400 to-rose-400",
    anxiety: "from-purple-400 to-pink-400",
    confusion: "from-gray-400 to-slate-400",
    peace: "from-green-400 to-teal-400",
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Button
            onClick={() => navigate("/record")}
            className="gradient-emotion hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Record
          </Button>
        </div>

        <div className="glass-card rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2 pb-6 border-b border-border">
            <h1 className="text-3xl font-bold">Your Emotion Timeline</h1>
            <p className="text-muted-foreground">
              Each glass sphere represents a verified emotion snapshot on Sui
            </p>
          </div>

          {snapshots.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/30 mb-4">
                <Lock className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">No Emotions Recorded Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Start your emotion journey by recording your first snapshot
              </p>
              <Button
                onClick={() => navigate("/record")}
                className="gradient-emotion hover:opacity-90 mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Record First Emotion
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {snapshots.map((snapshot, index) => (
                <Card
                  key={snapshot.id}
                  className="glass-card p-6 hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  onClick={() => {
                    // TODO: Navigate to detail page or open modal
                  }}
                >
                  <div className="flex items-start gap-6">
                    {/* Glass Sphere Visualization */}
                    <div className="relative">
                      <div
                        className={`
                          w-20 h-20 rounded-full bg-gradient-to-br ${emotionColors[snapshot.emotion]}
                          animate-float glow-primary
                          flex items-center justify-center text-3xl
                          group-hover:scale-110 transition-transform duration-300
                        `}
                        style={{
                          animationDelay: `${index * 0.2}s`,
                        }}
                      >
                        {snapshot.moodTag.split(" ")[0]}
                      </div>
                      {snapshot.verified && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-secondary rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Snapshot Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold">{snapshot.moodTag}</h3>
                        <span className="text-sm text-muted-foreground">
                          {new Date(snapshot.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Intensity: {snapshot.intensity}%</span>
                        {snapshot.verified && (
                          <span className="flex items-center gap-1 text-secondary">
                            <CheckCircle className="w-3 h-3" />
                            Verified on Sui
                          </span>
                        )}
                      </div>

                      {snapshot.walrusUri && (
                        <div className="flex items-center gap-2 text-xs">
                          <Lock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground font-mono truncate max-w-xs">
                            {snapshot.walrusUri}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Info Card */}
        <Card className="mt-6 p-6 bg-primary/5 border-primary/20">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Privacy & Verification
            </h3>
            <p className="text-sm text-muted-foreground">
              Your emotion details are encrypted client-side and stored on Walrus. Only metadata
              and verification hashes exist on Sui blockchain. You control the decryption keys.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Timeline;
