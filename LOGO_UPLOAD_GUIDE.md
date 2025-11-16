# Echoma Logo Upload Guide

本指南说明如何将 Echoma logo 上传到 Walrus Mainnet，以便在主网 NFT 中使用。

## 步骤

### 1. 准备 Logo 图片

将你的 Echoma logo 图片文件放在以下位置之一：
- 项目根目录：`echoma-logo.png` 或 `echoma-logo.svg`
- `public/` 目录：`public/echoma-logo.png` 或 `public/echoma-logo.svg`

支持的格式：
- PNG（推荐）
- SVG

### 2. 安装依赖（如果需要）

确保已安装 TypeScript 和 tsx：
```bash
npm install -D tsx typescript @types/node
```

### 3. 运行上传脚本

```bash
npx tsx scripts/upload-logo-to-walrus.ts
```

脚本会：
- 自动查找 logo 文件
- 上传到 Walrus Mainnet（存储 1000 epochs，约 1000 天）
- 输出 Walrus URL

### 4. 配置环境变量

脚本运行成功后，会输出一个 Walrus URL。将其添加到 `.env` 文件：

```env
VITE_MAINNET_NFT_LOGO_URL=https://aggregator.mainnet.walrus.space/v1/{blobId}
```

或者直接修改 `src/lib/networkConfig.ts`：

```typescript
mainnet: {
  walrusUploadRelay: "https://upload-relay.mainnet.walrus.space",
  walrusAggregator: "https://aggregator.mainnet.walrus.space",
  nftLogoUrl: "https://aggregator.mainnet.walrus.space/v1/{blobId}", // 你的 logo URL
},
```

### 5. 验证

1. 切换到主网
2. 连接钱包
3. 记录一条情绪并选择 "Mint as NFT"
4. 检查 NFT 的 image 字段是否显示 Echoma logo

## 注意事项

- **Testnet**: 继续使用 Walrus URL 作为 NFT 图片（向后兼容）
- **Mainnet**: 如果配置了 `nftLogoUrl`，使用 logo；否则回退到 Walrus URL
- Logo 存储在 Walrus Mainnet，确保有足够的 WAL 代币支付存储费用
- 存储期限为 1000 epochs（约 1000 天），之后需要续费

## 替代方案

如果 Walrus Mainnet 上传端点不可用（返回 404），你可以使用以下替代方案：

### 方案 1: 使用 IPFS（推荐）

1. 上传到 IPFS 服务（如 [Pinata](https://www.pinata.cloud/) 或 [Infura](https://www.infura.io/)）
2. 获取 IPFS URL，例如：`https://gateway.pinata.cloud/ipfs/Qm...`
3. 设置环境变量：
   ```env
   VITE_MAINNET_NFT_LOGO_URL=https://gateway.pinata.cloud/ipfs/Qm...
   ```

### 方案 2: 使用 CDN

1. 上传到 CDN 服务（如 Cloudflare、AWS S3、Vercel、GitHub Pages）
2. 获取公开 URL
3. 设置环境变量：
   ```env
   VITE_MAINNET_NFT_LOGO_URL=https://your-cdn.com/echoma-logo.png
   ```

### 方案 3: 使用 GitHub/GitLab

1. 将 logo 文件提交到仓库的 `public/` 目录
2. 如果使用 GitHub Pages，URL 会是：
   ```
   https://yourusername.github.io/echoma/echoma-logo.png
   ```
3. 或者使用 raw.githubusercontent.com：
   ```
   https://raw.githubusercontent.com/yourusername/echoma/main/public/echoma-logo.png
   ```

### 方案 4: 直接使用本地文件（开发环境）

对于开发环境，你可以使用相对路径或本地服务器：

```env
VITE_MAINNET_NFT_LOGO_URL=/echoma-logo.png
```

## 快速设置（如果 Walrus 不可用）

如果 Walrus Mainnet 上传失败，最快的方法是：

1. 将 logo 上传到任何公开可访问的地方（IPFS、CDN、GitHub 等）
2. 获取 URL
3. 直接设置环境变量或修改代码：

```env
# .env
VITE_MAINNET_NFT_LOGO_URL=https://your-image-url.com/echoma-logo.png
```

或者直接修改 `src/lib/networkConfig.ts`：

```typescript
mainnet: {
  walrusUploadRelay: "https://upload-relay.mainnet.walrus.space",
  walrusAggregator: "https://aggregator.mainnet.walrus.space",
  nftLogoUrl: "https://your-image-url.com/echoma-logo.png", // 直接设置 URL
},
```

**重要**: 确保 URL 是：
- ✅ 公开可访问的（不需要认证）
- ✅ 永久链接（不会过期）
- ✅ 支持 HTTPS
- ✅ 返回正确的 Content-Type（image/png 或 image/svg+xml）

