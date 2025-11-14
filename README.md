# Echoma - 情感加密鏈

> 你的情感，加密並永久保存在鏈上

Echoma 是一個基於 Web3 的情感記錄應用，結合了客戶端加密、去中心化儲存和區塊鏈驗證，為你的情感數據提供隱私保護和永久儲存。

## ⚠️ 重要聲明

**Echoma 僅提供情感記錄與一般性支持，不能替代專業醫療建議。**

本應用程式旨在幫助用戶記錄和追蹤情感狀態，但不提供醫療診斷、治療建議或緊急醫療服務。如有心理健康或醫療需求，請尋求專業醫療人員的協助。

## ✨ 核心特性

- 🔒 **客戶端加密** - 使用 AES-GCM 加密，數據在離開設備前就已加密
- 🌊 **Walrus 儲存** - 去中心化、可驗證的儲存方案
- ⛓️ **Sui 區塊鏈** - NFT 形式的鏈上驗證證明
- 🤖 **AI 輔助分析** - 智能情感分析和溫暖回應（支持中英文）
- 📊 **時間線視圖** - 可視化你的情感歷程
- 🌍 **多語言支持** - 支持繁體中文和英文切換
- 👤 **多種模式** - 匿名模式、認證模式和 MVP 本地模式

## 📱 iOS App 支持

Echoma 現在支持打包成 iOS 原生應用！使用 **Capacitor** 框架，可以將 Web 應用轉換為 iOS app。

### 快速開始 iOS 開發

1. **升級 Node.js**（需要 >= 20.0.0）：
   ```bash
   nvm install 20
   nvm use 20
   ```

2. **構建並添加 iOS 平台**：
   ```bash
   npm run build
   npm run cap:add:ios
   ```

3. **在 Xcode 中打開**：
   ```bash
   npm run cap:open:ios
   ```

詳細說明請查看 [iOS 開發指南](./IOS_開發指南.md)

## 🚀 快速開始

### 前置要求

- Node.js 18+ 和 npm（推薦使用 [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) 安裝）
- Sui 錢包（如 Sui Wallet 或 Ethos Wallet）
- iOS 開發需要：Node.js 20+、Xcode 14+、CocoaPods

### 安裝步驟

```sh
# 1. 克隆倉庫
git clone <YOUR_GIT_URL>
cd echoma

# 2. 安裝依賴
npm install

# 3. 啟動開發伺服器
npm run dev
```

應用將在 `http://localhost:5173` 啟動。

### 構建生產版本

```sh
# 構建生產版本
npm run build

# 預覽生產構建
npm run preview
```

### iOS 開發命令

```sh
# 添加 iOS 平台（首次）
npm run cap:add:ios

# 同步 Web 構建到 iOS 項目
npm run cap:sync

# 打開 Xcode 項目
npm run cap:open:ios

# 一鍵構建、同步並打開 Xcode
npm run cap:build:ios
```

## 🛠️ 技術棧

### 前端框架
- **React 18** - UI 框架
- **TypeScript** - 類型安全
- **Vite** - 構建工具和開發伺服器

### UI 組件
- **shadcn/ui** - 高質量 UI 組件庫
- **Tailwind CSS** - 實用優先的 CSS 框架
- **Radix UI** - 無樣式、可訪問的組件原語
- **Lucide React** - 圖標庫

### Web3 集成
- **@mysten/dapp-kit** - Sui 區塊鏈集成
- **@mysten/sui** - Sui SDK
- **@mysten/walrus** - Walrus 儲存 SDK

### 後端服務
- **Supabase** - 用戶認證和雲端存儲
- **Supabase Edge Functions** - AI 情感分析服務
- **Express** - 本地開發伺服器

### 其他工具
- **React Router** - 路由管理
- **TanStack Query** - 數據獲取和狀態管理
- **React Hook Form** - 表單處理
- **Zod** - 數據驗證
- **i18next** - 國際化支持
- **Capacitor** - 跨平台原生應用框架
- **date-fns** - 日期處理

