# 快速设置主网 NFT Logo

## 目标
让主网上的 Move 合约 NFT 显示 Echoma logo 图片。

## 当前实现
代码已经实现了这个功能：
- ✅ 主网 NFT 会自动使用 `VITE_MAINNET_NFT_LOGO_URL` 环境变量中的 URL
- ✅ 如果未设置，会回退到 Walrus URL（向后兼容）
- ✅ 测试网继续使用 Walrus URL

## 快速设置步骤

### 方法 1: 使用 GitHub（推荐，最简单）

1. **将 logo 文件添加到仓库**
   ```bash
   # 确保 logo 文件在 public/ 目录
   git add public/echoma-logo.png
   git commit -m "Add Echoma logo for mainnet NFTs"
   git push
   ```

2. **获取 GitHub Raw URL**
   - 格式：`https://raw.githubusercontent.com/你的用户名/echoma/main/public/echoma-logo.png`
   - 或者使用 GitHub Pages（如果已启用）

3. **设置环境变量**
   
   创建或编辑 `.env` 文件：
   ```env
   VITE_MAINNET_NFT_LOGO_URL=https://raw.githubusercontent.com/你的用户名/echoma/main/public/echoma-logo.png
   ```

4. **重启开发服务器**
   ```bash
   npm run dev
   ```

### 方法 2: 直接修改代码（临时方案）

如果不想使用环境变量，可以直接修改 `src/lib/networkConfig.ts`：

```typescript
mainnet: {
  walrusUploadRelay: "https://upload-relay.mainnet.walrus.space",
  walrusAggregator: "https://aggregator.mainnet.walrus.space",
  nftLogoUrl: "https://raw.githubusercontent.com/你的用户名/echoma/main/public/echoma-logo.png", // 直接设置
},
```

### 方法 3: 使用其他服务

#### IPFS (Pinata)
1. 上传到 [Pinata](https://www.pinata.cloud/)
2. 获取 URL: `https://gateway.pinata.cloud/ipfs/Qm...`
3. 设置环境变量

#### CDN (Cloudflare/Vercel)
1. 上传到你的 CDN
2. 获取公开 URL
3. 设置环境变量

## 验证

1. **切换到主网**
   - 在应用右上角选择 "Mainnet"

2. **连接钱包**

3. **记录一条情绪并选择 "Mint as NFT"**

4. **检查 NFT**
   - 在 Sui Explorer 查看 NFT
   - 检查 `image_url` 字段是否指向你的 logo URL
   - NFT 应该显示 Echoma logo

## 注意事项

- ✅ Logo URL 必须是公开可访问的（不需要认证）
- ✅ 必须支持 HTTPS
- ✅ 建议使用永久链接（GitHub、IPFS 等）
- ✅ 确保返回正确的 Content-Type（image/png 或 image/svg+xml）
- ⚠️ 如果 URL 不可访问，NFT 可能无法显示图片

## 当前状态

- ✅ 代码已实现主网 logo 支持
- ⏳ 需要上传 logo 并设置 URL
- ⏳ 需要测试主网 NFT minting

## 测试清单

- [ ] Logo 文件已上传到公开可访问的位置
- [ ] `VITE_MAINNET_NFT_LOGO_URL` 环境变量已设置
- [ ] 开发服务器已重启
- [ ] 切换到主网测试
- [ ] 成功 mint 一个 NFT
- [ ] 在 Sui Explorer 验证 NFT 的 `image_url` 字段
- [ ] 确认 NFT 显示 Echoma logo

