# 安全功能實現說明

本文檔說明已實現的安全功能，用於防止 Prompt Injection、越權資料洩漏，並提供審計日誌和 API key rotation 支持。

## 一、防止 Prompt Injection / 越權資料洩漏

### 1. 最小化上下文拼接

**實現位置**: `supabase/functions/_shared/security.ts`

- **功能**: 對用戶輸入進行清理和最小化處理，避免將解密後的敏感字段暴露到模型
- **方法**: 
  - `cleanDescription()`: 清理用戶描述，移除常見的 prompt injection 模式
  - `sanitizeUserInput()`: 只提取必要的情緒信息（情緒類型、強度），不包含完整描述

**清理規則**:
- 移除系統指令嘗試（如 "ignore previous instructions"）
- 移除特殊標記（如 `<|...|>`, `[INST]...[/INST]`）
- 限制長度（最大 2000 字符）
- 移除角色標記（system:, assistant:, user:）

### 2. 模型輸出分類和安全檢測

**實現位置**: `supabase/functions/_shared/security.ts`

**輸出分類**:
- `supportive`: 支持性文本（默認）
- `suggestion`: 建議性內容
- `crisis`: 危機提示（檢測到自傷/他傷關鍵詞）
- `unknown`: 未知分類

**安全關鍵詞檢測**:
- 支持中英文關鍵詞檢測
- 自傷關鍵詞：自殺、自傷、自殘、結束生命等
- 他傷關鍵詞：殺人、傷害、報復、攻擊等
- 檢測到高風險關鍵詞時，觸發安全卡控

### 3. 本地端安全卡控

**實現位置**: `supabase/functions/ai-emotion-response/index.ts`

**工作流程**:
1. **輸入檢測**: 在發送到模型前檢查用戶輸入
   - 如果檢測到高風險內容，直接阻止請求
   - 記錄審計日誌（即使被阻止）
   - 返回友好的錯誤消息

2. **輸出檢測**: 檢查 AI 響應
   - 如果檢測到高風險內容，不返回原始響應
   - 返回通用的安全響應（提供心理健康資源）
   - 記錄審計日誌

**安全響應示例**:
- 中文: "我理解你正在經歷困難。請記住，你並不孤單。如果你正在考慮傷害自己或他人，請立即聯繫專業心理健康服務或緊急服務。"
- 英文: "I understand you are going through a difficult time. Please remember you are not alone. If you are considering harming yourself or others, please contact professional mental health services or emergency services immediately."

## 二、審計日誌

### 1. 數據庫表結構

**表名**: `ai_audit_logs`

**字段**:
- `id`: UUID 主鍵
- `user_id`: 用戶 ID（外鍵）
- `api_endpoint`: API 端點
- `model_name`: 模型名稱
- `request_timestamp`: 請求時間
- `prompt_tokens`: Prompt token 數量
- `completion_tokens`: Completion token 數量
- `total_tokens`: 總 token 數量
- `response_length`: 響應長度
- `was_truncated`: 是否被截斷
- `truncation_reason`: 截斷原因
- `response_category`: 響應分類
- `risk_level`: 風險等級（low/medium/high）
- `security_check_passed`: 安全檢測是否通過
- `detected_keywords`: 檢測到的關鍵詞數組
- `input_summary`: 輸入摘要（僅存儲情緒類型和強度，不存儲完整描述）
- `input_length`: 輸入長度
- `language`: 語言
- `error_message`: 錯誤消息（如果有）
- `created_at`: 創建時間

### 2. 審計日誌記錄

**實現位置**: `supabase/functions/_shared/auditLogger.ts`

**功能**:
- `logAuditEvent()`: 記錄審計日誌
- `extractTokenUsage()`: 從 AI 響應中提取 token 使用信息
- `checkTruncation()`: 檢查響應是否被截斷

**記錄時機**:
- 每次 AI API 調用後記錄
- 即使請求被安全檢測阻止，也會記錄
- 記錄所有錯誤情況

### 3. 數據隱私保護

- **不存儲完整用戶描述**: 只存儲摘要（情緒類型和強度）
- **RLS 策略**: 用戶只能查看自己的審計日誌
- **敏感信息過濾**: 檢測到的關鍵詞會被記錄，但不會存儲完整的敏感內容

## 三、API Key Rotation

### 1. 數據庫表結構

