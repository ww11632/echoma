import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Lock, CheckCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { generateUserKey } from "@/lib/encryption";
import { getEmotionRecordsMetadata } from "@/lib/storage";

interface EmotionSnapshot {
  id: string;
  emotion: string;
  intensity: number;
  timestamp: number;
  moodTag: string;
  walrusUrl?: string;
  blobId?: string;
  payloadHash?: string;
  verified: boolean;
}

const emotionLabels: Record<string, string> = {
  joy: "😊 Joy",
  sadness: "😢 Sadness",
  anger: "😠 Anger",
  anxiety: "😰 Anxiety",
  confusion: "🤔 Confusion",
  peace: "✨ Peace",
};

const Timeline = () => {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const [snapshots, setSnapshots] = useState<EmotionSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const emotionColors: Record<string, string> = {
    joy: "from-yellow-400 to-orange-400",
    sadness: "from-blue-400 to-indigo-400",
    anger: "from-red-400 to-rose-400",
    anxiety: "from-purple-400 to-pink-400",
    confusion: "from-gray-400 to-slate-400",
    peace: "from-green-400 to-teal-400",
  };

  // Load encrypted records from localStorage
  useEffect(() => {
    const loadRecords = async () => {
      if (!currentAccount) {
        setIsLoading(false);
        return;
      }

      try {
        // Generate encryption key (same method as Record.tsx)
        const userKey = await generateUserKey(currentAccount.address);
        
        // Load encrypted metadata
        const records = await getEmotionRecordsMetadata(userKey);
        
        // Transform to snapshot format
        const transformedSnapshots: EmotionSnapshot[] = records.map((record, index) => ({
          id: record.blobId || `record-${index}`,
          emotion: record.emotion,
          intensity: record.intensity,
          timestamp: record.timestamp,
          moodTag: emotionLabels[record.emotion] || record.emotion,
          walrusUrl: record.walrusUrl,
          blobId: record.blobId,
          payloadHash: record.payloadHash,
          verified: true, // TODO: Verify on-chain when Sui integration is complete
        }));

        // Sort by timestamp (newest first)
        transformedSnapshots.sort((a, b) => b.timestamp - a.timestamp);
        
        setSnapshots(transformedSnapshots);
      } catch (error) {
        console.error("[INTERNAL] Failed to load emotion records:", error);
        // Silently fail - user can still use the app
        setSnapshots([]);
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

          {isLoading ? (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Loading your emotions...</p>
            </div>
          ) : !currentAccount ? (
            <div className="text-center py-12 space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/30 mb-4">
                <Lock className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Connect Wallet to View Timeline</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Connect your wallet to view your encrypted emotion records
              </p>
            </div>
          ) : snapshots.length === 0 ? (
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

                      {snapshot.walrusUrl && (
                        <div className="flex items-center gap-2 text-xs">
                          <Lock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground font-mono truncate max-w-xs">
                            {snapshot.blobId ? `${snapshot.blobId.slice(0, 8)}...` : "Encrypted"}
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
