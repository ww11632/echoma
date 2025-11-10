import type { EmotionRecord } from "./dataSchema";

export interface StorageAdapter {
  save(record: EmotionRecord): Promise<void>;
  list(): Promise<EmotionRecord[]>;
  get(id: string): Promise<EmotionRecord | null>;
  clear?(): Promise<void>;
}

const LOCAL_KEY = "echoma_mvp_records";

export class LocalJsonAdapter implements StorageAdapter {
  async save(record: EmotionRecord): Promise<void> {
    const list = await this.list();
    list.push(record);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  }

  async list(): Promise<EmotionRecord[]> {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as EmotionRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async get(id: string): Promise<EmotionRecord | null> {
    const list = await this.list();
    return list.find((r) => r.id === id) ?? null;
  }

  async clear(): Promise<void> {
    localStorage.removeItem(LOCAL_KEY);
  }
}

export class StorageService {
  private adapter: StorageAdapter;
  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }
  save(record: EmotionRecord) {
    return this.adapter.save(record);
  }
  list() {
    return this.adapter.list();
  }
  get(id: string) {
    return this.adapter.get(id);
  }
  clear() {
    return this.adapter.clear?.() ?? Promise.resolve();
  }
}


