# 🔐 Seal Access Policies 部署前后对比

## 📊 核心差异总览

| 特性 | **当前系统** | **部署 Seal Policies 后** |
|------|------------|-------------------------|
| **访问控制位置** | 客户端（基于加密密钥） | 链上（智能合约） |
| **权限验证** | 尝试解密判断 | 链上查询验证 |
| **授权管理** | 无法动态授权 | 可授权/撤销其他地址 |
| **透明度** | 无法验证权限 | 链上可查访问策略 |
| **NFT 关联** | NFT 与策略分离 | NFT 与策略绑定 |

---

## 🔍 详细对比

### 1. 访问控制机制

#### 当前系统（客户端控制）

```typescript
// 当前：基于 isPublic 标志选择加密密钥
if (record.isPublic) {
  encryptionKey = PUBLIC_SEAL_KEY;  // 任何人都可以解密
} else {
  encryptionKey = generateUserKey(walletAddress);  // 只有用户自己可以解密
}
```

**特点：**
- ✅ 简单直接
- ✅ 无需链上交互
- ❌ 无法验证权限（只能尝试解密）
- ❌ 无法授权他人访问
- ❌ 无法在链上证明访问权限

#### 部署 Seal Policies 后（链上控制）

```typescript
// 部署后：链上记录访问策略
await mintEntryWithPolicy(
  journalId,
  moodScore,
  description,
  tags,
  imageUrl,
  imageMime,
  imageHash,
  audioUrl,
  audioMime,
  audioHash,
  audioDuration,
  isPublic,  // 这个标志会记录到链上
  policyRegistryId
);

// 链上验证权限
const hasPermission = await hasAccess(
  entryNftId,
  requesterAddress,
  policyRegistryId
);
```

**特点：**
- ✅ 链上可验证权限
- ✅ 可以授权他人访问（私有记录）
- ✅ 可以撤销授权
- ✅ 访问策略公开透明
- ⚠️ 需要链上交互（gas 费用）

---

### 2. 权限验证方式

#### 当前系统

```typescript
// 当前：尝试所有可能的密钥解密
const possibleKeys = [
  PUBLIC_SEAL_KEY,
  userWalletKey,
  supabaseUserKey,
  anonymousKey
];

// 依次尝试，成功即表示有权限
for (const key of possibleKeys) {
  try {
    const decrypted = await decryptData(encryptedData, key);
    return decrypted;  // 成功解密 = 有权限
  } catch {
    continue;  // 尝试下一个密钥
  }
}
```

**问题：**
- ❌ 无法提前知道是否有权限
- ❌ 需要尝试多个密钥（性能开销）
- ❌ 无法区分"无权限"和"数据损坏"
- ❌ 无法证明权限给第三方

#### 部署 Seal Policies 后

```typescript
// 部署后：直接查询链上策略
const isPublic = await isPublicSeal(entryNftId, policyRegistryId);
if (isPublic) {
  // 公开记录，任何人都可以访问
  return await decryptData(encryptedData, PUBLIC_SEAL_KEY);
}

// 检查是否有访问权限
const hasPermission = await hasAccess(
  entryNftId,
  currentWalletAddress,
  policyRegistryId
);

if (hasPermission) {
  // 有权限，使用对应的密钥解密
  const owner = await getPolicyOwner(entryNftId, policyRegistryId);
  const key = owner === currentWalletAddress 
    ? generateUserKey(currentWalletAddress)
    : await getAuthorizedKey(currentWalletAddress);
  return await decryptData(encryptedData, key);
} else {
  // 无权限，直接拒绝
  throw new Error("No access permission");
}
```

**优势：**
- ✅ 提前知道是否有权限
- ✅ 无需尝试多个密钥
- ✅ 可以证明权限给第三方
- ✅ 清晰的权限状态

---

### 3. 授权管理功能

#### 当前系统

```typescript
// 当前：无法授权他人访问私有记录
// 如果用户 A 想分享给用户 B：
// 1. 用户 A 必须将记录改为公开（isPublic = true）
// 2. 或者用户 B 需要知道用户 A 的密钥（不安全）
```

**限制：**
- ❌ 无法选择性授权
- ❌ 公开 = 所有人可见，无法撤销
- ❌ 无法授权特定地址

#### 部署 Seal Policies 后

```typescript
// 部署后：可以动态授权/撤销
// 授权用户 B 访问私有记录
await grantAccess(
  entryNftId,
  userBAddress,
  policyRegistryId
);

// 撤销用户 B 的访问权限
await revokeAccess(
  entryNftId,
  userBAddress,
  policyRegistryId
);

// 查询所有授权地址
const authorizedAddresses = await getAuthorizedAddresses(
  entryNftId,
  policyRegistryId
);
```

**优势：**
- ✅ 可以授权特定地址
- ✅ 可以撤销授权
- ✅ 可以查询授权列表
- ✅ 保持记录为私有，只授权给特定用户

---

### 4. NFT 与访问策略的关联

#### 当前系统

```typescript
// 当前：NFT 铸造和访问策略分离
const mintResult = await mintEntry(
  journalId,
  moodScore,
  description,
  // ... 其他参数
);

// isPublic 标志只存储在：
// 1. 本地存储（localStorage）
// 2. Supabase 数据库（如果备份）
// 3. 加密数据本身（metadata）

// 问题：无法从链上 NFT 知道访问策略
```

