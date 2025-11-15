# 安全測試套件說明

本安全測試套件涵蓋了以下五個關鍵安全測試場景：

## 1. 密碼學向量測試（AES-GCM）

測試 AES-GCM 加密的安全屬性，確保以下攻擊必須失敗。

**交叉驗證**：採用 Google Wycheproof AES-GCM 測例子集做交叉驗證（Apache-2.0 授權）。為避免上游更新造成測試抖動，已將使用到的案例固定成快照並隨 repo 發佈。

### 測試項目：
- **Tag 篡改測試**：修改認證標籤後，解密必須失敗，返回 `DATA_CORRUPTED` 錯誤
- **IV 重用測試**：重用初始化向量時，必須在加密階段被主動檢測並拒絕，返回 `IV_REUSE_BLOCKED` 錯誤
- **Header 竄改測試**：變更 schema/kdf/iterations/salt/iv/key_id 任一欄位，解密必須返回 `AAD_MISMATCH`（或底層 `DATA_CORRUPTED`）
- **Header 新增欄位測試**：新增非必要欄位 → 應 `AAD_MISMATCH`（防止「灰色新增欄位」悄悄繞過校驗）
- **Header 移除欄位測試**：移除必要欄位 → 應 `PARAM_MISMATCH` 或 `AAD_MISMATCH`
- **Header 鍵順序打亂測試**：打亂 Header 鍵順序（值不變），應仍能成功解密（驗證 Canonical JSON 序列化）
- **Canonical JSON 指紋一致性測試**：相同輸入在不同環境應產生完全一致的 Canonical JSON 和 SHA-256 指紋
- **非 12 bytes IV 測試**：非 12 bytes IV → 直接拒絕，返回 `PARAM_MISMATCH`
- **Base64URL Padding 一致性測試**：密文/IV/Salt 一律使用 Base64URL（無 padding，正則驗證 `^[A-Za-z0-9_-]*$`）；若偵測到標準 Base64 或混用 padding，返回 `PARAM_MISMATCH`；禁止使用 `atob/btoa` 原生 API
- **AAD 空字符串規格化測試**：若 AAD 為空則明確傳 `new Uint8Array(0)`，不可傳 `null/undefined`；空 AAD vs 未傳 AAD 不可視為等價
- **PBKDF2 迭代數過低測試**：迭代數 < 100,000 → 返回 `PARAM_MISMATCH`
- **PBKDF2 迭代數過高測試**：迭代數 > 2,000,000 → 返回 `PARAM_MISMATCH`
- **IV RNG 均勻性測試**：抽樣 10k 個 96-bit IV，檢查重複率 ~ 0（期望 2^-96 等級，實測應 0），和位元分佈（單比特偏差不顯著）
- **定時側通道檢查**：使用大量錯誤輸入確保回傳時間分佈差異不顯著（變異係數 < 50%）；對比 INVALID_KEY 與 DATA_CORRUPTED 的延遲分佈（目標 AUC ~ 0.5，輸出 `aucInvalidVsCorrupted`、`ks_p`、`ttest_p`）
- **截斷密文測試**：截斷密文（包括 tag）後，解密必須失敗，返回 `DATA_CORRUPTED` 錯誤

**Header 作為 AAD（Additional Authenticated Data）**：
版本化加密頭（除 ciphertext/tag 外的所有欄位）會作為 AES-GCM 的 AAD 一併驗證。這防止「換頭不換身」的替換攻擊，確保加密頭與密文的完整性綁定。

**Canonical AAD 規範**：
AAD 序列化必須可證明「唯一且穩定」。實作採用選項 B：使用 Canonical JSON（RFC8785 JCS）序列化 header，確保鍵順序、空白、數字格式化一致。這避免「鍵順序打亂導致驗證失敗」的問題。

### 預期結果：
所有篡改嘗試都應該導致解密失敗，並返回適當的錯誤類型（見下方「錯誤碼對照表」）。

### 加密頭範例

標準加密頭結構（Base64URL 編碼）：

```json
{
  "schema": 3,
  "kdf": "pbkdf2-sha256",
  "iterations": 300000,
  "salt_b64url": "2f3nR-7z...Q",
  "iv_b64url": "Q8r4y0...w",
  "key_id": "a1f0c9d2e74b8c10",
  "created_at": 1736764800
}
```

