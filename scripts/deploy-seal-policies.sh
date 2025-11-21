#!/bin/bash

# 部署 Seal Access Policies 合约脚本
# 使用方法: ./scripts/deploy-seal-policies.sh [testnet|mainnet]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取网络参数
NETWORK=${1:-testnet}

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
    echo -e "${RED}错误: 网络必须是 testnet 或 mainnet${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}部署 Seal Access Policies 合约${NC}"
echo -e "${BLUE}网络: ${NETWORK}${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查是否在正确的目录
if [ ! -d "nft_mint_test" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

cd nft_mint_test

# 检查 Sui CLI 是否安装
if ! command -v sui &> /dev/null; then
    echo -e "${RED}错误: Sui CLI 未安装${NC}"
    echo -e "${YELLOW}请先安装 Sui CLI:${NC}"
    echo "  brew install sui"
    echo "  或"
    echo "  cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui"
    exit 1
fi

# 切换到正确的网络
echo -e "${BLUE}切换到 ${NETWORK} 网络...${NC}"
sui client switch --env $NETWORK

# 检查当前网络
CURRENT_NETWORK=$(sui client active-env)
if [ "$CURRENT_NETWORK" != "$NETWORK" ]; then
    echo -e "${RED}错误: 无法切换到 ${NETWORK} 网络${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 当前网络: ${CURRENT_NETWORK}${NC}"

# 检查余额
echo -e "${BLUE}检查余额...${NC}"
BALANCE_INFO=$(sui client balance --json 2>/dev/null || echo "")
BALANCE_MIST="0"
if [ -n "$BALANCE_INFO" ]; then
    BALANCE_MIST=$(echo "$BALANCE_INFO" | jq -r 'map(select(.coinType | contains("::sui::SUI"))) | .[0].totalBalance // "0"' 2>/dev/null || echo "0")
fi

BALANCE=$(awk -v bal="$BALANCE_MIST" 'BEGIN { printf "%.4f", bal / 1000000000 }')
echo -e "${GREEN}当前余额: ${BALANCE} SUI${NC}"

if [ "$BALANCE_MIST" -lt 1000000000 ]; then
    echo -e "${YELLOW}警告: 余额可能不足，建议至少 1 SUI${NC}"
    if [ "$NETWORK" == "testnet" ]; then
        echo -e "${BLUE}获取测试代币:${NC}"
        echo "  sui client faucet"
        read -p "是否现在获取测试代币? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sui client faucet
        fi
    fi
fi

# 编译合约
echo -e "${BLUE}编译合约...${NC}"
if ! sui move build; then
    echo -e "${RED}错误: 合约编译失败${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 合约编译成功${NC}"

# 发布合约
echo -e "${BLUE}发布合约到 ${NETWORK}...${NC}"
echo -e "${YELLOW}这可能需要一些时间，请耐心等待...${NC}"

PUBLISH_OUTPUT=$(sui client publish --gas-budget 100000000 --json 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}错误: 合约发布失败${NC}"
    echo "$PUBLISH_OUTPUT"
    exit 1
fi

# 解析发布结果
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId' 2>/dev/null || echo "")

if [ -z "$PACKAGE_ID" ]; then
    # 尝试其他方式解析
    PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | perl -ne 'if (/PackageID:\s*(0x[a-fA-F0-9]+)/) { print "$1\n"; exit }')
fi

if [ -z "$PACKAGE_ID" ]; then
    echo -e "${RED}错误: 无法从发布结果中提取 Package ID${NC}"
    echo "发布输出:"
    echo "$PUBLISH_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✓ 合约发布成功!${NC}"
echo -e "${GREEN}Package ID: ${PACKAGE_ID}${NC}"

# 查找 PolicyRegistry ID
echo -e "${BLUE}查找 PolicyRegistry ID...${NC}"

# 从交易结果中查找 PolicyRegistry
TRANSACTION_DIGEST=$(echo "$PUBLISH_OUTPUT" | jq -r '.digest' 2>/dev/null || echo "")

