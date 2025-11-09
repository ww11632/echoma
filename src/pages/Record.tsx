import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedEmotion, setSelectedEmotion] = useState<string>("");
  const [intensity, setIntensity] = useState([50]);
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!selectedEmotion || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an emotion and add a description.",
        variant: "destructive",
      });
      return;
    }

    // TODO: Integrate with Walrus & Sui
    // 1. Generate emotion snapshot
    // 2. Encrypt snapshot
    // 3. Upload to Walrus → get CID
    // 4. Mint Emotion NFT on Sui
    
    toast({
      title: "Emotion Recorded! ✨",
      description: "Your emotion snapshot will be minted as an NFT.",
    });

    // Navigate to timeline after recording
    setTimeout(() => navigate("/timeline"), 1500);
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
                What happened?
              </Label>
              <Textarea
                id="description"
                placeholder="Describe what triggered this emotion... (This will be encrypted)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="glass-input min-h-[150px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                🔒 Your description is encrypted client-side before storage
              </p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              className="w-full h-12 text-base font-semibold gradient-emotion hover:opacity-90"
              size="lg"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Record & Mint NFT
            </Button>

            <Card className="p-4 bg-secondary/10 border-secondary/20">
              <p className="text-xs text-center text-muted-foreground">
                💡 Your emotion snapshot will be encrypted and stored on Walrus, with an NFT minted on Sui as proof
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Record;
