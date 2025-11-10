# Echoma - 情感加密鏈

> 你的情感，加密並永久保存在鏈上

Echoma 是一個基於 Web3 的情感記錄應用，結合了客戶端加密、去中心化儲存和區塊鏈驗證，為你的情感數據提供隱私保護和永久儲存。

## ✨ 核心特性

- 🔒 **客戶端加密** - 使用 AES-GCM 加密，數據在離開設備前就已加密
- 🌊 **Walrus 儲存** - 去中心化、可驗證的儲存方案
- ⛓️ **Sui 區塊鏈** - NFT 形式的鏈上驗證證明
- 🤖 **AI 輔助分析** - 智能情感分析和分類
- 📊 **時間線視圖** - 可視化你的情感歷程

## 🚀 快速開始

### 前置要求

- Node.js 18+ 和 npm（推薦使用 [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) 安裝）
- Sui 錢包（如 Sui Wallet 或 Ethos Wallet）

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

### 其他工具
- **React Router** - 路由管理
- **TanStack Query** - 數據獲取和狀態管理
- **React Hook Form** - 表單處理
- **Zod** - 數據驗證

## 📁 項目結構

```
src/
├── components/          # React 組件
│   ├── ui/             # shadcn/ui 組件
│   └── WalletConnect.tsx
├── hooks/              # 自定義 React Hooks
├── lib/                # 工具函數和核心邏輯
│   ├── encryption.ts   # 客戶端加密功能
│   ├── walrus.ts       # Walrus 儲存集成
│   └── utils.ts        # 通用工具函數
├── pages/              # 頁面組件
│   ├── Index.tsx       # 首頁
│   ├── Record.tsx      # 情感記錄頁面
│   ├── Timeline.tsx    # 時間線頁面
│   └── NotFound.tsx   # 404 頁面
└── App.tsx             # 應用入口
```

## 🔐 安全特性

### 客戶端加密

所有情感數據在離開設備前使用 **AES-GCM 256 位加密**：

- 使用 PBKDF2 密鑰派生（100,000 次迭代）
- 隨機初始化向量 (IV) 和鹽值
- 基於用戶錢包地址生成加密密鑰

### 數據流程

1. **記錄** - 用戶輸入情感和描述
2. **加密** - 客戶端使用 AES-GCM 加密數據
3. **儲存** - 加密數據上傳到 Walrus 去中心化儲存
4. **驗證** - 在 Sui 區塊鏈上鑄造 NFT 作為儲存證明

## 🌐 網路配置

當前配置為 **Sui Testnet**：

- Sui RPC: `getFullnodeUrl("testnet")`
- Walrus Upload Relay: `https://upload-relay.testnet.walrus.space`
- Walrus Aggregator: `https://aggregator.testnet.walrus.space`

可在 `src/App.tsx` 中修改網路配置。

## 📝 使用說明

### 記錄情感

1. 連接 Sui 錢包
2. 選擇情感類型（喜悅、悲傷、憤怒等）
3. 調整強度滑塊（0-100%）
4. 輸入描述文字
5. 點擊「記錄並鑄造 NFT」

### 查看時間線

在時間線頁面可以查看所有已記錄的情感快照，包括：
- 情感類型和強度
- 記錄時間
- Walrus 儲存 ID
- 區塊鏈驗證狀態

## 🚧 開發計劃

- [ ] 實現 Sui Move 合約用於 NFT 鑄造
- [ ] 添加情感數據解密和查看功能
- [ ] 實現數據導出功能
- [ ] 添加情感趨勢分析圖表
- [ ] 支持多鏈網路切換

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 許可證

本項目為 Haulout Hackathon 參賽作品。

## 🔗 相關連結

- [Sui 區塊鏈文檔](https://docs.sui.io/)
- [Walrus 儲存文檔](https://docs.walrus.space/)
- [shadcn/ui 文檔](https://ui.shadcn.com/)

---

**注意**: 本項目目前處於開發階段，部分功能（如 NFT 鑄造）尚未完全實現。