if [ -n "$TRANSACTION_DIGEST" ]; then
    echo -e "${BLUE}交易 Digest: ${TRANSACTION_DIGEST}${NC}"
    
    # 等待交易被索引
    echo -e "${BLUE}等待交易被索引...${NC}"
    sleep 3
    
    # 获取交易详情
    TX_DETAILS=$(sui client transaction $TRANSACTION_DIGEST --json 2>&1)
    
    # 查找 PolicyRegistry 对象
    # 方法1: 通过 objectType 查找
    POLICY_REGISTRY_ID=$(echo "$TX_DETAILS" | jq -r '.objectChanges[] | select(.objectType | contains("PolicyRegistry")) | .objectId' 2>/dev/null | head -1)
    
    if [ -z "$POLICY_REGISTRY_ID" ]; then
        # 方法2: 查找共享对象（type == "created" 且包含 PolicyRegistry）
        POLICY_REGISTRY_ID=$(echo "$TX_DETAILS" | jq -r '.objectChanges[] | select(.type == "created" and (.objectType | contains("PolicyRegistry") or .objectType | contains("policy"))) | .objectId' 2>/dev/null | head -1)
    fi
    
    if [ -z "$POLICY_REGISTRY_ID" ]; then
        # 方法3: 查找所有共享对象，然后筛选
        POLICY_REGISTRY_ID=$(echo "$TX_DETAILS" | jq -r '.objectChanges[] | select(.type == "created" and .objectType | test("(?i)policy.*registry|registry.*policy")) | .objectId' 2>/dev/null | head -1)
    fi
    
    if [ -z "$POLICY_REGISTRY_ID" ]; then
        # 方法4: 查找所有共享对象，然后通过包 ID 匹配
        PACKAGE_ID_SHORT=$(echo "$PACKAGE_ID" | cut -c 1-10)
        POLICY_REGISTRY_ID=$(echo "$TX_DETAILS" | jq -r --arg pkg "$PACKAGE_ID_SHORT" '.objectChanges[] | select(.type == "created" and .objectType | contains($pkg) and (.objectType | contains("PolicyRegistry") or .objectType | contains("policy"))) | .objectId' 2>/dev/null | head -1)
    fi
fi

# 生成配置信息
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}部署成功!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}请更新以下配置:${NC}"
echo ""
echo -e "${BLUE}1. Package ID:${NC}"
echo "   ${PACKAGE_ID}"
echo ""
echo -e "${BLUE}2. 更新代码中的 Package ID:${NC}"
if [ "$NETWORK" == "testnet" ]; then
    echo "   src/lib/mintContract.ts"
    echo "   const TESTNET_PACKAGE_ID = \"${PACKAGE_ID}\";"
else
    echo "   src/lib/mintContract.ts"
    echo "   const MAINNET_PACKAGE_ID = \"${PACKAGE_ID}\";"
fi
echo ""

if [ -n "$POLICY_REGISTRY_ID" ]; then
    echo -e "${GREEN}✓ PolicyRegistry ID: ${POLICY_REGISTRY_ID}${NC}"
    echo ""
    echo -e "${BLUE}3. 配置 PolicyRegistry ID:${NC}"
    echo "   PolicyRegistry ID: ${POLICY_REGISTRY_ID}"
    echo ""
    echo -e "${GREEN}推荐方式：在应用中使用设置界面配置${NC}"
    echo "   1. 打开应用，进入 Timeline 页面"
    echo "   2. 点击右上角的「PolicyRegistry 設定」按钮"
    echo "   3. 输入以下 ID 并保存："
    echo "      ${POLICY_REGISTRY_ID}"
    echo ""
    echo -e "${YELLOW}或者运行以下命令保存到本地存储:${NC}"
    echo "   # 在浏览器控制台中运行"
    echo "   localStorage.setItem('sui_policy_registry_${NETWORK}', '${POLICY_REGISTRY_ID}');"
else
    echo -e "${YELLOW}⚠ PolicyRegistry ID 未找到${NC}"
    echo ""
    echo -e "${BLUE}请手动查找 PolicyRegistry ID:${NC}"
    echo "   1. 访问 Sui Explorer:"
    echo "      https://suiexplorer.com/?network=${NETWORK}&txblock=${TRANSACTION_DIGEST}"
    echo ""
    echo "   2. 在交易结果中查找类型为 'PolicyRegistry' 的共享对象"
    echo ""
    echo "   3. 复制对象 ID 并配置到应用中"
fi

echo ""
echo -e "${BLUE}4. 验证部署:${NC}"
echo "   sui client object ${PACKAGE_ID}"
echo ""
echo -e "${BLUE}5. 查看合约:${NC}"
echo "   https://suiexplorer.com/?network=${NETWORK}&object=${PACKAGE_ID}"
echo ""

# 保存部署信息到文件
DEPLOY_INFO_FILE="deploy-info-${NETWORK}.json"
cat > "$DEPLOY_INFO_FILE" <<EOF
{
  "network": "${NETWORK}",
  "packageId": "${PACKAGE_ID}",
  "policyRegistryId": "${POLICY_REGISTRY_ID:-}",
  "transactionDigest": "${TRANSACTION_DIGEST:-}",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo -e "${GREEN}✓ 部署信息已保存到: ${DEPLOY_INFO_FILE}${NC}"
echo ""

cd ..
