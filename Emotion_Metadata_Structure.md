# 情緒 Metadata 結構說明

> 目前系統中情緒數據的結構定義

## 📦 一、EmotionSnapshot（存儲在 Walrus 中的加密數據）

這是**加密後存儲在 Walrus** 的完整情緒快照結構：

```typescript
export interface EmotionSnapshot {
  emotion: string;           // 情緒類型: "joy" | "sadness" | "anger" | "anxiety" | "confusion" | "peace"
  intensity: number;          // 強度: 0-100 的整數
  description: string;        // 情緒描述文字（用戶輸入的內容）
  timestamp: number;          // Unix 時間戳（毫秒）
  walletAddress: string;     // 錢包地址（格式: 0x[64位hex]）
  version: string;           // 版本號，目前為 "1.0.0"
}
```

**實際範例：**
```json
{
  "emotion": "joy",
  "intensity": 75,
  "description": "今天拿到駕照了！",
  "timestamp": 1736899200000,
  "walletAddress": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "version": "1.0.0"
}
```

**存儲流程：**
1. 前端創建 `EmotionSnapshot` 對象
2. 使用 `JSON.stringify()` 轉換為字符串
3. 使用 AES-GCM 加密（客戶端加密）
4. 加密後的數據上傳到 Walrus
5. Walrus 返回 `blobId` 和 `suiRef`

---

## 🗄️ 二、數據庫 Metadata（Supabase emotion_records 表）

這是**存儲在 Supabase 數據庫**中的元數據結構：

```sql
CREATE TABLE emotion_records (
  id uuid PRIMARY KEY,                    -- 記錄 ID
  user_id uuid NOT NULL,                  -- 用戶 ID（外鍵到 auth.users）
  emotion emotion_type NOT NULL,          -- 情緒類型（enum）
  intensity int NOT NULL,                  -- 強度 0-100
  description text,                       -- 描述（新版本為 NULL，因為已加密在 Walrus）
  blob_id text NOT NULL,                  -- Walrus blob ID
  walrus_url text NOT NULL,               -- Walrus 訪問 URL
  payload_hash text NOT NULL,             -- 加密數據的 SHA-256 哈希
  is_public boolean NOT NULL DEFAULT false, -- 是否公開
  proof_status proof_status NOT NULL,     -- 證明狀態: 'pending' | 'confirmed' | 'failed'
  sui_ref text,                           -- Sui 鏈上引用（目前為 NULL，未實現）
  created_at timestamptz NOT NULL,        -- 創建時間
  updated_at timestamptz NOT NULL         -- 更新時間
);
```

**實際範例：**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "emotion": "joy",
  "intensity": 75,
  "description": null,  // 新版本不存明文，從 Walrus 解密
  "blob_id": "abc123def456...",
  "walrus_url": "https://aggregator.testnet.walrus.space/v1/abc123def456...",
  "payload_hash": "a1b2c3d4e5f6...",
  "is_public": false,
  "proof_status": "confirmed",
  "sui_ref": null,  // 待實現：Sui 鏈上 metadata
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

**重要說明：**
- `description` 字段在新版本中設為 `NULL`，因為描述已加密存儲在 Walrus
- 前端需要從 Walrus 下載並解密才能顯示描述
- `sui_ref` 目前為 `NULL`，等待 Sui NFT minting 實現

---

## 💾 三、前端本地存儲（EmotionRecord）

這是**前端本地存儲**（localStorage/MVP 模式）的結構：

```typescript
export interface EmotionRecord {
  id: string;              // UUID
  timestamp: string;       // ISO 8601 時間字符串
  emotion: EmotionType;   // "joy" | "sadness" | "anger" | "anxiety" | "confusion" | "peace"
  note: string;           // 備註文字
  proof: string | null;   // 預留給未來鏈上 proof 或 hash
  version: "1.0.0";      // 版本號
  isPublic?: boolean;     // 是否公開（可選，向後兼容）
}
```

**實際範例：**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "emotion": "joy",
  "note": "今天拿到駕照了！",
  "proof": null,
  "version": "1.0.0",
  "isPublic": false
}
```

---

## 🔄 四、數據流程對照

### 完整流程中的數據轉換：

```
1. 用戶輸入
   ↓
   emotion: "joy"
   intensity: 75
   description: "今天拿到駕照了！"
   ↓
