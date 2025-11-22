# 📦 Move 合约重新部署总结

**部署时间**: 2025-11-21 10:49:08 UTC  
**网络**: Sui Testnet  
**部署状态**: ✅ 成功

---

## 🎯 部署信息

### Package ID
```
0x555c509131e6e41a12ff3cca245ba5ef762ed2cf0da0e3342c10d34dc416dc47
```

### PolicyRegistry ID (共享对象)
```
0x7b9993416d4658b186acbb62dfead9582510aa726c2a3a73d2f3335d05adcc69
```

### UpgradeCap ID
```
0xebb8466097b2b9a4468173a964b6892a4ccafc9f03501a517d78a0d82cee8ca7
```

### Transaction Digest
```
89WwZ9h8Bay8YHphoSPjFFXyVqQpN4XQnwS6m7qiVJXK
```

---

## 📋 部署的模块

1. **diary** - 日记 NFT 铸造核心模块
2. **diary_with_policy** - 带 Seal Access Policies 的铸造模块
3. **seal_access_policies** - 访问控制策略模块

---

## 🔗 浏览器链接

- **Package**: https://suiexplorer.com/?network=testnet&object=0x555c509131e6e41a12ff3cca245ba5ef762ed2cf0da0e3342c10d34dc416dc47
- **PolicyRegistry**: https://suiexplorer.com/?network=testnet&object=0x7b9993416d4658b186acbb62dfead9582510aa726c2a3a73d2f3335d05adcc69
- **Transaction**: https://suiexplorer.com/?network=testnet&txblock=89WwZ9h8Bay8YHphoSPjFFXyVqQpN4XQnwS6m7qiVJXK

---

## ✅ 验证结果

### Package 验证
- ✅ Package 对象存在
- ✅ 包含 3 个模块（diary, diary_with_policy, seal_access_policies）
- ✅ 版本: 1
- ✅ 状态: Immutable

### PolicyRegistry 验证
- ✅ PolicyRegistry 对象存在
- ✅ 类型正确: `seal_access_policies::PolicyRegistry`
- ✅ 共享对象状态: Shared (initial_shared_version: 661919277)
- ✅ 可供所有用户访问

---

## 🔧 已更新的配置文件

### 1. `src/lib/mintContract.ts`
```typescript
// 旧值
const TESTNET_PACKAGE_ID = "0x6a63d7a634079a8a3505f58d8d35cc5c5828de47ed4f8985291fa30f71a89115";

// 新值
const TESTNET_PACKAGE_ID = "0x555c509131e6e41a12ff3cca245ba5ef762ed2cf0da0e3342c10d34dc416dc47";
```

### 2. `src/lib/policyRegistry.ts`
```typescript
// 旧值
testnet: "0x5ccbee5d26bf641ce8a3352d00896f17c1e5c73aa7aa9e67c5df5a8fbca8ec9a"

// 新值
testnet: "0x7b9993416d4658b186acbb62dfead9582510aa726c2a3a73d2f3335d05adcc69"
```

---

## 💰 Gas 费用

- **总消耗**: 42,779,480 MIST (约 0.0428 SUI)
- **计算成本**: 1,000,000 MIST
- **存储成本**: 42,757,600 MIST
- **存储返还**: 978,120 MIST

---

## 🎉 部署成功原因

之前的问题是 Package ID 和 PolicyRegistry ID 不匹配或过期。通过重新部署：

1. ✅ 生成了新的 Package ID
2. ✅ 自动创建了新的 PolicyRegistry 共享对象
3. ✅ 所有模块（diary, diary_with_policy, seal_access_policies）都已正确部署
4. ✅ PolicyRegistry 的 `init` 函数已自动执行并创建共享对象
5. ✅ 前端配置已更新为新的 ID

---

## 📝 后续步骤

### 1. 清除本地存储（重要）
由于更换了新的 Package ID，用户需要清除浏览器中的旧配置：

```javascript
// 在浏览器控制台运行
localStorage.clear();
// 或者只清除特定项
localStorage.removeItem('sui_journal_[钱包地址]_testnet');
localStorage.removeItem('sui_policy_registry_testnet');
```

### 2. 测试新部署的合约

#### 创建 Journal
```bash
sui client call \
  --package 0x555c509131e6e41a12ff3cca245ba5ef762ed2cf0da0e3342c10d34dc416dc47 \
  --module diary \
  --function create_journal \
  --gas-budget 10000000
```

#### 使用 Seal Access Policies 铸造 NFT
```bash
sui client call \
  --package 0x555c509131e6e41a12ff3cca245ba5ef762ed2cf0da0e3342c10d34dc416dc47 \
  --module diary_with_policy \
  --function mint_entry_with_policy \
  --args [JOURNAL_ID] 5 "测试记录" "test" "https://example.com/image.png" "image/png" [0x12,0x34] "" "" [] 0 true 0x7b9993416d4658b186acbb62dfead9582510aa726c2a3a73d2f3335d05adcc69 0x6 \
  --gas-budget 20000000
```

### 3. 验证访问策略功能

在前端应用中测试：
1. 铸造新的日记 NFT（使用 Seal Access Policies）
2. 检查访问策略是否正确创建
3. 测试授权/撤销访问功能
4. 验证访问控制是否正常工作

---

## ⚠️ 注意事项

1. **旧 NFT 数据**: 使用旧 Package ID 铸造的 NFT 仍然存在，但属于旧版本的合约
2. **Network 隔离**: 确保前端正确识别 testnet 和 mainnet 的配置
3. **Journal 重建**: 用户可能需要重新创建 Journal，或应用会自动在链上查询
4. **策略验证延迟**: PolicyRegistry 查询可能有短暂延迟（1-3 秒），这是正常的链上索引时间

---

## 📚 相关文档

- [部署指南](./nft_mint_test/DEPLOY.md)
- [Seal Access Policies 使用指南](./SEAL_POLICIES_USER_GUIDE.md)
- [安全最佳实践](./SECURITY_BEST_PRACTICES.md)

---

## 🔍 故障排除

如果遇到"访问策略未找到"错误：

1. **检查 Package ID**: 确认前端使用的是新的 Package ID
2. **检查 PolicyRegistry ID**: 确认配置的是新的 PolicyRegistry ID
3. **清除缓存**: 清除浏览器 localStorage
4. **等待索引**: 铸造后等待 2-3 秒让链上索引完成
5. **检查网络**: 确认连接的是 testnet 而非 mainnet

---

**部署完成！** 🎉

所有合约已成功部署并验证。可以开始使用新的 Seal Access Policies 功能了。

