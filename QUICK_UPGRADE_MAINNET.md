# ⚡ Mainnet 快速升级指南

## 🎯 一键升级

```bash
# 在项目根目录执行
cd /Users/louistung/echoma
./scripts/upgrade-mainnet-seal-policies.sh
```

---

## ✅ 准备就绪

- ✅ **UpgradeCap ID**: `0x3a77fa6d7a4392509d5e998aacc3e4e405411a76b75028cf7662e072b539c10d`
- ✅ **升级脚本**: `scripts/upgrade-mainnet-seal-policies.sh`
- ✅ **验证脚本**: `scripts/verify-mainnet-upgrade.sh`
- ✅ **完整指南**: `MAINNET_SEAL_POLICIES_UPGRADE_GUIDE.md`

---

## 💰 需要准备

- **Mainnet 钱包余额**: 至少 **0.2 SUI**
- **预计花费**: 约 **0.08-0.1 SUI**

---

## 🚀 执行流程

### 1. 升级（5-10 分钟）
```bash
./scripts/upgrade-mainnet-seal-policies.sh
```
- 会提示确认（输入 `yes`）
- 会花费真实 SUI 代币 ⚠️

### 2. 验证（1 分钟）
```bash
./scripts/verify-mainnet-upgrade.sh
```

### 3. 更新配置（1 分钟）
编辑 `src/lib/policyRegistry.ts`:
```typescript
const PRESET_POLICY_REGISTRY_IDS: Record<SuiNetwork, string | null> = {
  testnet: "0x7b9993416d4658b186acbb62dfead9582510aa726c2a3a73d2f3335d05adcc69",
  mainnet: "0x<从升级结果复制>", // ← 更新这里
};
```

---

## 📊 升级后效果

Mainnet 将支持：
- ✅ 链上访问控制
- ✅ 授权/撤销管理
- ✅ 透明验证
- ✅ 与 Testnet 功能对等

---

## 🆘 如果有问题

查看完整指南：`MAINNET_SEAL_POLICIES_UPGRADE_GUIDE.md`

---

**准备好了就运行升级脚本！** 🚀