## 📁 項目結構

```
echoma/
├── src/
│   ├── components/          # React 組件
│   │   ├── ui/             # shadcn/ui 組件
│   │   ├── WalletConnect.tsx
│   │   └── LanguageSwitcher.tsx
│   ├── hooks/              # 自定義 React Hooks
│   ├── lib/                # 工具函數和核心邏輯
│   │   ├── encryption.ts   # 客戶端加密功能
│   │   ├── securityTests.ts # 安全測試套件
│   │   ├── securityTests.worker.ts # Web Worker（CPU 密集型測試）
│   │   ├── walrus.ts       # Walrus 儲存集成
│   │   ├── storageService.ts  # 存儲服務抽象層
│   │   ├── localIndex.ts   # 本地索引服務
│   │   └── utils.ts        # 通用工具函數
│   ├── pages/              # 頁面組件
│   │   ├── Index.tsx       # 首頁
│   │   ├── Record.tsx      # 匿名模式記錄頁面
│   │   ├── Timeline.tsx    # 匿名模式時間線
│   │   ├── Auth.tsx        # 認證頁面
│   │   ├── AuthRecord.tsx  # 認證模式記錄頁面
│   │   ├── AuthTimeline.tsx # 認證模式時間線
│   │   ├── MvpRecord.tsx   # MVP 本地記錄頁面
│   │   ├── MvpTimeline.tsx # MVP 本地時間線
│   │   ├── SecurityTests.tsx # 安全測試頁面（開發環境）
│   │   └── NotFound.tsx   # 404 頁面
│   ├── i18n/               # 國際化配置
│   │   ├── config.ts
│   │   └── locales/        # 語言文件
│   ├── integrations/       # 第三方集成
│   │   └── supabase/       # Supabase 客戶端
│   └── App.tsx             # 應用入口
├── server/                 # 本地開發伺服器
│   └── index.js
├── supabase/               # Supabase 配置
│   ├── functions/          # Edge Functions
│   │   ├── ai-emotion-response/  # AI 情感分析
│   │   ├── get-emotions/   # 獲取情感記錄
│   │   └── upload-emotion/ # 上傳情感記錄
│   └── migrations/         # 數據庫遷移
├── benchmarks/             # 測試基準數據
│   └── schema/            # JSON Schema
│       └── security.v1.json # 安全測試輸出 Schema
└── public/                 # 靜態資源
```

## 🔐 安全特性

Echoma 採用多層安全防護，保護用戶數據和隱私：

### 客戶端加密

所有情感數據在離開設備前使用 **AES-GCM 256 位加密**，採用業界最佳實踐：

#### 加密算法
- **AES-GCM 256 位**：提供加密和認證（防止篡改）
- **版本化加密頭**：支持未來算法升級和向後兼容
- **嚴格驗證**：Salt ≥16 bytes，IV = 12 bytes（AES-GCM 要求）

#### 密鑰派生（KDF）
- **PBKDF2**（當前默認）：
  - 根據設備性能自動調整迭代次數（100k - 1M）
  - 支持手動配置迭代次數
  - 使用 SHA-256 哈希算法
- **Argon2id**（預留接口）：
  - 記憶體硬成本，抗 GPU/ASIC 攻擊
  - 當前因構建限制暫時回退到增強 PBKDF2
  - 未來將完整集成

#### 密鑰生成安全
- ⚠️ **安全警告**：不建議僅基於錢包地址生成密鑰（低熵）
- ✅ **推薦做法**：使用用戶密碼/短語 + 確定性 salt
- ✅ **Salt 管理**：
  - **加密時**：每條記錄使用唯一的隨機 salt（≥16 bytes）
  - **密鑰生成時**：使用確定性 salt（基於應用+用戶標識），確保相同輸入產生相同密鑰
