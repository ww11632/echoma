export type EmotionType = "joy" | "sadness" | "anger";

export interface EmotionRecord {
  id: string; // uuid
  timestamp: string; // ISO string
  emotion: EmotionType;
  note: string;
  proof: string | null; // reserved for future on-chain proof or hash
  version: "1.0.0";
}

export const EMOTION_OPTIONS: { label: string; value: EmotionType }[] = [
  { label: "😊 Joy", value: "joy" },
  { label: "😢 Sadness", value: "sadness" },
  { label: "😠 Anger", value: "anger" },
];


