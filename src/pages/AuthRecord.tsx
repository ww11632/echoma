import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { encryptData, generateUserKeyFromId } from "@/lib/encryption";
import type { User, Session } from "@supabase/supabase-js";

const emotionTags = [
  { label: "😊 Joy", value: "joy", color: "from-yellow-400 to-orange-400" },
  { label: "😢 Sadness", value: "sadness", color: "from-blue-400 to-indigo-400" },
  { label: "😠 Anger", value: "anger", color: "from-red-400 to-rose-400" },
  { label: "😰 Anxiety", value: "anxiety", color: "from-purple-400 to-pink-400" },
  { label: "🤔 Confusion", value: "confusion", color: "from-gray-400 to-slate-400" },
  { label: "✨ Peace", value: "peace", color: "from-green-400 to-teal-400" },
];

const AuthRecord = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string>("");
  const [intensity, setIntensity] = useState([50]);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      title: "Signed Out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  const handleSubmit = async () => {
    if (!selectedEmotion || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an emotion and add a description.",
        variant: "destructive",
      });
      return;
    }

    if (!session) {
      toast({
        title: "Not Authenticated",
        description: "Please sign in to record emotions.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const sanitizedDescription = validateAndSanitizeDescription(description);

      // Create snapshot of emotion data
      const snapshot = {
        emotion: selectedEmotion,
        intensity: intensity[0],
        description: sanitizedDescription,
        timestamp: new Date().toISOString(),
      };

      // Generate encryption key from user ID (secure key derivation using PBKDF2)
      const userKey = await generateUserKeyFromId(user.id);

      // Properly encrypt the data using AES-GCM
      const encrypted = await encryptData(JSON.stringify(snapshot), userKey);
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
        result = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        throw new Error('Invalid response from server');
      }

      // Check if the function returned an error response
      if (!response.ok || !result || !result.success) {
        const errorMessage = result?.error || result?.message || `Server error (${response.status})`;
        throw new Error(errorMessage);
      }

      // Verify we have a valid result
      if (!result.record) {
        throw new Error('Invalid response from server');
      }

      toast({
        title: "Success!",
        description: "Your emotion has been recorded securely.",
      });

      // Reset form
      setSelectedEmotion("");
      setIntensity([50]);
      setDescription("");
      setIsPublic(false);

      // Navigate to timeline
      setTimeout(() => {
        navigate("/auth-timeline");
      }, 1500);
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
        title: "Upload Failed",
        description: errorMessage,
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
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <Card className="glass-card p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion glow-primary animate-float mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Record Your Emotion</h1>
            <p className="text-muted-foreground">Securely stored with cloud backup</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">How are you feeling?</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {emotionTags.map((tag) => (
                  <Button
                    key={tag.value}
                    variant={selectedEmotion === tag.value ? "default" : "outline"}
                    className={`h-auto py-4 text-base ${
                      selectedEmotion === tag.value
                        ? `bg-gradient-to-r ${tag.color} text-white hover:opacity-90`
                        : "glass-card"
                    }`}
                    onClick={() => setSelectedEmotion(tag.value)}
                  >
                    {tag.label}
                  </Button>
                ))}
              </div>
            </div>

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
            </div>

            <div className="space-y-3">
              <Label htmlFor="description" className="text-base font-semibold">
                Describe your feelings
              </Label>
              <Textarea
                id="description"
                placeholder="What's on your mind? Express yourself freely..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] glass-card resize-none"
              />
              <p className="text-sm text-muted-foreground">
                {description.length} / 5000 characters
              </p>
            </div>

            <div className="flex items-center justify-between glass-card p-4 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Make Public</Label>
                <p className="text-sm text-muted-foreground">
                  Share this emotion record with others
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedEmotion || !description.trim()}
              className="w-full h-14 text-lg font-semibold gradient-emotion glow-primary"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Record Emotion
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