**二進位編碼規範**：
- 密文、IV、Salt 統一使用 **Base64URL** 編碼（無 padding）
- **不允許**標準 Base64 或混用 padding
- **禁止使用 `atob/btoa` 原生 API**（容易混出標準 Base64）
- **Base64URL 嚴格驗證**：正則 `^[A-Za-z0-9_-]*$`（空字串允許，長度另驗）
- 實作級驗證：`if (!B64URL_REGEX.test(s) || s.includes("=")) throw PARAM_MISMATCH;`
- 若偵測到 padding（=），在資料層 parse 時直接拒絕（`PARAM_MISMATCH`），不要幫忙自動修正
- CI grep 檢查：禁止 `atob/btoa` 在代碼中出現
- 建議：ESLint custom rule 禁止 `atob/btoa`
- 若偵測到混用編碼（例如前端用 Base64，後端用 Base64URL），返回 `PARAM_MISMATCH`
- 測試中會驗證編碼一致性

**IV 與 Tag 長度規範**：
- `iv.length === 12` bytes（AES-GCM 標準）
- `tagLength === 128` bits（AES-GCM 標準，硬限制）
- 不符合規範 → 直接拒絕，返回 `PARAM_MISMATCH`

**PBKDF2 邊界規範**：
- `PBKDF2.iterations` 必須滿足 `100,000 ≤ n ≤ 2,000,000`
- 超出範圍一律返回 `PARAM_MISMATCH`
- 防止 DoS/誤用

**重要說明 - IV 重用檢測機制**：
本套件的 IV 重用檢測為主動阻擋（由加密層維護 `keyId → IV` 集合），不是依賴解密時出錯。AES-GCM 本身無法自動告訴你「你重用了 IV」，因此我們在 `encryption.ts` 中實現了 session 級別的 IV registry。測試預期為：**加密步驟即報 `IV_REUSE_BLOCKED` 錯誤**，而不是等到解密階段才發現問題。

**keyId 定義與隱私保護**：
為避免 keyId 成為「跨紀錄可關聯」的永久指紋，keyId 的計算方式為：
```
keyId = first_128_bits(HKDF(KEK, info="echoma:keyid:v1:mode", salt=salt_keyid))
```
其中：
- `KEK` 為真正加密金鑰（從 password 派生）
- `salt_keyid` 為應用域分離常數（"echoma:keyid:salt:v1"）
- `mode` 為作用域（wallet/account/guest），避免跨身分模式關聯
- 使用 HKDF 而非直接 SHA-256(password)，避免離線字典攻擊

**作用域化**：
- `wallet`: "echoma:keyid:v1:wallet"
- `account`: "echoma:keyid:v1:account"  
- `guest`: "echoma:keyid:v1:guest"
- 相同 KEK 在不同 mode → keyId 必須不同（測試：`keyid_cross_mode_diff`）

**重要隱私聲明**：
- keyId 僅用於加密流程內部路由與 IV 重用檢測
- **禁止用於跨紀錄/跨使用者關聯分析**
- 若需持久化，應以 HKDF 再派生之指紋入庫（例如再做一次 HKDF），降低關聯性

**注意**：IV registry 是 session 級別的，在多分頁或重新整理後無法跨 session 檢測。此機制主要用於防止同一會話內的意外重用，跨 session 的檢測需要後端支持。

## 2. 參數回放測試

測試同一數據在不同設備配置下的加密和解密兼容性。

### 測試場景：
- **低端手機**：100,000 次 PBKDF2 迭代
- **中端手機**：300,000 次 PBKDF2 迭代
- **高端手機**：500,000 次 PBKDF2 迭代
- **桌機**：1,000,000 次 PBKDF2 迭代

### 測試內容：
1. 在不同設備上加密相同數據
2. 驗證加密參數（迭代數）正確保存
3. 跨設備解密：在設備 A 加密，在設備 B 解密

### 預期結果：
- 所有設備都能成功加密和解密
- 跨設備解密應該成功（使用相同的密碼和參數）

## 3. Base64/UTF-8 邊界測試

測試各種 Unicode 邊界情況，確保序列化/反序列化不破壞數據完整性。