- ✅ **Domain Separation**：地址僅用於域分離，不作為主要熵源

#### 錯誤處理
- **明確的錯誤分類**：區分密鑰錯誤、數據損壞、版本不兼容等
- **AES-GCM 認證標籤驗證**：嚴格檢查數據完整性
- **用戶友好的錯誤提示**：提供具體的失敗原因和解決建議
- **國際化錯誤消息**：所有錯誤提示支持多語言（繁體中文/英文）
- **存儲配額管理**：當本地存儲空間不足時，提供清晰的提示和解決方案

#### 本地存儲加密
- **全模式加密**：所有本地存儲數據（包括匿名模式和 MVP 模式）均使用 AES-GCM 256 位加密
- **智能密鑰管理**：
  - 錢包模式：基於錢包地址派生密鑰
  - 認證模式：基於 Supabase 用戶 ID 派生密鑰
  - 匿名模式：基於匿名 UUID 派生密鑰
- **數據完整性保護**：
  - 防止數據丟失：保存前驗證可解密性，無法解密時阻止保存
  - 智能數據遷移：支持賬戶切換時的數據自動遷移和合併
  - 密鑰緩存優化：減少重複計算，提升性能
- **向後兼容**：自動遷移舊的未加密本地數據到加密存儲

### 數據流程

1. **記錄** - 用戶輸入情感和描述
2. **加密** - 客戶端使用 AES-GCM 加密數據（帶版本化頭）
3. **儲存** - 加密數據上傳到 Walrus 去中心化儲存
4. **驗證** - 在 Sui 區塊鏈上鑄造 NFT 作為儲存證明

### 向後兼容性

- 支持自動遷移舊格式加密數據
- 版本化加密頭確保未來算法升級時仍可解密舊數據
- 舊數據可無縫解密，無需用戶操作

### AI 安全防護

針對 AI 情感分析功能，實現了完整的安全防護機制：

#### Prompt Injection 防護
- ✅ **輸入清理**：自動移除常見的 prompt injection 模式
- ✅ **最小化上下文**：只傳遞必要的情緒信息，避免敏感字段暴露
- ✅ **輸出分類**：自動分類 AI 響應（支持性文本、建議、危機提示）

#### 危機檢測與安全卡控
- ✅ **關鍵詞檢測**：檢測自伤/他伤相關關鍵詞（支持中英文）
- ✅ **本地端安全卡控**：檢測到高風險內容時，不發送到模型或返回安全響應
- ✅ **安全響應**：提供專業心理健康資源指引

#### 審計日誌
- ✅ **完整記錄**：記錄所有 AI API 調用（時間、用戶、token 花費、截斷長度）
- ✅ **安全檢測結果**：記錄響應分類、風險等級、檢測到的關鍵詞
- ✅ **隱私保護**：只存儲輸入摘要（情緒類型、強度），不存儲完整描述

#### API Key 管理
- ✅ **Key Rotation**：支持定期輪換 API keys（默認 90 天）
- ✅ **安全存儲**：API keys 加密存儲在數據庫
- ✅ **自動檢查**：自動檢查輪換時間並提醒

詳細的安全功能說明請參閱 [SECURITY_FEATURES.md](./SECURITY_FEATURES.md)

### 安全測試套件

Echoma 實現了完整的安全測試套件，確保加密機制的正確性和安全性：

#### 測試覆蓋範圍
- ✅ **密碼學向量測試**：Tag 篡改、IV 重用、Header 竄改、AAD 驗證、定時側通道檢查等
- ✅ **參數回放測試**：跨設備加密/解密兼容性驗證
- ✅ **UTF-8 邊界測試**：Unicode 正規化、複雜字符處理
- ✅ **Rate Limit 測試**：限流機制、429 header 驗證、Replay 防護
- ✅ **JWT 刷新平滑度測試**：會話刷新期間的平滑過渡驗證

