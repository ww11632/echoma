# Walrus 使用指南

## 问题诊断

当前项目尝试直接使用 HTTP API 调用 Walrus 服务，但端点 `https://upload-relay.testnet.walrus.space` 返回 404 错误。

## 解决方案：使用 @mysten/walrus SDK

项目已经安装了 `@mysten/walrus` SDK，但代码中并未使用它。应该使用 SDK 而不是直接调用 HTTP API。

## 使用步骤

### 1. 检查 Walrus 服务状态

首先，确认 Walrus testnet 服务是否可用：

```bash
# 检查 upload relay 端点
curl https://upload-relay.testnet.walrus.space/v1/tip-config

# 检查 aggregator 端点
curl https://aggregator.testnet.walrus.space/v1/health
```

如果这些端点都返回 404，说明：
- Walrus testnet 服务可能暂时不可用
- 或者端点地址已更改
- 或者需要使用不同的网络（mainnet）

### 2. 使用 @mysten/walrus SDK（推荐方式）

SDK 提供了两种方式：

#### 方式 A：使用 Upload Relay（推荐，更简单）

Upload Relay 会处理大部分上传工作，减少客户端请求数量。

```typescript
import { getFullnodeUrl, SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { walrus } from '@mysten/walrus';

// 创建客户端并扩展 Walrus 功能
const client = new SuiJsonRpcClient({
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

// 上传数据
const { blobId } = await client.walrus.writeBlob({
  blob: new TextEncoder().encode(encryptedData),
  deletable: false,
  epochs: 5,
  signer: keypair, // 需要 Sui 钱包签名
});
```

#### 方式 B：直接写入（需要很多请求，约 2200 个）

如果 upload relay 不可用，可以直接写入，但需要更多请求：

```typescript
const client = new SuiJsonRpcClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(walrus());

const { blobId } = await client.walrus.writeBlob({
  blob: new TextEncoder().encode(encryptedData),
  deletable: false,
  epochs: 5,
  signer: keypair,
});
```

### 3. 当前项目的限制

**重要**：使用 Walrus SDK 需要：
1. **Sui 钱包签名**：上传需要钱包签名和支付 gas 费用
2. **WAL 代币**：需要 WAL 代币来支付存储费用
3. **SUI 代币**：需要 SUI 来支付交易费用

### 4. 临时解决方案

如果 Walrus 服务不可用，当前代码已经实现了备用方案：
- 数据会保存到本地文件 (`server/data/emotions.json`)
- 应用功能不受影响
- 当 Walrus 服务恢复后，可以重新上传数据

### 5. 检查服务状态

运行以下命令检查服务：

```bash
# 检查 upload relay
curl -v https://upload-relay.testnet.walrus.space/v1/tip-config

# 检查 aggregator
curl -v https://aggregator.testnet.walrus.space/v1/health

# 如果都返回 404，可能需要：
# 1. 等待服务恢复
# 2. 使用 mainnet 而不是 testnet
# 3. 检查是否有新的端点地址
```

### 6. 使用 Mainnet（如果 testnet 不可用）

如果 testnet 不可用，可以切换到 mainnet：

```typescript
const client = new SuiJsonRpcClient({
  url: getFullnodeUrl('mainnet'),
  network: 'mainnet',
}).$extend(
  walrus({
    uploadRelay: {
      host: 'https://upload-relay.mainnet.walrus.space', // 如果存在
      sendTip: {
        max: 1_000,
      },
    },
  }),
);
```

## 下一步行动

1. **检查服务状态**：运行上面的 curl 命令检查端点
2. **如果服务可用**：更新代码使用 @mysten/walrus SDK
3. **如果服务不可用**：继续使用当前的本地存储备用方案
4. **监控服务状态**：关注 Walrus 官方文档或 Discord 获取服务状态更新

## 相关资源

- [@mysten/walrus 文档](https://github.com/MystenLabs/ts-sdks/tree/main/packages/walrus)
- [Walrus 官方文档](https://docs.walrus.space/)
- [Sui 网络配置](https://docs.sui.io/guides/developer/getting-started/get-coins)