### 測試用例：
- **Emoji**：大量 emoji 字符
- **合字（Ligatures）**：如 ﬁ, ﬂ, ﬀ 等
- **長文**：10KB 文本
- **混合 Unicode**：多種語言和字符集混合
- **零寬字符**：隱藏的控制字符
- **代理對（Surrogate Pairs）**：需要兩個 16 位單元表示的字符
- **組合字符**：帶聲調的字符

### 驗證方法：
1. 加密原始文本
2. JSON 序列化和反序列化
3. 解密並驗證（層級化比較，記錄失敗層級）：
   - **層級 1：字節長度比較** - 字節長度完全匹配
   - **層級 2：逐字節比較** - 逐字節比較完全一致
   - **層級 3：字符串比較** - 字符串內容完全相等
   - **層級 4：Unicode 正規化驗證** - `NFC(原文) === NFC(解密結果)`，避免 Unicode 正規化差異造成假陰性

**層級化比較說明**：
先比 bytes → 再比字串 → 最後比 NFC。在報告裡標註是哪一層 fail，定位更快。

**Unicode 正規化說明**：
有些來源會給 NFD（分解）字串，顯示一致但 bytes 不同。除逐字節比較外，另驗證 NFC（標準組合形式）相等，確保不會因為正規化差異而誤判為失敗。

### 預期結果：
所有測試用例都應該通過，確保數據在加密/解密和序列化過程中完全無損。驗收標準：**bytes 相等且 NFC 相等，0 容忍**。

## 4. Rate Limit 測試（瀏覽器探針版）

模擬高並發請求，測試限流機制的有效性和恢復能力。

**⚠️ 重要限制**：
此測試僅做健康探針，不代表後端實際吞吐。真實壓測請移至 Node/CI 環境，否則結果受瀏覽器併發限制與 CORS 影響，無法反映真實性能。

### 測試配置：
- **並發數**：20 個請求（瀏覽器端縮水版，真實壓測應在 Node/CI 環境進行）
- **發送方式**：在 1 秒內分 10 批發送（每批間隔 100ms）
- **目標端點**：AI 情緒響應端點（`/functions/v1/ai-emotion-response`）
- **取消支持**：使用 AbortController，可以隨時取消測試

### 測試內容：
1. 發送 20 個並發請求（瀏覽器端限制）
2. 統計：
   - 成功請求數（200 狀態碼）
   - 被限流請求數（429 狀態碼，返回 `RATE_LIMITED` 錯誤）
   - 認證錯誤數（401 狀態碼，返回 `UNAUTHORIZED` 錯誤）
   - 其他錯誤數
3. 等待 2 秒後測試恢復能力（單次請求應返回 200）

### 預期結果：
- **有效響應率**：`(200 + 429) / 有效響應 ≥ 60%`（無效響應不計入分母）
- **無效響應限制**：`無效響應 / 總請求 < 20%`（網路錯誤/超時/0/0 視為無效樣本，單獨統計）
- **恢復能力**：等待 2 秒後單次請求應返回 200
- **驗收標準**：`(200 + 429) / 有效響應 ≥ 0.6` 且 `無效響應 < 20%`，且恢復測試通過

**容錯說明**：
把成功判定改成「(200 + 429) / 有效響應 ≥ 0.6」；把 0/0、網路錯誤視為「無效樣本」單獨統計，避免在離線環境誤判失敗。

## 5. JWT 會話刷新平滑度測試

測試 JWT 會話刷新期間的平滑過渡，確保不會出現「斷崖式」成功率下降。

**注意**：API Key Rotation 測試已移至後端/CI 環境，不應在前端暴露。

### 測試場景：
- **測試時長**：5 秒
- **測試間隔**：每 100ms 測試一次請求
- **目標端點**：AI 情緒響應端點（使用當前會話的 JWT）
- **時鐘偏移容忍**：行動裝置可能有 clock skew；結果 JSON 記錄伺服器 Date，允許 ±60s 容忍，降低誤報

### 測試方法：
1. 在測試期間持續發送請求
2. 每 100ms 測試一次請求（使用當前會話的 JWT）
3. 記錄每個時間點的成功率
4. 分析成功率變化曲線