#### 測試特性
- 🔄 **可重現性**：支持 SEED 參數，確保測試結果可重現
- 📊 **可量測性**：標準化 JSON 輸出，支持 CI 自動化驗收
- 🔍 **可審計性**：完整的錯誤碼對照表、驗收標準、統計學指標
- 🛡️ **生產級可信度**：覆蓋邊界情況、非預期成功告警、JSON Schema 驗證

#### 訪問安全測試頁面
- **開發環境**：自動啟用 `/security-tests` 路由
- **生產環境**：需設置 `VITE_ENABLE_SECURITY_TESTS=true` 和 `VITE_FORCE_ENABLE_SECURITY_TESTS=true`（強制保護）

詳細的安全測試說明請參閱 [安全測試說明.md](./安全測試說明.md)

### 安全審計

詳細的安全最佳實踐檢查報告請參閱 [SECURITY_BEST_PRACTICES.md](./SECURITY_BEST_PRACTICES.md)

- ✅ **設計原則對齊 NIST/OWASP 建議，已覆蓋核心控制項**，細節見 SECURITY_BEST_PRACTICES.md
- ✅ 核心加密機制遵循業界最佳實踐
- ✅ 完善的錯誤處理和向後兼容性
- ✅ AI 安全防護機制完整實現
- ✅ **完整的安全測試套件**：可重現、可量測、可審計
- ⚠️ Argon2id 集成進行中（當前使用增強 PBKDF2 作為補償）

## 🌐 網路配置

當前配置為 **Sui Testnet**：

- Sui RPC: `getFullnodeUrl("testnet")`
- Walrus Upload Relay: `https://upload-relay.testnet.walrus.space`
- Walrus Aggregator: `https://aggregator.testnet.walrus.space`

可在 `src/App.tsx` 中修改網路配置。

### ⚠️ Walrus Aggregator 已知問題

**重要提示**：雖然你的資料在鏈上（SuiScan 可以看到），但 Walrus aggregator 暫時無法提供下載服務。這是 testnet 的已知問題。

- 資料已成功上傳到鏈上，可以在 SuiScan 查看
- 由於 Walrus aggregator 的限制，暫時無法從 aggregator 下載資料
- 在 Anonymous Mode 的時間線中，如果解密失敗，系統會自動顯示此提示

### 📅 Walrus 儲存期限（Epochs）

在 Anonymous Mode 記錄情緒時，你可以選擇資料在 Walrus Testnet 上的儲存期限：

- **Epoch 說明**：1 epoch ≈ 1 天（testnet）
- **可選範圍**：1-1000 epochs
- **預設值**：200 epochs（約 200 天）
- **快速選擇**：提供 5、200、365 epochs 快速按鈕
- **自訂數值**：可使用滑塊選擇任意 1-1000 之間的數值

**注意**：
- Epochs 值越大，資料儲存時間越長，但可能需要更多代幣
- 選擇的 epochs 值會直接影響 Walrus 上傳的成本
- 建議根據實際需求選擇合適的儲存期限

## 💧 獲取測試代幣

使用 Walrus 上傳需要 **SUI** 和 **WAL** 測試代幣：

### SUI 代幣
- **官方水龍頭**：https://faucet.sui.io/ （推薦）
- **社群水龍頭**：https://faucet.blockbolt.io/
- **Sui Discord**：在 `#testnet-faucet` 頻道使用 `!faucet <地址>`

### WAL 代幣
- **Walrus CLI**：`walrus get-wal`（使用 SUI 以 1:1 比例兌換）
- **Stakely 水龍頭**：https://stakely.io/faucet/walrus-testnet-wal

詳細說明請查看 [Faucet_獲取測試代幣.md](./Faucet_獲取測試代幣.md)

## 📝 使用說明

### 三種使用模式

Echoma 提供三種不同的使用模式，滿足不同需求：

