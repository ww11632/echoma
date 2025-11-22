# 🎨 Visual Assets Guide for Echoma

> **為評審者和用戶提供視覺化資料的製作指南**

---

## 📊 需要製作的視覺資產

### 1. **架構流程圖** ✅ 已完成
- 📄 文件：`ARCHITECTURE_VISUAL.md`
- 🎨 風格：Mermaid 圖表
- 📍 用途：技術架構說明

### 2. **Demo 操作流程** ✅ 已完成
- 📄 文件：`DEMO_FLOW.md`
- 🎨 風格：Mermaid 序列圖 + 流程圖
- 📍 用途：5 分鐘演示腳本

### 3. **README 插圖** ✅ 已完成
- 📄 文件：`README.md` / `README.zh.md`
- 🎨 風格：簡潔的 Mermaid 圖表
- 📍 用途：快速理解核心流程

---

## 🎬 建議製作：Demo 動畫/GIF

### 方案 A：Screen Recording → GIF

#### 工具推薦：
1. **macOS**: QuickTime Player + Gifski
   ```bash
   # 安裝 Gifski
   brew install gifski
   
   # 錄製螢幕（QuickTime Player）
   # 1. 打開 QuickTime Player
   # 2. 文件 → 新增螢幕錄製
   # 3. 錄製 Echoma 操作流程
   # 4. 儲存為 demo.mov
   
   # 轉換為 GIF
   gifski --fps 10 --quality 90 --output demo.gif demo.mov
   ```

2. **跨平台**: OBS Studio + FFmpeg
   ```bash
   # 安裝 FFmpeg
   brew install ffmpeg
   
   # 使用 OBS 錄製
   # 錄製後轉換為 GIF
   ffmpeg -i demo.mp4 -vf "fps=10,scale=1280:-1:flags=lanczos" -c:v gif demo.gif
   ```

#### 錄製腳本（20 秒）：
```
[0-3秒]   打開 Echoma → 連接錢包
[3-6秒]   撰寫日記 → 點擊加密（顯示參數）
[6-9秒]   上傳到 Walrus（顯示 Blob ID）
[9-12秒]  鑄造 NFT（交易確認動畫）
[12-15秒] 創建 Seal Policy
[15-18秒] 授權朋友訪問
[18-20秒] 時間線視圖（情感分析）
```

#### GIF 優化：
```bash
# 使用 gifsicle 優化文件大小
brew install gifsicle
gifsicle -O3 --lossy=80 -o demo-optimized.gif demo.gif
```

---

### 方案 B：動畫視頻（專業版）

#### 工具推薦：
1. **After Effects** - 專業動畫製作
2. **Figma + Principle** - 快速原型動畫
3. **Lottie** - Web 動畫（JSON 格式）

#### 動畫腳本：
```javascript
// Lottie 動畫示例（可嵌入網頁）
{
  "scenes": [
    {
      "name": "Write Entry",
      "duration": 3,
      "animation": "fade-in-text"
    },
    {
      "name": "Encrypt",
      "duration": 3,
      "animation": "lock-icon-rotate"
    },
    {
      "name": "Upload",
      "duration": 3,
      "animation": "cloud-upload"
    },
    {
      "name": "Mint NFT",
      "duration": 3,
      "animation": "blockchain-confirm"
    }
  ]
}
```

---

## 🖼️ 靜態圖片資源

### 1. **架構圖（High-Resolution）**

#### 建議工具：
- **Excalidraw** - 手繪風格圖表
- **Figma** - 專業 UI 設計
- **draw.io** - 流程圖製作

#### 建議尺寸：
```
- 橫幅圖：1920×1080 (16:9)
- 正方形：1080×1080 (1:1)
- 豎版圖：1080×1920 (9:16)
```

#### 導出格式：
```bash
# PNG（透明背景）
- 解析度：@2x (Retina)
- 壓縮：TinyPNG / ImageOptim

# SVG（向量圖）
- 適用於：Logo, Icons
- 可無損縮放
```

