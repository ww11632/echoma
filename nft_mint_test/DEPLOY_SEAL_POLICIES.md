# 🔐 部署 Seal Access Policies 合约

## 当前状态

✅ **合约代码已准备**：`seal_access_policies.move` 已编译通过  
✅ **前端函数已添加**：`mintContract.ts` 中已有相关函数  
❌ **合约尚未部署**：需要部署到链上  
❌ **前端尚未集成**：页面还在使用旧的 `mintEntry` 函数

## 部署步骤

### 1. 编译合约

```bash
cd nft_mint_test
sui move build
```

确保编译成功，没有错误。

### 2. 部署合约到 Testnet

```bash
# 确保在 testnet 网络
sui client switch --env testnet

# 检查余额（需要足够的 SUI 支付 gas）
sui client balance

# 如果余额不足，获取测试代币
sui client faucet

# 发布合约（包含所有模块：diary, seal_access_policies, diary_with_policy）
sui client publish --gas-budget 100000000
```

### 3. 获取 PolicyRegistry ID

部署成功后，`init` 函数会自动创建 PolicyRegistry 共享对象。你需要从交易结果中获取 PolicyRegistry 的 ID：

```bash
# 查看交易详情
sui client transaction <TRANSACTION_DIGEST>

# 或者使用 Sui Explorer
# https://suiexplorer.com/?network=testnet&txblock=<TRANSACTION_DIGEST>
```

在交易结果中查找：
- 类型为 `PolicyRegistry` 的共享对象
- 或者查找 `Created` 对象，类型包含 `seal_access_policies::PolicyRegistry`

### 4. 更新代码配置

#### 4.1 更新 Package ID

如果这是新部署（不是升级），需要更新 Package ID：

```typescript
// src/lib/mintContract.ts
const TESTNET_PACKAGE_ID = "0x<新的 Package ID>";
```

#### 4.2 保存 PolicyRegistry ID

将 PolicyRegistry ID 保存到环境变量或配置文件中：

```typescript
// src/lib/mintContract.ts 或配置文件
const TESTNET_POLICY_REGISTRY_ID = "0x<PolicyRegistry ID>";
```

### 5. 验证部署

```bash
# 检查合约是否可访问
sui client object <PACKAGE_ID>

# 检查 PolicyRegistry 是否存在
sui client object <POLICY_REGISTRY_ID>
```

### 6. 测试合约功能

```bash
# 测试创建策略（需要先有 EntryNFT）
sui client call \
  --package <PACKAGE_ID> \
  --module seal_access_policies \
  --function create_policy \
  --args \
    0x<ENTRY_NFT_ID> \
    0x<OWNER_ADDRESS> \
    true \
    0x<POLICY_REGISTRY_ID> \
  --gas-budget 10000000
```

## 部署到 Mainnet

部署到 Mainnet 的步骤相同，但需要：

1. 切换到 mainnet：`sui client switch --env mainnet`
2. 确保有足够的 SUI 支付 gas
3. 更新 `MAINNET_PACKAGE_ID` 和 `MAINNET_POLICY_REGISTRY_ID`

## 升级现有合约

如果合约已经部署，可以使用 `upgrade` 命令：

```bash
# 需要 UpgradeCap ID（首次部署时返回）
sui client upgrade \
  --upgrade-capability <UpgradeCap ID> \
  --gas-budget 100000000
```

**注意**：升级后 PolicyRegistry 不会重新创建，继续使用现有的 ID。

## 前端集成

部署完成后，需要更新前端代码：

1. **更新 Record.tsx**：使用 `mintEntryWithPolicy` 替代 `mintEntry`
2. **添加 PolicyRegistry 管理**：在应用启动时获取或验证 PolicyRegistry ID
3. **添加访问权限检查**：在 Timeline 中使用 `hasAccess` 检查权限

## 重要提示

1. **PolicyRegistry 是共享对象**：部署后自动创建，所有用户共享同一个 Registry
2. **init 函数自动执行**：部署时自动创建 PolicyRegistry，无需手动调用
3. **保存 PolicyRegistry ID**：需要保存这个 ID 供前端使用
4. **网络隔离**：Testnet 和 Mainnet 需要分别部署，有各自的 PolicyRegistry

## 故障排除

### PolicyRegistry 未找到

如果找不到 PolicyRegistry ID：

1. 检查交易结果中的 `Created` 对象
2. 查找类型包含 `PolicyRegistry` 的对象
3. 确认对象是 `Shared` 类型（不是 `Owned`）

### 合约调用失败

- 确认 Package ID 正确
- 确认 PolicyRegistry ID 正确
- 确认网络匹配（testnet/mainnet）
- 检查 gas 余额是否充足

## 下一步

部署完成后，参考以下文档更新前端：
- 更新 `src/pages/Record.tsx` 使用 `mintEntryWithPolicy`
- 添加 PolicyRegistry ID 管理
- 实现访问权限检查功能