#### 1. 匿名模式（Wallet Mode）
- **路由**: `/record` 和 `/timeline`
- **特點**: 使用 Sui 錢包連接，數據加密後上傳到 Walrus
- **適用**: 想要去中心化存儲，不需要登入的用戶
- **步驟**:
  1. 連接 Sui 錢包
  2. 選擇情感類型和強度
  3. 輸入描述文字
  4. 選擇 Walrus 儲存方式（而非本地儲存）
  5. **選擇儲存期限（Epochs）**：可選擇 1-1000 epochs（1 epoch ≈ 1 天）
     - 預設值：200 epochs（約 200 天）
     - 快速選擇按鈕：5、200、365 epochs
     - 或使用滑塊自訂數值
  6. 點擊「記錄並鑄造 NFT」
- **注意**: 如果解密失敗，系統會提示：雖然你的資料在鏈上（SuiScan 可以看到），但 Walrus aggregator 暫時無法提供下載服務。這是 testnet 的已知問題

#### 2. 認證模式（Secure Mode）
- **路由**: `/auth-record` 和 `/auth-timeline`
- **特點**: 需要 Supabase 帳號登入，支持雲端備份和 AI 情感分析
- **適用**: 需要跨設備訪問和 AI 輔助分析的用戶
- **步驟**:
  1. 在首頁點擊「登入 / 註冊」
  2. 創建或登入 Supabase 帳號
  3. 記錄情感時可獲取 AI 回應
  4. 數據會同步到雲端

#### 3. MVP 模式（Local Mode）
- **路由**: `/mvp` 和 `/mvp-timeline`
- **特點**: 完全本地存儲，無需錢包或登入，適合快速測試
- **適用**: 想要快速體驗或離線使用的用戶
- **步驟**:
  1. 直接訪問 `/mvp` 頁面
  2. 選擇情感和輸入描述
  3. 數據加密後保存在瀏覽器本地存儲（AES-GCM 256 位加密）
- **安全特性**:
  - ✅ 所有本地數據均使用 AES-GCM 256 位加密
  - ✅ 自動密鑰管理（基於錢包地址、Supabase 用戶 ID 或匿名 ID）
  - ✅ 數據完整性保護（防止數據丟失和損壞）
  - ✅ 智能密鑰恢復（支持賬戶切換時的數據遷移）

### 查看時間線

在時間線頁面可以查看所有已記錄的情感快照，包括：
- 情感類型和強度
- 記錄時間
- Walrus 儲存 ID（匿名模式）
- 區塊鏈驗證狀態
- AI 回應（認證模式）

#### 解密功能
- **自動解密**：本地存儲的記錄會自動解密並顯示
- **一鍵解密**：對於 Walrus 儲存的記錄，提供「一鍵解密」按鈕批量解密所有記錄
- **智能提示**：解密失敗時會顯示友好的錯誤提示和解決建議
- **Walrus 狀態提示**：如果 Walrus Testnet Aggregator 不穩定，會自動顯示提示信息

### AI 情感分析

在認證模式下，輸入情感描述後可以獲取 AI 回應：
- 溫暖、同理心的情感支持
- 適度的開放式問題引導
- 支持繁體中文和英文
- 基於 Lovable API 實現

## 🚧 開發計劃

### ✅ 已完成
- [x] MVP 核心功能（本地存儲模式）
- [x] 客戶端加密功能（AES-GCM 256 位）
- [x] **本地存儲加密**（所有模式均支持加密本地存儲）
- [x] **數據完整性保護**（防止數據丟失和損壞）
- [x] **智能密鑰管理**（支持賬戶切換時的數據遷移）
- [x] **一鍵解密功能**（批量解密 Walrus 記錄）
- [x] **國際化錯誤處理**（所有錯誤消息支持多語言）
- [x] 版本化加密頭和向後兼容性
- [x] 可配置 PBKDF2（設備自適應迭代次數）
- [x] 增強的安全驗證（Salt/IV 長度檢查）
- [x] 改進的錯誤處理和用戶提示
- [x] Walrus 儲存集成
- [x] Supabase 認證和雲端存儲
- [x] AI 情感分析功能
- [x] AI 安全防護（Prompt Injection 防護、危機檢測）
- [x] 審計日誌系統（記錄所有 AI API 調用）
- [x] API Key Rotation 機制
- [x] 多語言支持（繁體中文/英文）
- [x] iOS 應用支持（Capacitor）
- [x] 多種使用模式（匿名/認證/MVP）
- [x] 完整的安全測試套件（可重現、可量測、可審計）