---

### 2. **UI 截圖（Feature Highlights）**

#### 需要截圖的頁面：
1. ✅ **首頁** - 雙語 UI 切換
2. ✅ **日記編輯器** - 加密狀態顯示
3. ✅ **時間線** - 虛擬滾動效果
4. ✅ **NFT 詳情** - 鏈上數據展示
5. ✅ **Seal Policy** - 訪問控制界面
6. ✅ **情感分析** - AI 洞察面板

#### 截圖規範：
```
尺寸：1920×1080（桌面版）或 375×812（移動版）
格式：PNG（@2x）
背景：實際 UI 或 Mockup 設備框架
```

#### 工具推薦：
- **Cleanshot X** (macOS) - 專業截圖工具
- **Shottr** (macOS) - 免費輕量級
- **ShareX** (Windows) - 開源工具

---

## 📐 設計系統（Stripe/Notion 風格）

### 配色方案：

```css
/* Echoma Brand Colors */
:root {
  /* Primary */
  --primary-red: #ff6b6b;      /* Encryption */
  --primary-blue: #4c6ef5;     /* Storage */
  --primary-purple: #845ef7;   /* Blockchain */
  --primary-orange: #f59f00;   /* Access Control */
  --primary-green: #20c997;    /* Success */
  
  /* Neutrals */
  --gray-50: #f8f9fa;
  --gray-100: #f1f3f5;
  --gray-900: #212529;
  
  /* Semantic */
  --success: #51cf66;
  --warning: #ffd43b;
  --error: #ff6b6b;
}
```

### 字體系統：

```css
/* Headings */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
font-weight: 600-800;

/* Body */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
font-weight: 400;

/* Code */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

### 圖標系統：

```
推薦：Lucide Icons（與現有 UI 一致）
風格：2px stroke, rounded corners
尺寸：16px, 20px, 24px, 32px
```

---

## 🎥 Demo 視頻製作指南

### 短視頻版本（10-20 秒）

#### 目標平台：
- Twitter/X
- LinkedIn
- GitHub README

#### 視頻規格：
```
解析度：1920×1080 (1080p)
幀率：30fps
格式：MP4 (H.264)
文件大小：< 10MB
```

#### 製作流程：
1. **腳本撰寫** - 參考 `DEMO_FLOW.md`
2. **螢幕錄製** - OBS Studio / QuickTime
3. **剪輯** - DaVinci Resolve / iMovie
4. **添加字幕** - 關鍵技術點標註
5. **導出優化** - HandBrake 壓縮

#### 字幕模板：
```srt
1
00:00:00,000 --> 00:00:03,000
📝 Write Entry

2
00:00:03,000 --> 00:00:06,000
🔐 Encrypt with Argon2id (64MB)

3
00:00:06,000 --> 00:00:09,000
☁️ Upload to Walrus

4
00:00:09,000 --> 00:00:12,000
⛓️ Mint NFT on Sui

5
00:00:12,000 --> 00:00:15,000
🔐 Create Seal Policy

6
00:00:15,000 --> 00:00:18,000
✅ Dynamic Access Control
```

---

### 長視頻版本（3-5 分鐘）

#### 目標平台：
- YouTube
- Bilibili
- 產品展示頁

#### 視頻結構：
```
[0:00-0:30]   開場 - 問題陳述
              "傳統日記的隱私問題"

[0:30-1:30]   解決方案 - Echoma 介紹
              "客戶端加密 + 去中心化存儲"

[1:30-3:30]   功能演示
              - 撰寫加密
              - NFT 鑄造
              - Seal Policies
              - 時間線分析

[3:30-4:30]   技術亮點
              - Argon2id 詳解
              - Walrus 存儲
              - Sui 集成

[4:30-5:00]   結尾 - Call to Action
              "立即體驗 Echoma"