2. 創建 EmotionSnapshot
   {
     emotion: "joy",
     intensity: 75,
     description: "今天拿到駕照了！",
     timestamp: 1736899200000,
     walletAddress: "0x...",
     version: "1.0.0"
   }
   ↓
3. 加密（AES-GCM）
   encryptedData: "eyJjaXBoZXJ0ZXh0Ijoi...", "iv": "...", "salt": "..."}
   ↓
4. 上傳到 Walrus
   → blobId: "abc123..."
   → walrusUrl: "https://aggregator.testnet.walrus.space/v1/abc123..."
   → suiRef: null (待實現)
   ↓
5. 存儲到數據庫（僅 metadata）
   {
     id: "uuid",
     user_id: "uuid",
     emotion: "joy",
     intensity: 75,
     description: null,  // 不存明文
     blob_id: "abc123...",
     walrus_url: "https://...",
     payload_hash: "a1b2c3...",
     is_public: false,
     proof_status: "confirmed",
     sui_ref: null
   }
```

---

## 📊 五、字段對照表

| 字段 | EmotionSnapshot (Walrus) | 數據庫 (Supabase) | 前端本地 (EmotionRecord) |
|------|-------------------------|------------------|------------------------|
| **ID** | - | `id` (uuid) | `id` (string) |
| **情緒類型** | `emotion` (string) | `emotion` (enum) | `emotion` (EmotionType) |
| **強度** | `intensity` (number) | `intensity` (int) | - |
| **描述** | `description` (string) | `description` (text, null) | `note` (string) |
| **時間戳** | `timestamp` (number) | `created_at` (timestamptz) | `timestamp` (string) |
| **錢包地址** | `walletAddress` (string) | - | - |
| **版本** | `version` (string) | - | `version` (string) |
| **公開狀態** | - | `is_public` (boolean) | `isPublic` (boolean) |
| **Blob ID** | - | `blob_id` (text) | - |
| **Walrus URL** | - | `walrus_url` (text) | - |
| **Payload Hash** | - | `payload_hash` (text) | - |
| **Proof 狀態** | - | `proof_status` (enum) | `proof` (string\|null) |
| **Sui 引用** | - | `sui_ref` (text, null) | - |

---

## ⚠️ 六、待實現的 Sui Metadata

根據計劃，未來需要在 **Sui 鏈上存儲 metadata**，結構可能如下：

```typescript
// 待實現的 Sui 鏈上 metadata 結構
interface SuiEmotionMetadata {
  blobId: string;          // Walrus blob ID
  payloadHash: string;      // 數據哈希
  owner: string;           // 所有者錢包地址
  emotion: string;         // 情緒類型
  intensity: number;       // 強度
  timestamp: number;       // 時間戳
  isPublic: boolean;       // 是否公開
  sealProof?: string;      // Seal proof（如果使用 Seal）
}
```

**目前狀態：**
- ❌ Sui Move 合約未實現
- ❌ Sui metadata 上鏈未實現
- ❌ `sui_ref` 字段在數據庫中為 `NULL`

---

## 🔍 七、驗證 Schema

### Zod 驗證 Schema（前端）

```typescript
export const emotionSnapshotSchema = z.object({
  emotion: z.enum(["joy", "sadness", "anger", "anxiety", "confusion", "peace"]),
  intensity: z.number().int().min(0).max(100),
  description: z.string().min(1).max(5000),
  timestamp: z.number().int().positive(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  version: z.string().default("1.0.0"),
});
```

### 數據庫 Enum 類型

```sql
-- 情緒類型
CREATE TYPE emotion_type AS ENUM (
  'joy', 'sadness', 'anger', 'anxiety', 'confusion', 'peace'
);

-- Proof 狀態
CREATE TYPE proof_status AS ENUM (
  'pending', 'confirmed', 'failed'
);
```

---

## 📝 八、重要注意事項

1. **安全性**
   - `description` 在數據庫中不存明文（新版本設為 `NULL`）
   - 所有敏感數據都加密存儲在 Walrus
   - 前端需要從 Walrus 下載並解密才能顯示

2. **版本控制**
   - 目前所有版本號為 `"1.0.0"`
   - 未來如有結構變更，需要版本遷移

3. **待實現功能**
   - Sui NFT minting（`sui_ref` 字段）
   - Seal SDK 整合（`sealProof` 字段）
   - Sui metadata 上鏈

---

*最後更新：2025-01-15*

