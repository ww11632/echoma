# 加密機制說明

## 概述

本應用使用 **客戶端加密**（Client-Side Encryption）來保護用戶的情緒記錄。所有敏感數據在離開用戶設備之前就已經被加密。

## 加密流程

### 1. 加密算法

使用 **AES-GCM 256位加密**：
- **算法**：AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)
- **密鑰長度**：256 位（32 字節）
- **模式**：GCM 模式提供加密和認證

### 2. 密鑰生成

#### 方式 A：有錢包地址時
```typescript
// 使用 PBKDF2 從錢包地址派生密鑰
const userKey = await generateUserKey(walletAddress);
```

**過程**：
1. 使用錢包地址作為基礎材料
2. 使用應用特定的 salt：`"echoma_encryption_salt_v1"`
3. 使用 **PBKDF2** 進行密鑰派生：
   - 迭代次數：**100,000 次**
   - 哈希算法：**SHA-256**
   - 派生 256 位密鑰

#### 方式 B：匿名用戶（無錢包）
```typescript
// 使用隨機 UUID 作為密鑰
const randomKey = crypto.randomUUID();
```

### 3. 加密過程

```typescript
// 1. 生成隨機 Salt（16 字節）
const salt = crypto.getRandomValues(new Uint8Array(16));

// 2. 生成隨機 IV（初始化向量，12 字節）
const iv = crypto.getRandomValues(new Uint8Array(12));

// 3. 使用 PBKDF2 派生加密密鑰
const key = await deriveKey(password, salt.buffer);
// - 迭代次數：100,000
// - 哈希：SHA-256
// - 輸出：AES-256 密鑰

// 4. 使用 AES-GCM 加密數據
const encryptedBuffer = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv: iv,
  },
  key,
  encoder.encode(data)
);

// 5. 返回加密結果（Base64 編碼）
return {
  ciphertext: bufferToBase64(encryptedBuffer),  // 加密後的數據
  iv: bufferToBase64(iv.buffer),                // 初始化向量
  salt: bufferToBase64(salt.buffer),            // 鹽值
};
```

### 4. 加密數據結構

```typescript
interface EncryptedData {
  ciphertext: string;  // Base64 編碼的加密數據
  iv: string;          // Base64 編碼的初始化向量（12 字節）
  salt: string;        // Base64 編碼的鹽值（16 字節）
}
```

## 安全特性

### ✅ 已實現的安全措施

1. **客戶端加密**
   - 數據在離開瀏覽器前就已加密
   - 服務器無法看到明文內容

2. **強密鑰派生**
   - PBKDF2 使用 100,000 次迭代
   - 防止暴力破解攻擊

3. **隨機 Salt 和 IV**
   - 每次加密都使用新的隨機值
   - 相同內容加密後結果不同

4. **AES-GCM 模式**
   - 提供加密和認證
   - 防止數據被篡改

### ⚠️ 當前限制

1. **服務器端存儲**
   - 服務器端同時保存了未加密的 `description` 字段
   - 這是為了方便顯示，但降低了安全性
   - **建議**：服務器端不應保存明文描述

2. **密鑰管理**
   - 密鑰基於錢包地址派生，如果錢包丟失，數據無法恢復
   - 匿名用戶使用隨機密鑰，無法跨設備訪問

3. **本地存儲**
   - 當 API 失敗時，數據保存到 localStorage（未加密）
   - 這是臨時方案，不應長期使用

## 數據流程

### 記錄情緒時的流程

```
1. 用戶輸入描述
   ↓
2. 客戶端驗證和清理輸入
   ↓
3. 生成加密密鑰
   - 有錢包：從錢包地址派生
   - 無錢包：使用隨機 UUID
   ↓
4. 加密數據（AES-GCM）
   - 生成隨機 salt 和 IV
   - 使用 PBKDF2 派生密鑰
   - 加密數據
   ↓
5. 發送到服務器
   - encryptedData: JSON.stringify(EncryptedData)
   - description: 明文（用於顯示，應移除）
   ↓
6. 服務器保存
   - 保存 encryptedData 到 Walrus 或本地文件
   - 保存 description 到本地文件（應移除）
```

### 查看記錄時的流程

```
1. 從服務器獲取記錄
   ↓
2. 檢查 is_public 狀態
   ↓
3. 如果是公開記錄
   - 顯示 description（明文）
   ↓
4. 如果是私有記錄
   - 不顯示 description
   - 顯示"已加密保存"提示
   - （未來：需要解密才能查看）
```

## 改進建議

### 1. 移除服務器端明文存儲
```javascript
// 服務器端不應保存 description
const record = {
  // ... 其他字段
  // description,  // ❌ 移除這個
  encryptedData,  // ✅ 只保存加密數據
};
```

### 2. 實現解密功能
```typescript
// 在 Timeline 頁面添加解密按鈕
async function decryptDescription(record: EmotionRecord) {
  const encryptedData = JSON.parse(record.encryptedData);
  const userKey = await generateUserKey(currentAccount.address);
  const decrypted = await decryptData(encryptedData, userKey);
  return decrypted;
}
```

### 3. 改進密鑰管理
- 考慮使用密鑰派生函數（KDF）的改進版本
- 支持密鑰備份和恢復機制
- 支持多設備同步（需要安全的密鑰共享）

## 技術細節

### PBKDF2 參數
- **算法**：PBKDF2 (Password-Based Key Derivation Function 2)
- **迭代次數**：100,000
- **哈希函數**：SHA-256
- **輸出長度**：256 位

### AES-GCM 參數
- **算法**：AES (Advanced Encryption Standard)
- **模式**：GCM (Galois/Counter Mode)
- **密鑰長度**：256 位
- **IV 長度**：12 字節（96 位）
- **認證標籤**：16 字節（自動包含在 GCM 模式中）

### 編碼
- **輸入/輸出**：UTF-8 字符串
- **存儲格式**：Base64 編碼
- **傳輸格式**：JSON 字符串

## 參考資料

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [PBKDF2](https://en.wikipedia.org/wiki/PBKDF2)