### 驗證標準：
- **不應有斷崖**：五點滑動視窗的最大差分 ≤ 0.5（避免單點雜訊觸發 cliff）
- **應平滑過渡**：成功率應該逐漸變化（標準差 < 0.25）
- **最小成功率**：過渡期間最小成功率應 ≥ 60%
- **連續失敗限制**：1 秒視窗（10 次測試）內連續失敗 ≤ 5 次

### 預期結果：
- `hasCliff = false`：沒有檢測到斷崖式下降（五點滑動視窗檢測）
- `isSmooth = true`：過渡平滑
- `minSuccessRate ≥ 0.6`：最小成功率大於等於 60%
- `stddev < 0.25`：標準差小於 0.25
- `maxConsecutiveFails ≤ 5`：1 秒視窗內連續失敗不超過 5 次

**驗收標準**：`minSuccessRate ≥ 0.6`、無 cliff（五點滑動視窗）、標準差 < 0.25、連續失敗 ≤ 5（1 秒視窗）

## 安全改進（2025-01）

### 重要安全改進

1. **路由守衛**：安全測試頁面只在開發環境（`import.meta.env.DEV`）或設置 `VITE_ENABLE_SECURITY_TESTS=true` 時才可用，避免在正式環境暴露壓測入口。

2. **IV 重用檢測**：在 `encryption.ts` 中實現了 session 級別的 IV registry，主動檢測並拒絕 IV 重用，防止安全漏洞。

3. **Rate Limit 測試限制**：
   - 瀏覽器端只發送 20 個請求（小樣本探針）
   - 真實壓測應在 Node/CI 環境進行
   - 添加了 AbortController 支持，避免懸掛請求

4. **認證模型分離**：
   - 前端只測試 JWT 會話刷新平滑度
   - API Key Rotation 測試已移至後端/CI 環境
   - 不再在前端暴露 API Key rotation 邏輯

5. **Web Worker 支持**：創建了 `securityTests.worker.ts` 用於處理長時間/大量 CPU 的測試，避免阻塞主線程。

6. **UTF-8 測試增強**：新增了 ZWJ emoji、阿拉伯連寫、泰文附標、藏文、多層組合字符等邊界測試用例。

## 使用方法

### 1. 訪問測試頁面

**重要**：安全測試頁面只在以下情況下可用：
- 開發環境（`npm run dev`）
- 設置環境變量 `VITE_ENABLE_SECURITY_TESTS=true`

在瀏覽器中訪問：`/security-tests`

### 2. 登錄（可選，但建議）

**重要**：要運行完整的測試套件（包括 Rate Limit 和 JWT 會話刷新測試），需要先登錄 Supabase：

1. 訪問 `/auth` 頁面
2. 使用現有帳號登錄，或註冊新帳號
3. 登錄成功後，返回 `/security-tests` 頁面

**注意**：
- 前三個測試（密碼學向量、參數回放、UTF-8 邊界）**不需要登錄**即可運行
- 後兩個測試（Rate Limit、JWT 會話刷新）**需要登錄**才能運行
- 如果未登錄，後兩個測試會返回 401 認證錯誤（`UNAUTHORIZED`），這是預期的行為

### 3. 運行測試

點擊「運行所有測試」按鈕，系統將依次執行所有測試套件。

### 4. 查看結果

測試完成後，頁面會顯示：
- **測試匯總**：總體統計信息
- **各測試套件結果**：每個測試的詳細結果
- **通過/失敗狀態**：每個測試項的通過情況
- **詳細錯誤信息**：失敗測試的錯誤詳情

## 注意事項

1. **Rate Limit 測試**需要有效的 Supabase 認證會話。如果未登錄，該測試會返回 401 認證錯誤（這是預期的行為）。

2. **JWT 會話刷新測試**需要有效的 Supabase 認證會話。如果未登錄，該測試會返回 401 認證錯誤（這是預期的行為）。

3. **API Key Rotation 測試**已移至後端/CI 環境，不應在前端進行。後端測試會模擬雙讀期與快取 TTL 失效，前端僅顯示結果，不參與鍵值傳輸。

4. 某些測試（如 Rate Limit）可能會對服務器造成負載，建議在測試環境運行。

