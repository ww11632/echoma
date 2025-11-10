import type { EmotionRecord } from "./dataSchema";
import { StorageService, LocalJsonAdapter } from "./storageService";

// Simple local index built on top of local storage
const service = new StorageService(new LocalJsonAdapter());

export async function addEmotionRecord(record: EmotionRecord): Promise<void> {
  await service.save(record);
}

export async function listEmotionRecords(): Promise<EmotionRecord[]> {
  // Most recent first
  const records = await service.list();
  return records.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export async function clearEmotionRecords(): Promise<void> {
  await service.clear();
}


