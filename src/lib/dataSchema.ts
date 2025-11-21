export type EmotionType = "joy" | "sadness" | "anger" | "anxiety" | "confusion" | "peace";

export interface EmotionRecord {
  id: string; // uuid
  timestamp: string; // ISO string
  emotion: EmotionType;
  note: string;
  proof: string | null; // reserved for future on-chain proof or hash
  version: "1.0.0";
  isPublic?: boolean; // 是否公開分享（可選，向後兼容）
  intensity?: number; // 情緒強度 0-100（可選，向後兼容）
  tags?: string[]; // 標籤/分類（可選）
}

export const EMOTION_OPTIONS: { label: string; value: EmotionType }[] = [
  { label: "😊 Joy", value: "joy" },
  { label: "😢 Sadness", value: "sadness" },
  { label: "😠 Anger", value: "anger" },
  { label: "😰 Anxiety", value: "anxiety" },
  { label: "🤔 Confusion", value: "confusion" },
  { label: "✨ Peace", value: "peace" },
];


