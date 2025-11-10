# Walrus 使用指南 - 快速开始

## 📋 当前问题

您的项目目前**无法使用 Walrus**，因为：

1. ❌ **端点不可用**：`https://upload-relay.testnet.walrus.space` 返回 404
2. ❌ **未使用 SDK**：代码直接调用 HTTP API，而不是使用 `@mysten/walrus` SDK
3. ✅ **已安装 SDK**：项目已安装 `@mysten/walrus@0.8.3`，但未使用

## 🎯 解决方案：使用 @mysten/walrus SDK

### 步骤 1：检查服务状态

运行检查脚本：

```bash
./check-walrus.sh
```

或者手动检查：

```bash
# 检查 upload relay
curl https://upload-relay.testnet.walrus.space/v1/tip-config

# 检查 aggregator
curl https://aggregator.testnet.walrus.space/v1/health
```

### 步骤 2：更新服务器代码使用 SDK

**重要**：使用 Walrus SDK 需要：
- ✅ Sui 钱包签名（用于支付 gas）
- ✅ WAL 代币（用于支付存储费用）
- ✅ SUI 代币（用于支付交易费用）

#### 选项 A：如果 Upload Relay 可用（推荐）

修改 `server/index.js`，使用 SDK：

```javascript
import { getFullnodeUrl, SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { walrus } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// 创建 Walrus 客户端
const walrusClient = new SuiJsonRpcClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(
  walrus({
    uploadRelay: {
      host: 'https://upload-relay.testnet.walrus.space',
      sendTip: {
        max: 1_000, // 最大 tip（MIST）
      },
    },
  }),
);

async function uploadToWalrus(encryptedData, epochs = DEFAULT_EPOCHS) {
  // 注意：这需要钱包签名，不适合服务器端直接使用
  // 需要客户端提供签名
  throw new Error('请使用客户端 SDK 上传');
}
```

#### 选项 B：如果 Upload Relay 不可用（当前情况）

**继续使用本地存储**，这是当前的最佳方案：

```bash
# 设置环境变量禁用 Walrus
export WALRUS_ENABLED=false
```

或者直接使用当前的备用方案（已实现）。

### 步骤 3：客户端使用 SDK（如果服务可用）

在客户端代码中使用 SDK：

```typescript
// src/lib/walrus-client.ts
import { getFullnodeUrl, SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { walrus } from '@mysten/walrus';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';

export async function uploadToWalrusWithSDK(
  encryptedData: string,
  signer: any, // 钱包签名器
  epochs: number = 5
) {
  const client = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
  }).$extend(
    walrus({
      uploadRelay: {
        host: 'https://upload-relay.testnet.walrus.space',
        sendTip: {
          max: 1_000,
        },
      },
    }),
  );

  const { blobId } = await client.walrus.writeBlob({
    blob: new TextEncoder().encode(encryptedData),
    deletable: false,
    epochs: epochs,
    signer: signer,
  });

  return {
    blobId,
    walrusUrl: `https://aggregator.testnet.walrus.space/v1/${blobId}`,
  };
}
```

## 🔍 诊断步骤

### 1. 检查服务是否可用

```bash
# 运行检查脚本
./check-walrus.sh
```

### 2. 如果服务不可用

**当前状态**：Walrus testnet 服务可能暂时不可用。

**解决方案**：
- ✅ **使用本地存储**（已实现）- 数据保存到 `server/data/emotions.json`
- ⏳ **等待服务恢复** - 关注 [Walrus 官方文档](https://docs.walrus.space/)
- 🔄 **切换到 mainnet** - 如果 mainnet 可用

### 3. 如果服务可用

按照上面的步骤更新代码使用 SDK。

## 📝 当前实现状态

✅ **已实现的功能**：
- 本地存储备用方案
- 详细的错误处理和日志
- 友好的用户提示

❌ **未实现的功能**：
- 使用 @mysten/walrus SDK
- 钱包签名集成
- WAL 代币支付

## 🚀 下一步行动

1. **立即行动**：
   ```bash
   # 检查服务状态
   ./check-walrus.sh
   ```

2. **如果服务可用**：
   - 更新代码使用 SDK（需要钱包集成）
   - 确保用户有 WAL 和 SUI 代币

3. **如果服务不可用**：
   - 继续使用本地存储
   - 监控服务状态
   - 考虑切换到 mainnet

## 📚 相关资源

- [@mysten/walrus SDK 文档](https://github.com/MystenLabs/ts-sdks/tree/main/packages/walrus)
- [Walrus 官方文档](https://docs.walrus.space/)
- [Sui 网络配置](https://docs.sui.io/guides/developer/getting-started/get-coins)

## ⚠️ 重要提示

1. **Testnet vs Mainnet**：
   - `https://wal.app` 只服务 mainnet sites
   - Testnet 可能需要自己运行 portal

2. **成本考虑**：
   - 上传需要 WAL 代币（存储费用）
   - 需要 SUI 代币（交易费用）
   - 直接写入需要约 2200 个请求（使用 relay 可以减少）

3. **当前最佳方案**：
   - 使用本地存储（已实现）
   - 等待服务恢复或切换到 mainnet
   - 然后集成 SDK

