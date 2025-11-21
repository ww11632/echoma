# 🚀 Mainnet Seal Access Policies 升级指南

## 📋 升级概览

**目标**: 将 Seal Access Policies 模块添加到 Mainnet 合约，实现链上访问控制功能

**方式**: 使用 `upgrade` 命令升级现有合约（方案 A）

---

## ✅ 准备工作（已完成）

- ✅ 查找到 Mainnet UpgradeCap ID: `0x3a77fa6d7a4392509d5e998aacc3e4e405411a76b75028cf7662e072b539c10d`
- ✅ 创建升级脚本: `scripts/upgrade-mainnet-seal-policies.sh`
- ✅ 创建验证脚本: `scripts/verify-mainnet-upgrade.sh`
- ✅ 创建查询脚本: `scripts/get-mainnet-upgrade-cap.sh`

---

## 🎯 当前状态

### Testnet（已完成）✅
```json
{
  "network": "testnet",
  "packageId": "0x555c509131e6e41a12ff3cca245ba5ef762ed2cf0da0e3342c10d34dc416dc47",
  "policyRegistryId": "0x7b9993416d4658b186acbb62dfead9582510aa726c2a3a73d2f3335d05adcc69",
  "modules": ["diary", "diary_with_policy", "seal_access_policies"]
}
```

### Mainnet（待升级）⚠️
```json
{
  "network": "mainnet",
  "packageId": "0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9",
  "upgradeCap": "0x3a77fa6d7a4392509d5e998aacc3e4e405411a76b75028cf7662e072b539c10d",
  "modules": ["diary"]  // ← 只有基础模块
}
```

---

## 🚀 执行步骤

### 步骤 1: 确认环境

```bash
# 1. 确认在项目根目录
cd /Users/louistung/echoma

# 2. 确认钱包余额（需要约 0.1-0.2 SUI）
sui client switch --env mainnet
sui client balance

# 如果余额不足，需要充值 Mainnet SUI
```

### 步骤 2: 执行升级

```bash
# 运行升级脚本
./scripts/upgrade-mainnet-seal-policies.sh
```

**脚本会自动完成：**
1. ✅ 切换到 Mainnet
2. ✅ 检查钱包余额
3. ✅ 编译合约（包含 seal_access_policies 模块）
4. ✅ 执行升级（需要用户确认）
5. ✅ 提取 PolicyRegistry ID
6. ✅ 保存部署信息到 `nft_mint_test/deploy-info-mainnet.json`

**用户需要：**
- ⚠️ 在提示时输入 `yes` 确认升级（会花费真实 SUI）
- ⚠️ 确认钱包交易

### 步骤 3: 验证升级

```bash
# 运行验证脚本
./scripts/verify-mainnet-upgrade.sh
```

**验证内容：**
- ✅ Package 存在
- ✅ PolicyRegistry 存在且类型正确
- ✅ 所有模块已部署

### 步骤 4: 更新前端配置

升级成功后，更新以下配置文件：

#### 4.1 更新 `src/lib/policyRegistry.ts`

```typescript
const PRESET_POLICY_REGISTRY_IDS: Record<SuiNetwork, string | null> = {
  testnet: "0x7b9993416d4658b186acbb62dfead9582510aa726c2a3a73d2f3335d05adcc69",
  mainnet: "0x<新的_PolicyRegistry_ID>", // ← 从升级结果中复制
};
```

#### 4.2 更新 README（可选）

在 `README.md` 和 `README.zh.md` 中添加 Mainnet Seal Policies 信息。

---

## 📊 升级后的效果

### Mainnet 将支持：

1. **🔐 链上访问控制**
   - 创建访问策略（公开/私密）
   - 链上验证访问权限

2. **🤝 授权管理**
   - 授权他人访问私密记录
   - 撤销已授予的权限
   - 查询授权历史

3. **🔍 透明验证**
   - 所有权限操作链上可查
   - 访问策略公开透明

4. **✨ 完整功能对等**
   - Testnet 和 Mainnet 功能一致
   - 用户可以在主网使用完整功能

---

## 💰 费用估算

基于 Testnet 的升级经验：

- **Gas 费用**: 约 0.04-0.06 SUI
- **存储成本**: 约 0.04 SUI
- **总计**: 约 0.08-0.1 SUI

**建议**: 确保钱包中有至少 0.2 SUI 以应对gas价格波动

---

## 🔧 故障排除

### 问题 1: 编译失败

```bash
# 清理 build 目录重试
cd nft_mint_test
rm -rf build/
sui move build
```

### 问题 2: 余额不足

```
Error: Insufficient funds
```

**解决**: 向 Mainnet 钱包充值 SUI

### 问题 3: PolicyRegistry 未创建

如果升级成功但未自动创建 PolicyRegistry：

**原因**: `init` 函数在升级时不会自动执行

**解决**: 需要手动调用或使用新部署方式。建议：
1. 先验证升级是否成功
2. 检查合约模块是否包含 `seal_access_policies`
3. 如需要，可以手动部署 PolicyRegistry

### 问题 4: 交易失败

```bash
# 查看详细错误
sui client transaction <TX_DIGEST>

# 在浏览器中查看
https://suiexplorer.com/?network=mainnet&txblock=<TX_DIGEST>
```

---

## ⚠️ 重要注意事项

1. **不可逆**: 合约升级后不可回滚
2. **需确认**: 升级会花费真实的 SUI 代币
3. **测试优先**: 建议先在 Testnet 测试完整流程
4. **备份配置**: 升级前备份 `deploy-info-mainnet.json`
5. **用户通知**: 升级后可能需要通知用户清除缓存

---

## 📝 升级检查清单

升级前检查：
- [ ] ✅ 已获取 UpgradeCap ID
- [ ] ✅ Mainnet 钱包余额充足（≥0.2 SUI）
- [ ] ✅ 合约代码已编译通过
- [ ] ✅ 已在 Testnet 验证功能
- [ ] ✅ 创建备份配置

升级后检查：
- [ ] Package ID 正确
- [ ] PolicyRegistry 已创建
- [ ] 模块列表完整
- [ ] 前端配置已更新
- [ ] 功能测试通过

---

## 🎉 升级完成后

1. **测试功能**
   - 在 Mainnet 上创建 Journal
   - 使用 Seal Access Policies 铸造 NFT
   - 测试授权/撤销功能

2. **更新文档**
   - README.md 添加 Mainnet 信息
   - SEAL_POLICIES_USER_GUIDE.md 更新

3. **用户通知**
   - 发布公告说明新功能
   - 提供使用指南

---

## 🔗 相关资源

- **Testnet 部署信息**: `nft_mint_test/deploy-info-testnet.json`
- **Mainnet 部署信息**: `nft_mint_test/deploy-info-mainnet.json`
- **Seal Policies 使用指南**: `SEAL_POLICIES_USER_GUIDE.md`
- **Seal Policies 对比**: `SEAL_POLICIES_COMPARISON.md`

---

## 🆘 需要帮助？

如有问题，可以：
1. 查看错误日志
2. 在 Sui Explorer 中查看交易详情
3. 检查合约代码
4. 查阅 Sui 官方文档

---

**准备好了吗？** 运行 `./scripts/upgrade-mainnet-seal-policies.sh` 开始升级！🚀