5. 測試結果會顯示在頁面上，可以複製 JSON 格式的詳細信息用於進一步分析。

6. **核心安全測試**（密碼學向量、參數回放、UTF-8 邊界）不需要登錄即可運行，這些測試驗證了加密系統的核心安全屬性。

## 技術實現

- **加密庫**：使用 Web Crypto API 實現 AES-GCM
- **測試框架**：自定義測試框架，支持異步測試和結果聚合
- **UI 組件**：使用 shadcn/ui 組件庫構建測試界面
- **Web Worker**：長時或大量 CPU 的測試（如批量 AES-GCM）在 Web Worker 執行；主執行緒僅負責渲染，避免 UI 掛起

## 文件結構

```
src/
├── lib/
│   ├── securityTests.ts           # 測試實現
│   ├── securityTests.worker.ts    # Web Worker（用於 CPU 密集型測試）
│   └── encryption.ts              # 加密實現（包含 IV 重用檢測）
└── pages/
    └── SecurityTests.tsx          # 測試 UI 頁面
```

## 環境變量

- `VITE_ENABLE_SECURITY_TESTS`：設置為 `"true"` 時，即使在生產環境也啟用安全測試頁面

  **⚠️ 風險警告**：此選項僅供短期排錯；長開於生產會暴露壓測入口，可能被濫用造成流量放大。建議只在開發環境使用，或設置後立即關閉。

- 默認情況下，只在開發環境（`import.meta.env.DEV`）啟用

## 錯誤碼對照表

本套件使用統一的錯誤碼，供前後端對齊：

| 錯誤碼 | 說明 | 常見場景 |
|--------|------|----------|
| `INVALID_KEY` | 密碼/派生參數不匹配 | PBKDF2 迭代數不同、密碼錯誤、KDF 參數不符 |
| `DATA_CORRUPTED` | 密文/認證標籤被竄改或截斷 | Tag 篡改、Base64 傳輸截斷、密文損壞 |
| `IV_REUSE_BLOCKED` | 檢測到同一 keyId 重用 IV，被主動阻止 | 重試重放舊 IV、加密階段檢測到重用 |
| `UNAUTHORIZED` | 缺少/過期 JWT | 未登入、會話過期、JWT 無效 |
| `RATE_LIMITED` | 觸發限流配額 | 高並發測試、超過速率限制 |
| `PARAM_MISMATCH` | Header 缺欄位或不合法 | 缺少 iv/salt/kdf/iterations、長度不符 |
| `AAD_MISMATCH` | AAD 驗證失敗 | Header 被竄改或與密文不一致 |

**注意**：
- `IV_REUSE_BLOCKED` 是在加密階段由 IV registry 主動檢測並拒絕的，不是解密時才發現
- `AAD_MISMATCH` 在解密階段由 AES-GCM 的 AAD 驗證機制檢測
- 其他錯誤碼通常在解密或 API 調用階段返回

## 測試驗收標準（CI 機械判斷）

以下標準用於 CI 自動化驗收，所有測試必須通過才能視為合格：

### 1. 密碼學向量測試
- **驗收標準**：100% 通過；任一項失敗即 Fail
- Tag 篡改測試：必須返回 `DATA_CORRUPTED`（含非預期成功告警）
- IV 重用測試：必須返回 `IV_REUSE_BLOCKED`（加密階段，含非預期成功告警）
- Header 竄改測試：必須返回 `AAD_MISMATCH` 或 `DATA_CORRUPTED`
- Header 新增欄位測試：必須返回 `AAD_MISMATCH`
- Header 移除欄位測試：必須返回 `PARAM_MISMATCH` 或 `AAD_MISMATCH`
- Header 鍵順序打亂測試：必須通過（Canonical JSON 序列化）
- Canonical JSON 指紋一致性測試：相同輸入必須產生完全一致的指紋
- 非 12 bytes IV 測試：必須返回 `PARAM_MISMATCH`
- Base64URL Padding 一致性測試：必須通過（無 padding，正則驗證）
- AAD 空字符串規格化測試：必須通過（明確傳 `new Uint8Array(0)`）
- PBKDF2 迭代數過低測試：必須返回 `PARAM_MISMATCH`
- PBKDF2 迭代數過高測試：必須返回 `PARAM_MISMATCH`
- IV RNG 均勻性測試：重複率 = 0，位元分佈無顯著偏差
- keyId 跨模式差異測試：必須通過（不同 mode 產生不同 keyId）
- 定時側通道檢查：AUC ≤ 0.6、ks_p ≥ 0.05、變異係數 < 50%
- 截斷密文測試：必須返回 `DATA_CORRUPTED`（含非預期成功告警）