```

---

## 📦 資產交付清單

### 必備資產：
- [x] ✅ `ARCHITECTURE_VISUAL.md` - 架構圖
- [x] ✅ `DEMO_FLOW.md` - 演示腳本
- [x] ✅ `README.md` - 更新插圖
- [ ] 🎬 `demo.gif` - 操作演示 GIF
- [ ] 🎥 `demo-short.mp4` - 短視頻（20秒）
- [ ] 📸 `screenshots/` - UI 截圖集

### 可選資產：
- [ ] 🎥 `demo-full.mp4` - 完整演示（3-5分鐘）
- [ ] 📊 `infographics/` - 信息圖表
- [ ] 🎨 `brand-kit/` - 品牌資源包
- [ ] 📱 `mockups/` - 設備樣機圖

---

## 🚀 快速開始

### 1. 製作 Demo GIF（最快方案）

```bash
# 1. 安裝工具
brew install gifski

# 2. 錄製螢幕（使用 QuickTime 或 OBS）
# 保存為 demo.mov

# 3. 轉換為 GIF
gifski --fps 10 --quality 90 --width 1280 --output public/demo.gif demo.mov

# 4. 優化文件大小
brew install gifsicle
gifsicle -O3 --lossy=80 -o public/demo-optimized.gif public/demo.gif

# 5. 更新 README
echo "![Echoma Demo](./public/demo-optimized.gif)" >> README.md
```

### 2. 截取關鍵截圖

```bash
# 創建截圖目錄
mkdir -p public/screenshots

# 命名規範
# - home-view.png
# - entry-editor.png
# - timeline-view.png
# - nft-details.png
# - seal-policy.png
# - emotion-analysis.png
```

### 3. 更新 README 插圖

```markdown
## 🎬 Demo

![Echoma Demo](./public/demo-optimized.gif)

## 📸 Screenshots

<div align="center">
  <img src="./public/screenshots/home-view.png" width="45%" />
  <img src="./public/screenshots/entry-editor.png" width="45%" />
</div>

<div align="center">
  <img src="./public/screenshots/timeline-view.png" width="45%" />
  <img src="./public/screenshots/nft-details.png" width="45%" />
</div>
```

---

## 🎯 Stripe/Notion 風格參考

### Stripe 風格特點：
- ✅ 簡潔的線條
- ✅ 清晰的層次
- ✅ 適當的留白
- ✅ 品牌色點綴
- ✅ 專業的代碼示例

### Notion 風格特點：
- ✅ 柔和的色彩
- ✅ 圓角設計
- ✅ 卡片式布局
- ✅ 清晰的 Icon
- ✅ 友好的插圖

### Echoma 應用：
```
採用：
- Stripe 的專業感（技術文檔）
- Notion 的親和力（用戶指南）
- 加入 Web3 元素（區塊鏈、加密）
```

---

## 📊 性能優化

### 圖片優化：

```bash
# PNG 優化
brew install pngquant
pngquant --quality=80-90 --output optimized.png original.png

# JPEG 優化
brew install jpegoptim
jpegoptim --max=85 --strip-all image.jpg

# WebP 轉換（現代瀏覽器）
brew install webp
cwebp -q 85 image.png -o image.webp
```

### 響應式圖片：

```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <source srcset="image.jpg" type="image/jpeg">
  <img src="image.jpg" alt="Echoma Demo" loading="lazy">
</picture>
```

---

## ✅ 檢查清單

### 視覺資產完成度：
- [x] ✅ 架構流程圖
- [x] ✅ Demo 操作流程
- [x] ✅ README 插圖
- [ ] ⏳ Demo GIF/視頻
- [ ] ⏳ UI 截圖集
- [ ] ⏳ 品牌資源包

### 質量檢查：
- [ ] 所有圖片已優化（< 500KB）
- [ ] 支持 Retina 顯示（@2x）
- [ ] 移動端適配
- [ ] 深色模式兼容
- [ ] 可訪問性（Alt Text）

---

**下一步：** 根據此指南製作 Demo GIF 和 UI 截圖，完成視覺資產交付。

🎨 Design | 📊 Visualize | 🚀 Showcase

