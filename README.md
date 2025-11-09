# Echoma - 情感加密链

> 你的情感，加密并永久保存在链上

Echoma 是一个基于 Web3 的情感记录应用，结合了客户端加密、去中心化存储和区块链验证，为你的情感数据提供隐私保护和永久存储。

## ✨ 核心特性

- 🔒 **客户端加密** - 使用 AES-GCM 加密，数据在离开设备前就已加密
- 🌊 **Walrus 存储** - 去中心化、可验证的存储方案
- ⛓️ **Sui 区块链** - NFT 形式的链上验证证明
- 🤖 **AI 辅助分析** - 智能情感分析和分类
- 📊 **时间线视图** - 可视化你的情感历程

## 🚀 快速开始

### 前置要求

- Node.js 18+ 和 npm（推荐使用 [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) 安装）
- Sui 钱包（如 Sui Wallet 或 Ethos Wallet）

### 安装步骤

```sh
# 1. 克隆仓库
git clone <YOUR_GIT_URL>
cd sentiment-cipher-chain

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

应用将在 `http://localhost:5173` 启动。

### 构建生产版本

```sh
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 🛠️ 技术栈

### 前端框架
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具和开发服务器

### UI 组件
- **shadcn/ui** - 高质量 UI 组件库
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Radix UI** - 无样式、可访问的组件原语
- **Lucide React** - 图标库

### Web3 集成
- **@mysten/dapp-kit** - Sui 区块链集成
- **@mysten/sui** - Sui SDK
- **@mysten/walrus** - Walrus 存储 SDK

### 其他工具
- **React Router** - 路由管理
- **TanStack Query** - 数据获取和状态管理
- **React Hook Form** - 表单处理
- **Zod** - 数据验证

## 📁 项目结构

```
src/
├── components/          # React 组件
│   ├── ui/             # shadcn/ui 组件
│   └── WalletConnect.tsx
├── hooks/              # 自定义 React Hooks
├── lib/                # 工具函数和核心逻辑
│   ├── encryption.ts   # 客户端加密功能
│   ├── walrus.ts       # Walrus 存储集成
│   └── utils.ts        # 通用工具函数
├── pages/              # 页面组件
│   ├── Index.tsx       # 首页
│   ├── Record.tsx      # 情感记录页面
│   ├── Timeline.tsx    # 时间线页面
│   └── NotFound.tsx   # 404 页面
└── App.tsx             # 应用入口
```

## 🔐 安全特性

### 客户端加密

所有情感数据在离开设备前使用 **AES-GCM 256 位加密**：

- 使用 PBKDF2 密钥派生（100,000 次迭代）
- 随机初始化向量 (IV) 和盐值
- 基于用户钱包地址生成加密密钥

### 数据流程

1. **记录** - 用户输入情感和描述
2. **加密** - 客户端使用 AES-GCM 加密数据
3. **存储** - 加密数据上传到 Walrus 去中心化存储
4. **验证** - 在 Sui 区块链上铸造 NFT 作为存储证明

## 🌐 网络配置

当前配置为 **Sui Testnet**：

- Sui RPC: `getFullnodeUrl("testnet")`
- Walrus Publisher: `https://publisher.walrus-testnet.walrus.space`
- Walrus Aggregator: `https://aggregator.walrus-testnet.walrus.space`

可在 `src/App.tsx` 中修改网络配置。

## 📝 使用说明

### 记录情感

1. 连接 Sui 钱包
2. 选择情感类型（喜悦、悲伤、愤怒等）
3. 调整强度滑块（0-100%）
4. 输入描述文字
5. 点击"记录并铸造 NFT"

### 查看时间线

在时间线页面可以查看所有已记录的情感快照，包括：
- 情感类型和强度
- 记录时间
- Walrus 存储 ID
- 区块链验证状态

## 🚧 开发计划

- [ ] 实现 Sui Move 合约用于 NFT 铸造
- [ ] 添加情感数据解密和查看功能
- [ ] 实现数据导出功能
- [ ] 添加情感趋势分析图表
- [ ] 支持多链网络切换

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目为 Haulout Hackathon 参赛作品。

## 🔗 相关链接

- [Sui 区块链文档](https://docs.sui.io/)
- [Walrus 存储文档](https://docs.walrus.space/)
- [shadcn/ui 文档](https://ui.shadcn.com/)

---

**注意**: 本项目目前处于开发阶段，部分功能（如 NFT 铸造）尚未完全实现。