**问题：**
- ❌ NFT 和访问策略分离
- ❌ 无法从链上验证访问策略
- ❌ 如果本地数据丢失，无法恢复策略

#### 部署 Seal Policies 后

```typescript
// 部署后：NFT 和访问策略绑定
const mintResult = await mintEntryWithPolicy(
  journalId,
  moodScore,
  description,
  // ... 其他参数
  isPublic,  // 这个会记录到链上
  policyRegistryId
);

// 现在可以从链上查询：
// 1. EntryNFT 的访问策略
// 2. 是否为公开记录
// 3. 授权了哪些地址
// 4. 策略的所有者

// 即使本地数据丢失，也可以从链上恢复策略
```

**优势：**
- ✅ NFT 和策略绑定
- ✅ 链上可查策略
- ✅ 数据丢失可恢复
- ✅ 策略不可篡改

---

### 5. 用户体验差异

#### 当前系统

**创建记录：**
1. 用户选择公开/私有
2. 使用对应密钥加密
3. 存储到本地/Walrus
4. 可选：铸造 NFT（不包含策略信息）

**查看记录：**
1. 尝试所有可能的密钥解密
2. 成功解密 = 有权限
3. 失败 = 无权限或数据损坏

**分享记录：**
- 公开记录：所有人可见（无法撤销）
- 私有记录：无法分享

#### 部署 Seal Policies 后

**创建记录：**
1. 用户选择公开/私有
2. 使用对应密钥加密
3. 存储到本地/Walrus
4. 铸造 NFT + 创建访问策略（一次性交易）

**查看记录：**
1. 查询链上访问策略
2. 验证是否有权限
3. 有权限才尝试解密

**分享记录：**
- 公开记录：所有人可见
- 私有记录：可以授权特定地址，可以撤销

---

### 6. 技术架构差异

#### 当前系统架构

```
用户创建记录
    ↓
选择加密密钥（基于 isPublic）
    ↓
加密数据
    ↓
存储到本地/Walrus
    ↓
可选：铸造 NFT（不含策略）
    ↓
访问时：尝试所有可能的密钥解密
```

#### 部署 Seal Policies 后架构

```
用户创建记录
    ↓
选择加密密钥（基于 isPublic）
    ↓
加密数据
    ↓
存储到本地/Walrus
    ↓
铸造 NFT + 创建访问策略（链上）
    ↓
访问时：查询链上策略 → 验证权限 → 解密
```

---

## 🎯 实际使用场景对比

### 场景 1：创建私有记录

**当前：**
- 使用用户密钥加密
- 只有用户自己可以解密
- 无法授权他人

**部署后：**
- 使用用户密钥加密
- 链上记录为私有策略
- 可以授权他人访问

### 场景 2：创建公开记录

**当前：**
- 使用 PUBLIC_SEAL_KEY 加密
- 任何人都可以解密
- 无法撤销公开状态

**部署后：**
- 使用 PUBLIC_SEAL_KEY 加密
- 链上记录为公开策略
- 仍然无法撤销（但可以查询状态）

### 场景 3：分享私有记录给朋友

**当前：**
- ❌ 无法实现
- 只能改为公开（所有人可见）

**部署后：**
- ✅ 可以授权朋友的地址
- ✅ 保持记录为私有
- ✅ 可以随时撤销授权

### 场景 4：验证访问权限

**当前：**
- ❌ 无法验证
- 只能尝试解密判断

**部署后：**
- ✅ 链上查询验证
- ✅ 可以证明权限
- ✅ 无需尝试解密

---

## 📈 优势总结

### 部署 Seal Policies 后的优势

1. **链上验证**：可以在链上查询和验证访问权限
2. **授权管理**：可以动态授权/撤销其他地址的访问
3. **策略绑定**：NFT 和访问策略绑定，不可分离
4. **数据恢复**：即使本地数据丢失，也可以从链上恢复策略
5. **透明度**：访问策略公开可查，但内容仍然加密
6. **可证明性**：可以向第三方证明访问权限

### 当前系统的优势

1. **简单**：无需链上交互
2. **快速**：无需等待链上确认
3. **免费**：无需支付 gas 费用
4. **离线**：可以在离线状态下工作

---

## 🔄 迁移考虑

### 向后兼容

部署 Seal Policies 后，系统仍然支持：
- ✅ 旧的记录（没有链上策略）仍然可以正常解密
- ✅ 客户端加密逻辑保持不变
- ✅ 可以逐步迁移到链上策略

### 需要更新的地方

1. **Record.tsx**：使用 `mintEntryWithPolicy` 替代 `mintEntry`
2. **Timeline.tsx**：添加链上权限验证
3. **配置**：添加 PolicyRegistry ID 配置
4. **UI**：添加授权管理界面（可选）

---

## 💡 建议

### 何时部署 Seal Policies？

**适合部署的情况：**
- ✅ 需要分享私有记录给特定用户
- ✅ 需要链上验证访问权限
- ✅ 需要可证明的访问控制
- ✅ 用户愿意支付 gas 费用

**可以暂缓的情况：**
- ⏸️ 只是个人使用，不需要分享
- ⏸️ 对 gas 费用敏感
- ⏸️ 需要完全离线功能

### 混合方案

可以同时支持两种方式：
- 新记录：使用 Seal Policies（链上策略）
- 旧记录：保持原有方式（客户端控制）
- 用户选择：让用户选择是否使用链上策略







