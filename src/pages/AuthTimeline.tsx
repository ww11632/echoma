import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, LogOut, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { decryptData, decryptDataWithMigration, DecryptionError, DecryptionErrorType } from "@/lib/encryption";
import { generateUserKeyFromId } from "@/lib/encryption";
import { readFromWalrus } from "@/lib/walrus";
import type { User, Session } from "@supabase/supabase-js";
import type { EncryptedData } from "@/lib/encryption";

interface EmotionRecord {
  id: string;
  created_at: string;
  emotion: string;
  intensity: number;
  description: string | null;
  is_public: boolean;
  walrus_url?: string;
  blob_id?: string;
  encrypted_data?: string | null;
}

const emotionEmojis: Record<string, string> = {
  joy: "😊",
  sadness: "😢",
  anger: "😠",
  anxiety: "😰",
  confusion: "🤔",
  peace: "✨",
};

const AuthTimeline = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<EmotionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Store decrypted descriptions by record ID
  const [decryptedDescriptions, setDecryptedDescriptions] = useState<Record<string, string>>({});
  // Track which records are being decrypted
  const [decryptingRecords, setDecryptingRecords] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setSession(session);
      setUser(session.user);
      loadRecords();
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

  // Decrypt description function - defined before use
  const decryptDescription = useCallback(async (recordId: string, blobId?: string | null, encryptedDataFromDb?: string | null) => {
    if (!user) return;
    
    // Mark as decrypting
    setDecryptingRecords(prev => {
      if (prev.has(recordId)) {
        return prev; // Already decrypting
      }
      return new Set(prev).add(recordId);
    });

    try {
      let encryptedDataString: string;
      
      // Try database fallback first, then Walrus
      if (encryptedDataFromDb) {
        console.log(`Using encrypted data from database for record ${recordId}`);
        encryptedDataString = encryptedDataFromDb;
      } else if (blobId) {
        console.log(`Fetching encrypted data from Walrus for record ${recordId}`);
        encryptedDataString = await readFromWalrus(blobId);
      } else {
        throw new Error('No encrypted data source available');
      }
      
      // Parse the encrypted data JSON
      const encryptedData: EncryptedData = JSON.parse(encryptedDataString);
      
      // Generate user key for decryption
      const userKey = await generateUserKeyFromId(user.id);
      
      // Decrypt the data (supports automatic legacy format migration)
      const decryptedString = await decryptDataWithMigration(encryptedData, userKey);
      
      // Parse the decrypted JSON to get the snapshot
      const snapshot = JSON.parse(decryptedString);
      
      // Store the decrypted description
      setDecryptedDescriptions(prev => {
        if (prev[recordId]) {
          return prev; // Already decrypted
        }
        return {
          ...prev,
          [recordId]: snapshot.description || '',
        };
      });
    } catch (error: any) {
      console.error(`Failed to decrypt record ${recordId}:`, error);
      
      // Provide more specific error messages
      let errorMessage = "Could not decrypt this record. It may have expired or been corrupted.";
      if (error instanceof DecryptionError) {
        switch (error.type) {
          case DecryptionErrorType.INVALID_KEY:
            errorMessage = "Decryption failed: Invalid key or incorrect password.";
            break;
          case DecryptionErrorType.DATA_CORRUPTED:
            errorMessage = "Decryption failed: Data may be corrupted or tampered.";
            break;
          case DecryptionErrorType.UNSUPPORTED_VERSION:
            errorMessage = "Decryption failed: Unsupported encryption format version.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Decryption Failed",
        description: errorMessage,
        variant: "destructive",
      });
      // Store error message instead
      setDecryptedDescriptions(prev => ({
        ...prev,
        [recordId]: '[Decryption failed]',
      }));
    } finally {
      setDecryptingRecords(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  }, [user, toast]);

  // Auto-decrypt records when user and records are available
  useEffect(() => {
    if (!user || records.length === 0) return;
    
    // Decrypt records that don't have plaintext description
    records.forEach(record => {
      if (!record.description && (record.blob_id || record.encrypted_data)) {
        // Check state using functional updates to avoid stale closures
        setDecryptedDescriptions(current => {
          setDecryptingRecords(decrypting => {
            // Only decrypt if not already decrypted and not currently decrypting
            if (!current[record.id] && !decrypting.has(record.id)) {
              decryptDescription(record.id, record.blob_id, record.encrypted_data);
            }
            return decrypting;
          });
          return current;
        });
      }
    });
  }, [user, records]);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('emotion_records')
        .select('id, created_at, emotion, intensity, description, is_public, walrus_url, blob_id, encrypted_data')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecords(data || []);
    } catch (error: any) {
      console.error("Load records error:", error);
      toast({
        title: "Failed to Load",
        description: "Could not load your emotion records.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed Out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
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
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
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

        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-emotion shadow-md animate-float">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Your Emotion Timeline</h1>
          <p className="text-muted-foreground">Securely stored emotion records</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : records.length === 0 ? (
          <Card className="glass-card p-12 text-center space-y-4">
            <p className="text-muted-foreground">No emotion records yet.</p>
            <Button onClick={() => navigate("/auth-record")} className="gradient-emotion">
              Record Your First Emotion
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {records.map((record, index) => (
              <Card
                key={record.id}
                className="glass-card p-6 space-y-4 animate-float"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{emotionEmojis[record.emotion] || "😊"}</span>
                    <div>
                      <h3 className="text-xl font-semibold capitalize">{record.emotion}</h3>
                      <p className="text-sm text-muted-foreground">
                        Intensity: {record.intensity}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {new Date(record.created_at).toLocaleString()}
                  </div>
                </div>
                {(() => {
                  // Check if we have a decrypted description
                  const decryptedDesc = decryptedDescriptions[record.id];
                  const isDecrypting = decryptingRecords.has(record.id);
                  
                  if (record.description) {
                    // Plaintext description (legacy records)
                    return <p className="text-foreground/90 leading-relaxed">{record.description}</p>;
                  } else if (decryptedDesc) {
                    // Successfully decrypted
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Unlock className="w-3 h-3 text-green-500" />
                          <span>Decrypted from secure storage</span>
                        </div>
                        <p className="text-foreground/90 leading-relaxed">{decryptedDesc}</p>
                      </div>
                    );
                  } else if (isDecrypting) {
                    // Currently decrypting
                    return (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Decrypting from secure storage...</span>
                        </div>
                      </div>
                    );
                  } else if (record.blob_id || record.encrypted_data) {
                    // Has blob_id or encrypted_data but not decrypted yet - show decrypt button
                    return (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Lock className="w-4 h-4" />
                            <span>Description is encrypted</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => decryptDescription(record.id, record.blob_id, record.encrypted_data)}
                            disabled={isDecrypting}
                          >
                            <Unlock className="w-3 h-3 mr-2" />
                            Decrypt
                          </Button>
                        </div>
                      </div>
                    );
                  } else {
                    // No blob_id - cannot decrypt
                    return (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Lock className="w-4 h-4" />
                          <span>Encrypted data not available</span>
                        </div>
                      </div>
                    );
                  }
                })()}
                {record.is_public && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                    Public
                  </span>
                )}
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button
            onClick={() => navigate("/auth-record")}
            className="gradient-emotion shadow-md"
          >
            Record New Emotion
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthTimeline;