### 2. 參數回放測試
- **驗收標準**：四檔迭代數（100k/300k/500k/1M）跨解密 100% 成功
- 所有設備配置都能成功加密和解密
- 跨設備解密必須成功

### 3. UTF-8 邊界測試
- **驗收標準**：bytes 相等且 NFC 相等，0 容忍
- 所有測試用例必須通過
- 字節級別完全匹配
- Unicode 正規化後完全匹配

### 4. Rate Limit 測試（瀏覽器探針版）

**Rate Probe 退化紅線（驗收門檻）**：
- `p95 ≤ 1500ms`（示例，依後端設定調整）
- `tailShare(>2000ms) ≤ 10%`
- `(200 + 429) / 有效響應 ≥ 60%`
- `無效響應 < 20%`
- `recovery200 = true`
- `headersOk = true`（429 必須帶 Retry-After 或 vendor header）
- `replayDedupOk = true`（Idempotency-Key 去重測試通過）
- 失敗直接視為退化，避免「200 但超慢」被誤判 OK

**429 Header 驗證**：
- 驗證 429 是否帶 `Retry-After`（秒或日期格式）或 vendor header（如 `X-RateLimit-Remaining` / `Reset`）
- `rateProbe.headersOk = true` 作為驗收的一部分

**Replay 防護實測**：
- 對相同 `Idempotency-Key` 的 3 次請求：僅允許一次成功，其餘應返回 409/專用錯誤
- `rateProbe.replayDedupOk = true`
- `dedupScope = "per-user-per-endpoint"`（去重範圍）
- `dedupTtlMs = 120000`（去重視窗：2 分鐘）
- **驗收標準**：`(200 + 429) / 有效響應 ≥ 0.6`；無效響應 < 20%；等待 2s 後單次請求 200 成功
- 有效響應率 ≥ 60%（無效響應不計入分母）
- 無效響應（網路錯誤/超時/0/0）< 20%
- 恢復測試必須通過

### 5. JWT 會話刷新平滑度測試

**JWT 平滑門檻（驗收標準）**：
- `minSuccessRate ≥ 0.6`
- 五點滑動視窗最大差分 ≤ 0.5
- `stddev < 0.25`
- 1 秒視窗 `maxConsecutiveFails ≤ 5`
- 刷新前後 1s 視窗的 4xx 比例 ≤ 10%
- 必須輸出 `skewMs`（伺服器日期回寫與客戶端差異：`serverNow - clientNow`，允許 ±60s 容忍）
- 必須輸出 `preRefreshSuccess`、`postRefreshSuccess`（刷新前後 500ms 視窗平均成功率）
- 必須輸出 `peak4xxWindow`（刷新前後 1s 內 4xx 峰值時間戳，方便對齊伺服器 log）
- 必須輸出 `retryAfterHeaders`（429/503 是否帶 Retry-After 或 RateLimit-Reset）
- **驗收標準**：`minSuccessRate ≥ 0.6`、無 cliff（五點滑動視窗）、標準差 < 0.25、連續失敗 ≤ 5（1 秒視窗）
- 最小成功率 ≥ 60%
- 無斷崖式下降（五點滑動視窗的最大差分 ≤ 0.5）
- 標準差 < 0.25
- 1 秒視窗（10 次測試）內連續失敗 ≤ 5

## 未來擴展注意事項

### Argon2id 支持
若日後切換到 Argon2id，需要：
1. 在「參數回放測試」新增 `kdf=argon2id` 情境
2. 在「密碼學向量測試」加入不同 KDF 混用情境（舊 PBKDF2 → 新 Argon2id）
3. 確保 Header 版本化能正確路由解密

### IV Registry 限制
- IV registry 是 session 級別的，在多分頁或重新整理後無法跨 session 檢測
- 跨 session 的 IV 重用檢測需要後端支持（建議在 Edge Function 層實現）

