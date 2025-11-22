# Lens 架構思想實作指南：Echoma 的具體改進方案

> 基於 [LENS_PROTOCOL_ARCHITECTURE_ANALYSIS.md](./LENS_PROTOCOL_ARCHITECTURE_ANALYSIS.md) 的實作建議

---

## 📋 目錄

1. [物件化架構增強](#物件化架構增強)
2. [模組化權限系統擴展](#模組化權限系統擴展)
3. [批量處理機制](#批量處理機制)
4. [Protocol SDK 開發](#protocol-sdk-開發)

---

## 🎯 物件化架構增強

### ① EmotionTags 物件系統

**當前狀態**：`tags?: string[]` 在 `EmotionRecord` 中，但沒有物件化管理。

**目標**：將 tags 從簡單的字串陣列升級為可管理的物件系統。

#### 1.1 定義 EmotionTag 物件

```typescript
// src/lib/emotionTags.ts

export interface EmotionTag {
  id: string; // UUID
  name: string; // 標籤名稱
  color?: string; // 可選的顏色標識
  createdAt: number; // 創建時間戳
  usageCount: number; // 使用次數
  userId?: string; // 用戶 ID（如果支持多用戶）
}

export interface EmotionTagManager {
  // 創建新標籤
  createTag(name: string, color?: string): Promise<EmotionTag>;
  
  // 獲取所有標籤
  getAllTags(): Promise<EmotionTag[]>;
  
  // 獲取標籤使用統計
  getTagUsageStats(tagId: string): Promise<{
    totalUsage: number;
    recentUsage: number; // 最近 30 天
    associatedEmotions: EmotionType[];
  }>;
  
  // 刪除標籤（會從所有關聯的情緒紀錄中移除）
  deleteTag(tagId: string): Promise<void>;
  
  // 合併標籤
  mergeTags(sourceTagId: string, targetTagId: string): Promise<void>;
}
```

#### 1.2 實作 EmotionTagManager

```typescript
// src/lib/emotionTags.ts (續)

class LocalEmotionTagManager implements EmotionTagManager {
  private storageKey = 'echoma_emotion_tags';
  
  async createTag(name: string, color?: string): Promise<EmotionTag> {
    const tags = await this.getAllTags();
    
    // 檢查是否已存在
    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return existing;
    }
    
    const newTag: EmotionTag = {
      id: crypto.randomUUID(),
      name,
      color: color || this.generateColor(),
      createdAt: Date.now(),
      usageCount: 0,
    };
    
    tags.push(newTag);
    await this.saveTags(tags);
    
    return newTag;
  }
  
  async getAllTags(): Promise<EmotionTag> {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : [];
  }
  
  private generateColor(): string {
    // 生成隨機顏色
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  private async saveTags(tags: EmotionTag[]): Promise<void> {
    localStorage.setItem(this.storageKey, JSON.stringify(tags));
  }
  
  // ... 其他方法實作
}

// 導出單例
export const emotionTagManager = new LocalEmotionTagManager();
```

#### 1.3 更新 EmotionRecord 以使用 Tag 物件

```typescript
// src/lib/dataSchema.ts (更新)

export interface EmotionRecord {
  id: string;
  timestamp: string;
  emotion: EmotionType;
  note: string;
  proof: string | null;
  version: "1.0.0";
  isPublic?: boolean;
  intensity?: number;
  tags?: string[]; // 保持向後兼容，存儲 tag IDs
  tagObjects?: EmotionTag[]; // 新增：完整的 tag 物件（可選，用於顯示）
}
```

---

### ② SharePolicy 物件（細粒度權限）

**當前狀態**：只有簡單的 `grant_access` / `revoke_access`，是 all-or-nothing 模式。

**目標**：實現細粒度的權限控制（view, decrypt, export）。

#### 2.1 定義 SharePolicy 物件

```typescript
// src/lib/sharePolicy.ts

export type Permission = 'view' | 'decrypt' | 'export' | 'analyze';

export interface SharePolicy {
  id: string; // UUID
  entryNftId: string; // 關聯的 EntryNFT ID
  grantee: string; // 被授權的地址
  permissions: Permission[]; // 權限列表
  role?: string; // 角色標籤（例如：'therapist', 'family'）
  expiresAt?: number; // 過期時間戳（可選）
  createdAt: number;
  updatedAt: number;
}

export interface SharePolicyManager {
  // 創建分享策略
  createPolicy(
    entryNftId: string,
    grantee: string,
    permissions: Permission[],
    role?: string,
    expiresAt?: number
  ): Promise<SharePolicy>;
  
  // 更新權限
  updatePermissions(
    policyId: string,
    permissions: Permission[]
  ): Promise<SharePolicy>;
  
  // 檢查權限
  hasPermission(
    entryNftId: string,
    grantee: string,
    permission: Permission
  ): Promise<boolean>;
  
  // 獲取所有策略
  getPolicies(entryNftId: string): Promise<SharePolicy[]>;
  
  // 刪除策略
  deletePolicy(policyId: string): Promise<void>;
}
```

#### 2.2 更新 Move 合約以支持細粒度權限

```move
// nft_mint_test/sources/seal_access_policies.move (擴展)

module nft_mint_test::seal_access_policies {
    // ... 現有代碼 ...
    
    /// 權限類型
    public struct Permission has copy, drop, store {
        view: bool,
        decrypt: bool,
        export: bool,
        analyze: bool,
    }
    
    /// 擴展 AccessPolicy 以包含細粒度權限
    public struct AccessPolicy has key, store {
        id: UID,
        entry_nft_id: ID,
        owner: address,
        seal_type: SealType,
        authorized_addresses: vector<address>,
        // 新增：細粒度權限映射
        permissions: vector<Permission>, // 對應 authorized_addresses
    }
    
    /// 檢查特定權限
    public fun has_permission(
        entry_nft_id: ID,
        requester: address,
        permission_type: u8, // 0=view, 1=decrypt, 2=export, 3=analyze
        registry: &PolicyRegistry
    ): bool {
        // ... 實作邏輯 ...
    }
}
```

---

## 🔐 模組化權限系統擴展

### ① Time-lock Module（時間限制模組）

**目標**：實現自動過期的授權。

#### 1.1 定義 TimeLockModule

```typescript
// src/lib/modules/timeLockModule.ts

export interface TimeLockConfig {
  expiresAt: number; // 過期時間戳
  autoRevoke: boolean; // 是否自動撤銷
  notifyBeforeExpiry?: number; // 過期前多少小時通知（可選）
}

export class TimeLockModule {
  // 創建帶時間限制的授權
  async grantWithTimeLock(
    entryNftId: string,
    grantee: string,
    config: TimeLockConfig
  ): Promise<string> {
    // 1. 創建授權
    const policyId = await sharePolicyManager.createPolicy(
      entryNftId,
      grantee,
      ['view', 'decrypt'],
      undefined,
      config.expiresAt
    );
    
    // 2. 設置自動撤銷定時器
    if (config.autoRevoke) {
      this.scheduleAutoRevoke(policyId, config.expiresAt);
    }
    
    // 3. 設置過期前通知
    if (config.notifyBeforeExpiry) {
      this.scheduleExpiryNotification(
        policyId,
        config.expiresAt - config.notifyBeforeExpiry * 3600 * 1000
      );
    }
    
    return policyId;
  }
  
  private scheduleAutoRevoke(policyId: string, expiresAt: number): void {
    const now = Date.now();
    const delay = expiresAt - now;
    
    if (delay > 0) {
      setTimeout(async () => {
        await sharePolicyManager.deletePolicy(policyId);
        // 觸發鏈上撤銷
        await revokeAccess(/* ... */);
      }, delay);
    }
  }
  
  // 檢查授權是否過期
  async isExpired(policyId: string): Promise<boolean> {
    const policy = await sharePolicyManager.getPolicy(policyId);
    if (!policy || !policy.expiresAt) {
      return false;
    }
    return Date.now() > policy.expiresAt;
  }
}
```

---

### ② AI-Access Module（AI 訪問控制模組）

**目標**：控制 AI 分析服務的訪問權限。

#### 2.1 定義 AIAccessModule

```typescript
// src/lib/modules/aiAccessModule.ts

export interface AIAccessConfig {
  allowedEmotions?: EmotionType[]; // 只允許分析特定情緒類型
  timeRange?: {
    start: number; // 開始時間戳
    end: number; // 結束時間戳
  };
  dataRedaction?: {
    hideDescription: boolean; // 隱藏描述
    hideIntensity: boolean; // 隱藏強度
    onlyEmotionType: boolean; // 只提供情緒類型
  };
}

export class AIAccessModule {
  // 授權 AI 訪問
  async grantAIAccess(
    aiServiceAddress: string,
    config: AIAccessConfig
  ): Promise<string> {
    // 創建特殊的 AI 訪問策略
    const policy = await sharePolicyManager.createPolicy(
      'ai-service', // 特殊的 entryNftId
      aiServiceAddress,
      ['analyze'], // 只有 analyze 權限
      'ai-service',
      undefined
    );
    
    // 保存 AI 訪問配置
    await this.saveAIConfig(policy.id, config);
    
    return policy.id;
  }
  
  // 檢查 AI 是否可以訪問特定紀錄
  async canAIAccess(
    aiServiceAddress: string,
    record: EmotionRecord
  ): Promise<boolean> {
    const config = await this.getAIConfig(aiServiceAddress);
    if (!config) {
      return false;
    }
    
    // 檢查情緒類型限制
    if (config.allowedEmotions && 
        !config.allowedEmotions.includes(record.emotion)) {
      return false;
    }
    
    // 檢查時間範圍
    if (config.timeRange) {
      const recordTime = new Date(record.timestamp).getTime();
      if (recordTime < config.timeRange.start || 
          recordTime > config.timeRange.end) {
        return false;
      }
    }
    
    return true;
  }
  
  // 獲取脫敏後的數據（供 AI 使用）
  async getRedactedData(
    record: EmotionRecord,
    config: AIAccessConfig
  ): Promise<Partial<EmotionRecord>> {
    const redacted: Partial<EmotionRecord> = {
      id: record.id,
      timestamp: record.timestamp,
      emotion: record.emotion,
    };
    
    if (!config.dataRedaction?.hideIntensity && record.intensity) {
      redacted.intensity = record.intensity;
    }
    
    if (!config.dataRedaction?.hideDescription && 
        !config.dataRedaction?.onlyEmotionType) {
      redacted.note = record.note;
    }
    
    return redacted;
  }
}
```

---

## 📦 批量處理機制

### ① Session-based 批量上鏈

**目標**：將多個情緒紀錄批量上鏈，降低 gas 成本。

#### 1.1 定義 EmotionSession

```typescript
// src/lib/emotionSession.ts

export interface EmotionSession {
  id: string; // Session ID
  startTime: number; // 開始時間
  endTime?: number; // 結束時間（可選）
  entries: EmotionRecord[]; // 該 session 中的情緒紀錄
  mintedNftId?: string; // 批量 mint 的 NFT ID（如果已上鏈）
  status: 'draft' | 'sealed' | 'minted'; // 狀態
}

export interface EmotionSessionManager {
  // 創建新 session
  createSession(): Promise<EmotionSession>;
  
  // 添加紀錄到 session
  addEntryToSession(sessionId: string, entry: EmotionRecord): Promise<void>;
  
  // 封存 session（不再添加新紀錄）
  sealSession(sessionId: string): Promise<void>;
  
  // 批量 mint session 中的所有紀錄
  mintSession(sessionId: string): Promise<string>; // 返回 NFT ID
}
```

#### 1.2 實作批量 Mint

```typescript
// src/lib/emotionSession.ts (續)

class LocalEmotionSessionManager implements EmotionSessionManager {
  async mintSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    
    if (session.status !== 'sealed') {
      throw new Error('Session must be sealed before minting');
    }
    
    // 批量準備數據
    const batchData = session.entries.map(entry => ({
      blobId: entry.proof, // 假設 proof 存儲 blobId
      emotion: entry.emotion,
      intensity: entry.intensity,
      timestamp: new Date(entry.timestamp).getTime(),
    }));
    
    // 調用批量 mint 函數（需要在 Move 合約中實現）
    const nftId = await this.batchMintEntries(batchData);
    
    // 更新 session 狀態
    session.mintedNftId = nftId;
    session.status = 'minted';
    await this.saveSession(session);
    
    return nftId;
  }
  
  private async batchMintEntries(
    entries: Array<{
      blobId: string;
      emotion: EmotionType;
      intensity?: number;
      timestamp: number;
    }>
  ): Promise<string> {
    // 調用 Move 合約的批量 mint 函數
    // 這需要在 Move 合約中實現 batch_mint_entries 函數
    // ... 實作邏輯 ...
  }
}
```

#### 1.3 Move 合約中的批量 Mint

```move
// nft_mint_test/sources/nft_mint_test.move (擴展)

module nft_mint_test::nft_mint_test {
    // ... 現有代碼 ...
    
    /// 批量 mint 多個 Entry
    public entry fun batch_mint_entries(
        journal: &mut Journal,
        entries: vector<EntryData>, // EntryData 包含 blob_id, emotion, intensity, timestamp
        ctx: &mut TxContext
    ) {
        let batch_id = object::id_from_address(@batch);
        let mut entry_ids = vector::empty<ID>();
        
        let i = 0;
        let len = vector::length(&entries);
        while (i < len) {
            let entry_data = *vector::borrow(&entries, i);
            let entry_nft = mint_entry_internal(
                journal,
                entry_data.blob_id,
                entry_data.emotion,
                entry_data.intensity,
                entry_data.timestamp,
                ctx
            );
            vector::push_back(&mut entry_ids, object::id(&entry_nft));
            i = i + 1;
        };
        
        // 創建 Batch NFT（包含所有 Entry IDs）
        let batch_nft = BatchNFT {
            id: object::new(ctx),
            batch_id,
            entry_ids,
            created_at: tx_context::epoch_timestamp_ms(ctx),
        };
        
        transfer::transfer(batch_nft, tx_context::sender(ctx));
    }
}
```

---

## 🛠️ Protocol SDK 開發

### ① Echoma Protocol SDK 結構

**目標**：讓第三方開發者可以輕鬆集成 Echoma Protocol。

#### 1.1 SDK 核心接口

```typescript
// packages/echoma-sdk/src/index.ts

export interface EchomaSDKConfig {
  network: 'testnet' | 'mainnet';
  rpcUrl?: string; // 可選的自定義 RPC URL
  walletAdapter?: WalletAdapter; // 可選的錢包適配器
}

export class EchomaSDK {
  private config: EchomaSDKConfig;
  private suiClient: SuiClient;
  
  constructor(config: EchomaSDKConfig) {
    this.config = config;
    this.suiClient = new SuiClient({
      url: config.rpcUrl || this.getDefaultRpcUrl(config.network),
    });
  }
  
  // 創建情緒紀錄
  async createEmotionEntry(
    emotion: EmotionType,
    description: string,
    intensity?: number,
    tags?: string[]
  ): Promise<EmotionEntry> {
    // 1. 加密數據
    const encrypted = await this.encryptEmotionData({
      emotion,
      description,
      intensity,
      timestamp: Date.now(),
    });
    
    // 2. 上傳到 Walrus
    const walrusResult = await this.uploadToWalrus(encrypted);
    
    // 3. 可選：鑄造 NFT
    // const nftId = await this.mintEntryNFT(walrusResult.blobId);
    
    return {
      id: crypto.randomUUID(),
      blobId: walrusResult.blobId,
      walrusUrl: walrusResult.walrusUrl,
      emotion,
      intensity,
      timestamp: Date.now(),
    };
  }
  
  // 讀取情緒紀錄
  async getEmotionEntry(blobId: string): Promise<EmotionEntry> {
    // 1. 從 Walrus 下載加密數據
    const encrypted = await this.downloadFromWalrus(blobId);
    
    // 2. 解密
    const decrypted = await this.decryptEmotionData(encrypted);
    
    return decrypted;
  }
  
  // 分享紀錄
  async shareEntry(
    entryNftId: string,
    grantee: string,
    permissions: Permission[]
  ): Promise<string> {
    // 調用 Seal Access Policies 合約
    return await this.grantAccess(entryNftId, grantee, permissions);
  }
  
  // 撤銷分享
  async revokeShare(
    entryNftId: string,
    grantee: string
  ): Promise<string> {
    return await this.revokeAccess(entryNftId, grantee);
  }
  
  // 查詢權限
  async hasAccess(
    entryNftId: string,
    requester: string
  ): Promise<boolean> {
    return await this.checkAccess(entryNftId, requester);
  }
}
```

#### 1.2 使用示例

```typescript
// 第三方 App 使用示例

import { EchomaSDK } from '@echoma/sdk';

// 初始化 SDK
const sdk = new EchomaSDK({
  network: 'testnet',
});

// 創建情緒紀錄
const entry = await sdk.createEmotionEntry(
  'joy',
  '今天心情很好！',
  75,
  ['work', 'weekend']
);

// 分享給心理師
await sdk.shareEntry(
  entry.nftId,
  '0x...', // 心理師的地址
  ['view', 'decrypt']
);

// 讀取紀錄
const decrypted = await sdk.getEmotionEntry(entry.blobId);
console.log(decrypted.description);
```

---

## 📝 實作優先級

### 高優先級（1-2 個月）

1. ✅ **EmotionTags 物件系統**
   - 實作 `EmotionTagManager`
   - 更新 UI 以支持 tag 管理
   - 添加 tag 統計功能

2. ✅ **SharePolicy 細粒度權限**
   - 擴展 Move 合約以支持權限類型
   - 更新前端以支持細粒度權限選擇
   - 實作權限檢查邏輯

3. ✅ **批量處理機制**
   - 實作 `EmotionSessionManager`
   - 在 Move 合約中添加批量 mint 函數
   - 優化 gas 成本

### 中優先級（3-6 個月）

1. ✅ **Time-lock Module**
   - 實作自動過期機制
   - 添加過期前通知功能

2. ✅ **AI-Access Module**
   - 實作 AI 訪問控制
   - 添加數據脫敏功能

3. ✅ **Protocol SDK**
   - 開發核心 SDK
   - 編寫文檔和示例

### 低優先級（6-12 個月）

1. ✅ **生態系統建設**
   - 支持第三方 App
   - 建立開發者社區
   - 提供開發者工具

---

## 🎯 總結

這些實作建議基於 Lens Protocol 的架構思想，但完全符合 Echoma 的隱私優先原則：

- ✅ **物件化**：所有數據都是可管理的物件
- ✅ **模組化**：權限系統是可組合的模組
- ✅ **可撤回**：所有授權都可以撤回
- ✅ **隱私優先**：默認私有，需要明確授權
- ✅ **批量處理**：優化 gas 成本，適合高頻情緒紀錄

**下一步**：從高優先級項目開始，逐步完善 Echoma Protocol 的架構。


