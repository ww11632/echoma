# iOS App 開發指南

## 📱 概述

Echoma 現在已經配置好使用 **Capacitor** 來打包成 iOS 原生應用。Capacitor 可以讓你的 React Web 應用在 iOS 設備上運行，同時保留所有現有的功能，包括 Web3 錢包連接。

## ✅ 已完成的配置

1. ✅ 安裝了 Capacitor 核心依賴和 iOS 平台
2. ✅ 創建了 `capacitor.config.ts` 配置文件
3. ✅ 更新了 `index.html` 添加移動端支持
4. ✅ 添加了 npm 腳本用於 iOS 開發

## 🔧 前置要求

### 1. Node.js 版本

**重要**：Capacitor CLI 需要 **Node.js >= 20.0.0**

檢查當前版本：
```bash
node --version
```

如果版本低於 20.0.0，請升級：
```bash
# 使用 nvm (推薦)
nvm install 20
nvm use 20

# 或使用 Homebrew (macOS)
brew install node@20
```

### 2. Xcode 和 iOS 開發工具

- **Xcode 14+** (從 App Store 安裝)
- **Xcode Command Line Tools**：
  ```bash
  xcode-select --install
  ```
- **CocoaPods** (iOS 依賴管理工具)：
  ```bash
  sudo gem install cocoapods
  ```

### 3. Apple Developer 帳號

- 用於在真實設備上測試
- 用於發布到 App Store
- 免費帳號也可以用於開發和測試

## 🚀 初始化 iOS 平台

### 步驟 1：構建 Web 應用

```bash
npm run build
```

### 步驟 2：添加 iOS 平台

```bash
npm run cap:add:ios
```

或者手動執行：
```bash
npx cap add ios
```

這會創建 `ios/` 目錄，包含完整的 Xcode 項目。

### 步驟 3：同步資源

每次構建後，需要同步到 iOS 項目：

```bash
npm run cap:sync
```

或者使用快捷命令（構建 + 同步 + 打開 Xcode）：
```bash
npm run cap:build:ios
```

## 📱 在 Xcode 中開發

### 打開項目

```bash
npm run cap:open:ios
```

或手動：
```bash
npx cap open ios
```

這會在 Xcode 中打開 `ios/App/App.xcworkspace`。

### 配置項目

1. **選擇開發團隊**：
   - 在 Xcode 中選擇項目
   - 進入 "Signing & Capabilities"
   - 選擇你的 Apple Developer 團隊

2. **配置 Bundle Identifier**：
   - 默認是 `com.echoma.app`
   - 可以在 `capacitor.config.ts` 中修改 `appId`

3. **選擇模擬器或設備**：
   - 在 Xcode 頂部選擇目標設備
   - 可以是 iOS 模擬器或連接的真實設備

### 運行應用

點擊 Xcode 中的 ▶️ 按鈕，或按 `Cmd + R`。

## 🔐 Web3 錢包連接注意事項

### 移動端錢包連接

在 iOS 上，Web3 錢包連接需要特殊處理：

1. **使用 Deep Linking**：
   - Sui 錢包（如 Sui Wallet）支持 `suiwallet://` 協議
   - 需要在 `Info.plist` 中配置 URL Schemes

2. **Universal Links**：
   - 可以配置 Universal Links 來處理錢包回調
   - 需要在 Apple Developer 後台配置 Associated Domains

3. **WebView 兼容性**：
   - Capacitor 使用 WKWebView
   - 確保錢包 SDK 支持 WKWebView

### 建議的錢包連接方案

1. **使用 WalletConnect**：
   - 如果 Sui 錢包支持 WalletConnect 協議
   - 可以通過二維碼掃描連接

2. **使用 Deep Link**：
   - 配置 `suiwallet://` URL Scheme
   - 在連接錢包時打開外部錢包應用

3. **內置錢包**：
   - 考慮集成支持 iOS 的錢包 SDK
   - 如 `@mysten/dapp-kit` 的移動端支持

## 📝 開發工作流程

### 日常開發

1. **修改代碼**：
   ```bash
   npm run dev  # 在瀏覽器中測試
   ```

