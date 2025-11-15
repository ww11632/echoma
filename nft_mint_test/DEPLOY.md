# 📦 部署 Move 合約到 Sui Testnet

## 前置要求

1. 安裝 Sui CLI
2. 配置 Sui 客戶端連接到 testnet
3. 確保錢包有足夠的 SUI 測試代幣（用於支付 gas）

## 步驟 1: 安裝和配置 Sui CLI

```bash
# 安裝 Sui CLI（如果還沒安裝）
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# 或者使用 Homebrew (macOS)
brew install sui

# 驗證安裝
sui --version
```

## 步驟 2: 配置 Sui 客戶端

```bash
# 初始化 Sui 客戶端（如果還沒初始化）
sui client

# 切換到 testnet
sui client switch --env testnet

# 查看當前配置
sui client active-env
sui client active-address
```

## 步驟 3: 獲取測試代幣

```bash
# 從水龍頭獲取測試代幣
sui client faucet

# 檢查餘額
sui client balance
```

或者訪問：https://faucet.sui.io/

## 步驟 4: 編譯合約

```bash
# 進入合約目錄
cd nft_mint_test

# 編譯合約
sui move build
```

## 步驟 5: 發布合約到 Testnet

```bash
# 發布合約（這會消耗 gas）
sui client publish --gas-budget 100000000

# 或者指定編譯後的 build 目錄
sui client publish --gas-budget 100000000 ./build/nft_mint_test
```

發布成功後，你會看到類似以下的輸出：

```
Published Objects:
  ┌──
  │ PackageID: 0x<新的 Package ID>
  │ Version: 1
  │ Digest: <digest>
  └──
```

## 步驟 6: 更新代碼中的 Package ID

發布成功後，**重要**：需要更新代碼中的 Package ID：

1. 更新 `src/lib/mintContract.ts` 中的 `PACKAGE_ID`
2. 更新 `nft_mint_test/README.md` 中的 Package ID

```typescript
// src/lib/mintContract.ts
const PACKAGE_ID = "0x<新的 Package ID>"; // 替換這裡
```

## 步驟 7: 驗證部署

```bash
# 檢查合約是否已部署
sui client object <Package ID>

# 或者使用瀏覽器查看
# https://suiexplorer.com/?network=testnet&object=<Package ID>
```

## 步驟 8: 測試合約

```bash
# 創建 Journal
sui client call \
  --package <Package ID> \
  --module diary \
  --function create_journal \
  --gas-budget 10000000

# 鑄造 NFT（需要先有 Journal ID）
sui client call \
  --package <Package ID> \
  --module diary \
  --function mint_entry \
  --args \
    0x<JOURNAL_ID> \
    5 \
    "測試記錄" \
    "test" \
    "https://example.com/image.png" \
    "image/png" \
    0x1234 \
    "" \
    "" \
    0x \
    0 \
  --gas-budget 10000000
```

## 故障排除

### 錯誤：Package not found
- 確認 Package ID 是否正確
- 確認網絡是否為 testnet
- 檢查合約是否真的已發布

### 錯誤：Insufficient gas
- 獲取更多測試代幣：`sui client faucet`
- 增加 gas budget

### 錯誤：Transaction failed
- 檢查瀏覽器控制台的詳細錯誤信息
- 確認所有參數格式正確
- 檢查合約代碼是否有問題

## 注意事項

1. **Package ID 是唯一的**：每次發布都會生成新的 Package ID
2. **不可升級**：如果使用 `publish` 而不是 `upgrade`，合約不可升級
3. **測試網數據會重置**：Testnet 可能會定期重置，需要重新部署

## 升級合約（如果已發布）

如果你需要升級已發布的合約：

```bash
# 需要 UpgradeCap ID（首次發布時會返回）
sui client upgrade \
  --upgrade-capability <UpgradeCap ID> \
  --gas-budget 100000000 \
  ./build/nft_mint_test
```

## 相關資源

- [Sui 官方文檔](https://docs.sui.io/)
- [Sui Explorer (Testnet)](https://suiexplorer.com/?network=testnet)
- [Sui Testnet Faucet](https://faucet.sui.io/)

