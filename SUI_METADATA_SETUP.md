# Sui Metadata 上鏈設置指南

## 概述

本系統實現了將情緒記錄的 metadata（blobId、hash、emotion、timestamp）上鏈到 Sui 區塊鏈的功能。

## 上鏈的數據

Sui 鏈上只存儲**公開的 metadata**，不包含敏感信息：
- `blobId`: Walrus blob ID（用於訪問加密數據）
- `payloadHash`: 加密數據的 SHA-256 哈希（用於驗證）
- `emotion`: 情緒類型（0-5 的數字）
- `timestamp`: Unix 時間戳（毫秒）

**不包含的敏感數據**：
- ❌ description（原始文字描述）
- ❌ aiResponse（AI 回饋）
- ❌ intensity（強度）
- ❌ 任何明文文本

## 部署步驟

### 1. 編譯 Move 合約

```bash
# 安裝 Sui CLI（如果還沒有）
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui

# 進入合約目錄
cd sui/contracts/emotion_metadata

# 編譯合約
sui move build
```

### 2. 部署到 Sui Testnet

```bash
# 設置環境變量（使用你的 Sui 錢包地址）
export SUI_ADDRESS=your_wallet_address

# 發布合約
sui client publish --gas-budget 100000000

# 記下返回的 Package ID，例如：
# Published Objects:
#   PackageID: 0x1234567890abcdef...
```

### 3. 配置環境變量

在項目根目錄創建 `.env` 文件（或更新現有的）：

```env
VITE_SUI_EMOTION_METADATA_PACKAGE_ID=0x1234567890abcdef...
```

### 4. 測試

1. 啟動應用程序
2. 連接 Sui 錢包
3. 記錄一個情緒
4. 選擇 Walrus 上傳
5. 確認錢包彈出兩個交易：
   - 第一個：Walrus 上傳
   - 第二個：Sui metadata 上鏈

## 合約結構

### EmotionMetadata 結構

```move
public struct EmotionMetadata has key, store {
    id: UID,
    blob_id: vector<u8>,      // Walrus blob ID
    payload_hash: vector<u8>, // SHA-256 hash
    emotion: u8,              // 0=joy, 1=sadness, 2=anger, 3=anxiety, 4=confusion, 5=peace
    timestamp: u64,           // Unix timestamp (milliseconds)
}
```

### 函數

- `create_metadata`: 創建並轉移 EmotionMetadata 對象給發送者

## 查詢鏈上數據

### 使用 Sui Explorer

1. 訪問 https://suiexplorer.com/
2. 輸入 metadata 對象 ID（從數據庫的 `sui_ref` 字段獲取）
3. 查看對象詳情

### 使用 Sui CLI

```bash
sui client object <OBJECT_ID>
```

## 注意事項

1. **Gas 費用**: 每次上鏈需要支付 Sui gas 費用
2. **網絡選擇**: 目前配置為 Sui Testnet，生產環境需要切換到 Mainnet
3. **錯誤處理**: 如果 Sui 上鏈失敗，不會影響 Walrus 上傳和本地存儲
4. **Package ID**: 部署後必須更新環境變量中的 Package ID

## 故障排除

### 錯誤：Sui package ID not configured

**解決方案**: 設置 `VITE_SUI_EMOTION_METADATA_PACKAGE_ID` 環境變量

### 錯誤：Failed to create metadata object on Sui

**可能原因**:
- Gas 不足
- 網絡連接問題
- 合約未正確部署

**解決方案**:
- 檢查錢包餘額
- 確認網絡連接
- 驗證 Package ID 是否正確

## 未來改進

- [ ] 支持批量上鏈（降低 gas 成本）
- [ ] 實現鏈上查詢功能
- [ ] 添加事件監聽（監聽 metadata 創建事件）
- [ ] 支持 Mainnet 部署