### Worker 壽命管理
- 測試結束/頁面離開時必須 `terminate()` worker 並清理 IV registry，防止記憶體殭屍
- 建議在 `useEffect` cleanup 函數中處理：

```typescript
useEffect(() => {
  return () => {
    if (worker) {
      worker.terminate();
    }
    // 清理 IV registry（如果需要）
  };
}, []);
```

### 重放防護（伺服器端）
- 對受保護端點以 `Replay-Nonce`（一次性、短時 TTL）或 `Idempotency-Key`（客戶端送）+ 伺服器去重
- 在探針裡驗證「重放 → 409/PARAM_MISMATCH/專用錯誤」
- 建議在 Rate Limit 測試中加入重放檢測

### 結構化審計欄位
在輸出 JSON/伺服器審計日誌都應包含：
- `request_id`：請求唯一標識
- `session_id`：會話標識
- `key_id_hash`：keyId 的二次衍生（HKDF 再派生），降低關聯性
- `rate_bucket`：限流桶標識
- 對齊排障流程

### 時間/隱私邊界
- `created_at` 可能成為側通道（重放/使用者活躍度推斷）
- 建議：時間戳取分鐘級四捨五入或以 server 時間回填
- 文檔註明此設計目的：降低時間粒度，減少側通道洩漏

### 可觀測性對齊
- 429/401/5xx 路徑加結構化欄位（審計欄位建議）
- 務必把 `request_id` 回傳到前端測試 JSON 裡，PR review 才能 1:1 對齊後端 log
- 輸出 JSON 應包含：`request_id`、`session_id`、`key_id_hash`（二次衍生）、`rate_bucket`

### 計時精度與校準
- 瀏覽器計時器常被降噪
- 跑 timing test 前先做自校準（空轉 N 次量測成熟延遲）
- 把 `baselineJitterMs` 記進報表，否則 AUC/KS 可能誤判

### UTF-8 最大長度保護
- 長文測到 10KB 沒問題，但實際上線最好也限制「單次解密最大 payload」（例如 1MB）
- 在文件標註最大長度，避免 OOM 類事故

### 環境旗標保護
- CI 加一條保護，禁止 `VITE_ENABLE_SECURITY_TESTS=true` 出現在 Dockerfile 或任何 prod build 命令
- 建議在 CI 中添加 grep 檢查

## 可重現性支持（SEED）

所有測試支持 SEED 參數，確保測試結果可重現：

- **設置 SEED**：在測試開始前調用 `setTestSeed(seed)`，所有隨機明文/IV/批次節奏都由種子驅動
- **記錄 SEED**：每次測試的 SEED 會記錄到結果 JSON 中
- **重放失敗用例**：使用相同的 SEED 可以一鍵重放失敗的測試用例

**使用方式**：
```typescript
import { setTestSeed } from '@/lib/securityTests';

// 設置固定 SEED（例如從失敗報告中獲取）
setTestSeed(1337);

// 運行測試（結果將完全可重現）
await runAllSecurityTests(...);
```

## 測試輸出格式（標準化 JSON）

每次前端探針與 CI 壓測輸出為統一 JSON 格式（例如 `benchmarks/security-<date>.json`），用於機械比對與趨勢分析：

```json
{
  "runId": "2025-11-13T03:21:45.123Z",
  "seed": 1337,
  "versions": { "app": "x.y.z", "kdf": "pbkdf2", "schema": 3 },
  "cryptoVectors": { "total": 24, "passed": 24, "failed": 0 },
  "utf8Edges": { 
    "cases": 12, 
    "bytesEqual": true, 
    "nfcEqual": true,
    "failureLevel": null
  },
  "paramReplay": { 
    "profiles": [100000, 300000, 500000, 1000000], 
    "crossDecryptOk": true 
  },
  "rateProbe": {
    "requested": 20, 
    "ok": 9, 
    "r429": 5, 
    "r401": 2, 
    "others": 0,
    "invalidResponses": 4,
    "netError": 2,
    "timeout": 2,
    "corsBlocked": 0,
    "p50": 180,
    "p95": 420,
    "tailShare": "0.050",
    "recovery200": true
  },
  "jwtSmooth": {
    "windowMs": 100, 
    "durationMs": 5000,
    "minSuccessRate": 0.78, 
    "stddev": 0.12,
    "hasCliff": false, 
    "maxConsecutiveFails": 2,
    "tokenRefreshObserved": true,
    "recoveryGapMs": 340,
    "preRefreshSuccess": 0.85,
    "postRefreshSuccess": 0.78
  }
}
```