2. **構建並同步**：
   ```bash
   npm run build
   npm run cap:sync
   ```

3. **在 Xcode 中運行**：
   ```bash
   npm run cap:open:ios
   # 然後在 Xcode 中點擊運行
   ```

### 快捷命令

```bash
# 一鍵構建、同步並打開 Xcode
npm run cap:build:ios
```

## 🎨 移動端適配

### 響應式設計

你的應用已經使用了 Tailwind CSS，應該已經有基本的響應式支持。但可能需要：

1. **觸摸優化**：
   - 確保按鈕大小至少 44x44 點（iOS 推薦）
   - 增加觸摸目標間距

2. **安全區域**：
   - 使用 `viewport-fit=cover`（已在 `index.html` 中配置）
   - 使用 CSS `safe-area-inset-*` 處理劉海屏

3. **狀態欄**：
   - 已在 Capacitor 配置中設置狀態欄樣式
   - 可以通過 `@capacitor/status-bar` 動態調整

### 原生功能集成

Capacitor 提供了許多原生插件：

- **@capacitor/app** - 應用生命週期、返回按鈕
- **@capacitor/haptics** - 觸覺反饋
- **@capacitor/keyboard** - 鍵盤事件
- **@capacitor/status-bar** - 狀態欄控制

可以在代碼中使用：

```typescript
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// 觸覺反饋
await Haptics.impact({ style: ImpactStyle.Medium });

// 監聽應用狀態
App.addListener('appStateChange', ({ isActive }) => {
  console.log('App state changed. Is active?', isActive);
});
```

## 🚢 發布到 App Store

### 準備工作

1. **更新版本號**：
   - 在 `package.json` 中更新版本
   - 在 Xcode 中更新 `CFBundleShortVersionString`

2. **配置 App Store Connect**：
   - 創建 App Store Connect 記錄
   - 準備應用截圖和描述
   - 配置隱私政策 URL

3. **構建歸檔**：
   - 在 Xcode 中選擇 "Product" > "Archive"
   - 上傳到 App Store Connect

### 審核注意事項

1. **Web3 功能說明**：
   - 在 App Store 描述中說明需要外部錢包
   - 說明區塊鏈相關功能

2. **隱私政策**：
   - 必須提供隱私政策 URL
   - 說明數據加密和存儲方式

3. **功能限制**：
   - 某些 Web3 功能可能需要特殊說明
   - 確保符合 App Store 審核指南

## 🐛 常見問題

### 問題 1：Node.js 版本過低

**錯誤**：`The Capacitor CLI requires NodeJS >=20.0.0`

**解決**：升級 Node.js 到 20.0.0 或更高版本

### 問題 2：CocoaPods 安裝失敗

**錯誤**：`pod install` 失敗

**解決**：
```bash
sudo gem install cocoapods
cd ios/App
pod install
```

### 問題 3：構建失敗

**錯誤**：Xcode 構建錯誤

**解決**：
1. 清理構建：`Product` > `Clean Build Folder` (Shift + Cmd + K)
2. 更新 CocoaPods：`cd ios/App && pod update`
3. 檢查簽名配置

### 問題 4：Web3 錢包無法連接

**解決**：
1. 檢查 URL Schemes 配置
2. 確保錢包應用已安裝
3. 檢查網絡連接（Testnet/Mainnet）

## 📚 相關資源

- [Capacitor 官方文檔](https://capacitorjs.com/docs)
- [Capacitor iOS 指南](https://capacitorjs.com/docs/ios)
- [Xcode 文檔](https://developer.apple.com/documentation/xcode)
- [App Store 審核指南](https://developer.apple.com/app-store/review/guidelines/)

## 🎯 下一步

1. ✅ 升級 Node.js 到 20.0.0+
2. ✅ 安裝 Xcode 和 CocoaPods
3. ✅ 運行 `npm run cap:add:ios`
4. ✅ 在 Xcode 中配置並運行
5. ✅ 測試 Web3 錢包連接
6. ✅ 優化移動端 UI/UX
7. ✅ 準備 App Store 發布

---

**提示**：如果遇到問題，請查看 Capacitor 官方文檔或提交 Issue。