### 🚧 進行中 / 計劃中
- [ ] 完整集成 Argon2id 支持（當前回退到增強 PBKDF2）
- [ ] 實現用戶密碼/短語輸入界面（提升密鑰安全性）
- [ ] 實現 Sui Move 合約用於 NFT 鑄造
- [ ] 添加情感數據解密和查看功能
- [ ] 實現數據導出功能
- [ ] 添加情感趨勢分析圖表
- [ ] 支持多鏈網路切換
- [ ] 實時安全監控告警系統
- [ ] 動態關鍵詞列表更新機制

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 許可證

本項目為 Haulout Hackathon 參賽作品。

## 🔗 相關連結

- [Sui 區塊鏈文檔](https://docs.sui.io/)
- [Walrus 儲存文檔](https://docs.walrus.space/)
- [shadcn/ui 文檔](https://ui.shadcn.com/)
- [安全功能說明](./SECURITY_FEATURES.md) - AI 安全防護、審計日誌、API key rotation
- [安全最佳實踐](./SECURITY_BEST_PRACTICES.md) - 加密機制安全審計報告
- [安全測試說明](./安全測試說明.md) - 完整的安全測試套件文檔（可重現、可量測、可審計）

## 🔧 環境變數配置

如需使用認證模式和 AI 功能，需要配置以下環境變數：

```env
# Supabase 配置
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Supabase Edge Functions 需要配置
LOVABLE_API_KEY=your_lovable_api_key  # 用於 AI 情感分析（向後兼容）
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # 用於 API key rotation 和審計日誌（可選）
```

**注意**：
- `LOVABLE_API_KEY` 可直接從環境變數讀取（向後兼容）
- 如需使用 API key rotation 功能，需要配置 `SUPABASE_SERVICE_ROLE_KEY`
- 審計日誌功能需要運行數據庫遷移（見下方）
- **安全測試頁面**：開發環境自動啟用，生產環境需設置 `VITE_ENABLE_SECURITY_TESTS=true` 和 `VITE_FORCE_ENABLE_SECURITY_TESTS=true`（強制保護）

### CI 安全檢查

項目包含自動化 CI 檢查，防止安全測試旗標洩漏到生產環境：

- **檢查腳本**：`npm run ci:check-security-flags`
- **檢查範圍**：
  - `.env.example`：不應包含任何 `VITE_*SECURITY_TESTS*` 環境變數
  - `Dockerfile` / `docker-compose.yml`：不應包含安全測試相關的環境變數
  - 生產構建腳本：不應包含安全測試相關的環境變數
- **GitHub Actions**：`.github/workflows/security-check.yml` 會在 PR 和 push 時自動運行檢查

詳細說明請參閱 [安全測試說明.md](./安全測試說明.md) 中的「風險旗標掃描」章節。

### 數據庫遷移

啟用審計日誌和 API key rotation 功能需要運行以下遷移：

```bash
# 應用審計日誌表遷移
supabase migration up 20250116000000_create_audit_logs

# 應用 API keys 表遷移
supabase migration up 20250116000001_create_api_keys_table
```

詳細配置說明請查看 [SECURITY_FEATURES.md](./SECURITY_FEATURES.md)

---

**注意**: 本項目目前處於開發階段，部分功能（如 NFT 鑄造）尚未完全實現。MVP 核心功能已完全可用。