**表名**: `api_keys`

**字段**:
- `id`: UUID 主鍵
- `key_name`: Key 名稱（唯一）
- `key_value_encrypted`: 加密存儲的 API key
- `is_active`: 是否活躍
- `rotation_schedule_days`: 輪換週期（天數，默認 90 天）
- `last_rotated_at`: 上次輪換時間
- `next_rotation_at`: 下次輪換時間
- `created_at`: 創建時間
- `updated_at`: 更新時間

### 2. API Key 管理

**實現位置**: `supabase/functions/_shared/apiKeyRotation.ts`

**功能**:
- `getActiveApiKey()`: 獲取當前活躍的 API key
  - 優先從數據庫獲取（支持 rotation）
  - 如果數據庫獲取失敗，回退到環境變數
- `checkAndRotateApiKey()`: 檢查並觸發 API key 輪換
  - 檢查是否到了輪換時間
  - 更新輪換時間（實際輪換需要管理員手動執行）
- `initializeApiKey()`: 初始化 API key

### 3. 使用方式

**當前實現**:
- 支持從環境變數獲取（向後兼容）
- 支持從數據庫獲取（需要配置 `SUPABASE_SERVICE_ROLE_KEY`）

**輪換流程**:
1. 系統自動檢查輪換時間
2. 如果到了輪換時間，標記需要輪換
3. 管理員手動創建新 key 並更新配置
4. 系統切換到新 key
5. 禁用舊 key

**注意**: 
- API key 加密存儲需要服務端密鑰解密
- 在實際生產環境中，建議使用密鑰管理服務（如 AWS KMS、Azure Key Vault）

## 四、使用示例

### 1. 運行數據庫遷移

```bash
# 應用審計日誌表遷移
supabase migration up 20250116000000_create_audit_logs

# 應用 API keys 表遷移
supabase migration up 20250116000001_create_api_keys_table
```

### 2. 配置環境變數

```bash
# Supabase Edge Function 環境變數
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # 用於 API key rotation
LOVABLE_API_KEY=your_lovable_api_key  # 向後兼容，如果數據庫中沒有配置
```

### 3. 初始化 API Key（可選）

如果需要使用數據庫存儲的 API key，可以通過 Edge Function 或管理腳本初始化：

```typescript
import { initializeApiKey } from './_shared/apiKeyRotation.ts';

// 注意：key_value_encrypted 需要先加密
await initializeApiKey(
  supabase,
  'lovable_api_key',
  encryptedKey,  // 需要先加密
  90  // 90 天輪換一次
);
```

### 4. 查看審計日誌

```sql
-- 查看用戶的審計日誌
SELECT * FROM ai_audit_logs 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC;

-- 查看高風險請求
SELECT * FROM ai_audit_logs 
WHERE risk_level = 'high' 
ORDER BY created_at DESC;

-- 查看被阻止的請求
SELECT * FROM ai_audit_logs 
WHERE security_check_passed = false 
ORDER BY created_at DESC;
```

## 五、安全最佳實務

1. **定期審查審計日誌**: 檢查高風險請求和異常模式
2. **定期輪換 API keys**: 建議每 90 天輪換一次
3. **監控關鍵詞檢測**: 關注檢測到的關鍵詞趨勢
4. **保護服務端密鑰**: 使用安全的密鑰管理服務
5. **限制審計日誌訪問**: 只有授權管理員可以訪問完整日誌
6. **定期更新關鍵詞列表**: 根據實際情況更新危機關鍵詞

## 六、注意事項

1. **關鍵詞檢測**: 當前的關鍵詞列表是基礎版本，可能需要根據實際使用情況擴展
2. **API Key 加密**: 當前實現中，API key 的加密/解密需要額外實現（建議使用密鑰管理服務）
3. **性能影響**: 安全檢測和審計日誌記錄會增加少量延遲，但影響很小
4. **誤報處理**: 如果出現誤報，可以通過審計日誌分析並調整關鍵詞列表

## 七、未來改進

1. **機器學習分類**: 使用 ML 模型進行更準確的響應分類
2. **動態關鍵詞更新**: 支持從配置中動態加載關鍵詞
3. **實時監控告警**: 當檢測到高風險內容時發送告警
4. **用戶反饋機制**: 允許用戶報告誤報，用於改進檢測算法