此格式可用於：
- CI 自動化驗收
- 趨勢分析（在 README 放最近三次趨勢小圖）
- 儀表板顯示歷史對比

**JSON Schema 驗證**：
輸出 JSON 必須符合 `benchmarks/schema/security.v1.json` Schema。CI 使用 `ajv` 驗證，避免欄位漂移。

**非預期成功告警**：
在應該失敗的測試（如篡改、錯長度）若得到 200/解密成功，務必打紅燈並輸出「最小復現樣本」：`header`、`iv`、`ciphertext`、`SEED`。這對快速回歸極有用。

## 安全建議

### Content Security Policy (CSP)

建議為安全測試頁面設置嚴格的 CSP：

```
Content-Security-Policy: 
  script-src 'self'; 
  object-src 'none'; 
  base-uri 'self'; 
  connect-src 'self' https://*.supabase.co https://*.supabase.io;
  frame-ancestors 'none';
```

**重要提醒**：Supabase 區域子域不同需要同步更新 `connect-src`，避免誤判「網路錯誤」。例如：
- 美國區域：`https://*.supabase.co`
- 歐洲區域：`https://*.supabase.io`
- 其他區域：根據實際使用的 Supabase 專案區域調整

**Web Worker 與 WASM 支持**：
若使用 Web Worker 或 WASM，建議補充：
```
worker-src 'self' blob:;
connect-src 'self' https://*.supabase.co https://*.supabase.io;
```
如果有 WASM：`script-src 'self' 'wasm-unsafe-eval';`（僅在確需時開）

**COOP/COEP 建議**：
考慮設置 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`（COOP/COEP）以獲得更穩定的 worker/共享記憶體表現。

**重要**：把 COOP/COEP 只開在 `/security-tests` route（或獨立 origin），避免影響主應用第三方整合。

**Trusted Types + CSP 強化**：
若頁面有任何字串拼接到 DOM 的風險，建議開 `require-trusted-types-for 'script'` 並在測試頁使用自定義 policy；即便是內部工具頁，這能避免細節滑坡。

這可以防止測試頁被植入奇怪腳本，確保測試環境的安全性。

### 風險旗標掃描

在 CI 中已實現自動檢查，禁止以下旗標長駐在產線環境變數或 `.env.example`：

- `VITE_ENABLE_SECURITY_TESTS=true`
- `VITE_FORCE_ENABLE_SECURITY_TESTS=true`
- `console.profile`
- `debug_test=true`

**CI 檢查腳本**：
- 位置：`scripts/ci/check-security-flags.sh`
- GitHub Actions：`.github/workflows/security-check.yml`
- 檢查範圍：
  - `.env.example`：不應包含任何 `VITE_*SECURITY_TESTS*` 環境變數
  - `Dockerfile` / `Dockerfile.*`：不應包含安全測試相關的環境變數
  - `docker-compose.yml`：不應包含安全測試相關的環境變數
  - `package.json` 構建腳本：不應包含安全測試相關的環境變數
  - 所有 shell 腳本：不應設置 `VITE_*SECURITY_TESTS*=true`

**運行檢查**：
```bash
# 本地運行 CI 檢查
npm run ci:check-security-flags

# 或直接運行腳本
bash scripts/ci/check-security-flags.sh
```

**修復建議**：
1. 從 `.env.example` 中移除所有 `VITE_*SECURITY_TESTS*` 環境變數
2. 從 Dockerfile 和 docker-compose 文件中移除安全測試相關的環境變數
3. 從生產構建腳本中移除安全測試相關的環境變數
4. 安全測試頁面應僅在開發環境或特殊測試場景中使用

## 擴展測試

如需添加新的測試場景，可以在 `securityTests.ts` 中添加新的測試函數，並在 `runAllSecurityTests` 中調用。
