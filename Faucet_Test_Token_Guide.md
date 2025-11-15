# Faucet - 獲取測試代幣指南

> 本文檔說明如何獲取 Sui Testnet 和 Walrus 測試代幣

## 🪙 需要的代幣

使用 Walrus 上傳數據需要兩種代幣：

1. **SUI** - 支付交易費用（gas）
2. **WAL** - 支付存儲費用

## 💧 Sui Testnet SUI 代幣

### 方法 1：官方水龍頭（推薦）

**網址**：https://faucet.sui.io/

**步驟**：
1. 訪問 https://faucet.sui.io/
2. 連接你的 Sui 錢包（如 Sui Wallet）
3. 選擇 **Testnet** 網絡
4. 點擊「Request SUI」按鈕
5. 等待代幣到賬（通常幾秒到幾分鐘）

### 方法 2：社群水龍頭

**Blockbolt 水龍頭**：https://faucet.blockbolt.io/

**步驟**：
1. 訪問 https://faucet.blockbolt.io/
2. 輸入你的 Sui 錢包地址或 SuiNS 名稱
3. 選擇 Testnet
4. 完成驗證（如需要）
5. 請求測試代幣

### 方法 3：Sui Discord

**步驟**：
1. 加入 [Sui Discord 伺服器](https://discord.com/invite/sui)
2. 前往 `#testnet-faucet` 頻道
3. 輸入以下指令：
   ```
   !faucet <你的錢包地址>
   ```
4. 例如：
   ```
   !faucet 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   ```

### 方法 4：使用 Sui CLI

**步驟**：
```bash
# 安裝 Sui CLI（如果還沒安裝）
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# 配置 Sui 客戶端連接到 testnet
sui client

# 從水龍頭獲取測試代幣
sui client faucet
```

## 🦭 Walrus WAL 代幣

### 方法 1：使用 Walrus CLI（推薦）

**步驟**：
```bash
# 安裝 Walrus CLI（如果還沒安裝）
# 請參考 Walrus 官方文檔

# 使用 SUI 代幣以 1:1 比例兌換 WAL 代幣
walrus get-wal

# 查看 WAL 餘額
sui client balance
```

**說明**：
- 需要先有 SUI 測試代幣
- 以 1:1 的比例將 SUI 兌換為 WAL
- 在 testnet 上，WAL 和 SUI 可以互換

### 方法 2：Stakely 水龍頭

**網址**：https://stakely.io/faucet/walrus-testnet-wal

**步驟**：
1. 訪問 https://stakely.io/faucet/walrus-testnet-wal
2. 輸入你的 Walrus 測試網地址（Sui 地址）
3. 完成驗證步驟（可能需要 Twitter 分享）
4. 提交請求
5. 等待代幣到賬

**注意**：
- 可能需要 Twitter 驗證
- 確保推文是公開的
- 可能需要等待一段時間

## 📝 建議流程

### 第一次使用

1. **獲取 SUI 代幣**
   - 訪問 https://faucet.sui.io/
   - 連接錢包並選擇 Testnet
   - 請求 SUI 代幣

2. **獲取 WAL 代幣**
   - 使用 Walrus CLI：`walrus get-wal`
   - 或使用 Stakely 水龍頭

3. **檢查餘額**
   - 在錢包中查看 SUI 和 WAL 餘額
   - 確保有足夠的代幣（建議至少 0.1 SUI 和 0.1 WAL）

### 代幣需求估算

**每次上傳大約需要**：
- **SUI**：約 0.001-0.01 SUI（gas 費用，取決於數據大小）
- **WAL**：取決於數據大小和存儲時長（epochs）

**建議餘額**：
- **SUI**：至少 0.1 SUI（足夠多次上傳）
- **WAL**：至少 0.1 WAL（足夠多次上傳）

## ⚠️ 注意事項

1. **測試代幣沒有實際價值**
   - 僅供開發和測試使用
   - 不能用於主網

2. **水龍頭限制**
   - 通常有請求頻率限制（如每 24 小時一次）
   - 不要濫用水龍頭

3. **網絡選擇**
   - 確保錢包連接到 **Testnet**
   - 不要使用 Mainnet 地址

4. **地址格式**
   - Sui 地址格式：`0x` 開頭，64 個十六進制字符
   - 例如：`0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

## 🔗 相關連結

- [Sui 官方水龍頭](https://faucet.sui.io/)
- [Sui 文檔 - 獲取代幣](https://docs.sui.io/guides/developer/getting-started/get-coins)
- [Sui Discord](https://discord.com/invite/sui)
- [Blockbolt 水龍頭](https://faucet.blockbolt.io/)
- [Stakely Walrus 水龍頭](https://stakely.io/faucet/walrus-testnet-wal)
- [Walrus 官方文檔](https://docs.wal.app/)

## 💡 常見問題

### Q: 為什麼需要兩種代幣？

A: 
- **SUI** 用於支付 Sui 區塊鏈的交易費用（gas）
- **WAL** 用於支付 Walrus 存儲服務的費用

### Q: 可以只用 SUI 嗎？

A: 在 testnet 上，可以使用 Walrus CLI 將 SUI 兌換為 WAL（1:1 比例）。

### Q: 水龍頭請求失敗怎麼辦？

A: 
1. 檢查網絡連接
2. 確認錢包地址正確
3. 確認選擇了 Testnet 網絡
4. 等待一段時間後重試
5. 嘗試其他水龍頭

### Q: 如何查看代幣餘額？

A: 
- 在 Sui Wallet 中查看
- 使用 Sui CLI：`sui client balance`
- 在 Sui Explorer 中查看你的地址

