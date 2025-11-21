#!/bin/bash
# 升级 Mainnet 合约以支持 Seal Access Policies

set -e  # 遇到错误立即退出

echo "🚀 开始升级 Mainnet 合约..."
echo "=========================================="

# 配置
UPGRADE_CAP="0x3a77fa6d7a4392509d5e998aacc3e4e405411a76b75028cf7662e072b539c10d"
OLD_PACKAGE_ID="0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9"
GAS_BUDGET="100000000"  # 100 MIST = 0.1 SUI

# 颜色输出
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 升级配置:${NC}"
echo "   UpgradeCap ID: $UPGRADE_CAP"
echo "   当前 Package ID: $OLD_PACKAGE_ID"
echo "   Gas Budget: $GAS_BUDGET MIST"
echo ""

# 1. 切换到 mainnet
echo -e "${YELLOW}1️⃣ 切换到 Mainnet...${NC}"
sui client switch --env mainnet
echo -e "${GREEN}✅ 已切换到 Mainnet${NC}"
echo ""

# 2. 检查余额
echo -e "${YELLOW}2️⃣ 检查钱包余额...${NC}"
BALANCE=$(sui client balance --json | jq -r '.[] | select(.coinType == "0x2::sui::SUI") | .totalBalance' 2>/dev/null || echo "0")
BALANCE_SUI=$(echo "scale=4; $BALANCE / 1000000000" | bc)
echo "   当前余额: $BALANCE_SUI SUI"

if (( $(echo "$BALANCE < 100000000" | bc -l) )); then
    echo -e "${RED}❌ 余额不足！需要至少 0.1 SUI 支付 gas 费用${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 余额充足${NC}"
echo ""

# 3. 进入合约目录
echo -e "${YELLOW}3️⃣ 准备合约代码...${NC}"
cd nft_mint_test
echo "   当前目录: $(pwd)"
echo ""

# 4. 清理并重新编译
echo -e "${YELLOW}4️⃣ 编译合约...${NC}"
echo "   清理旧的 build..."
rm -rf build/
echo "   开始编译..."
sui move build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 编译失败！${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 编译成功${NC}"
echo ""

# 5. 显示编译的模块
echo -e "${YELLOW}5️⃣ 检查编译结果...${NC}"
echo "   编译的模块:"
ls -la build/nft_mint_test/sources/*.mv | awk -F/ '{print "   - " $NF}' | sed 's/.mv$//'
echo ""

# 6. 执行升级（需要用户确认）
echo -e "${YELLOW}6️⃣ 准备执行升级...${NC}"
echo -e "${RED}⚠️  警告: 这将花费真实的 SUI 代币！${NC}"
echo ""
echo "升级命令:"
echo "sui client upgrade \\"
echo "  --upgrade-capability $UPGRADE_CAP \\"
echo "  --gas-budget $GAS_BUDGET"
echo ""

read -p "确认执行升级？(输入 yes 继续): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}❌ 升级已取消${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}⏳ 正在升级合约...${NC}"
echo "   这可能需要几秒钟时间..."
echo ""

# 执行升级并保存结果
UPGRADE_OUTPUT=$(sui client upgrade \
  --upgrade-capability "$UPGRADE_CAP" \
  --gas-budget "$GAS_BUDGET" \
  --json 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 升级失败！${NC}"
    echo "$UPGRADE_OUTPUT"
    exit 1
fi

echo "$UPGRADE_OUTPUT" > /tmp/mainnet_upgrade.json

# 7. 提取结果
echo -e "${GREEN}✅ 升级成功！${NC}"
echo ""
echo -e "${YELLOW}7️⃣ 提取升级结果...${NC}"

# 提取新的 Package ID（应该和旧的一样，因为是升级）
NEW_PACKAGE_ID=$(echo "$UPGRADE_OUTPUT" | jq -r '.effects.created[] | select(.owner == "Immutable") | .reference.objectId' 2>/dev/null | head -1)
if [ -z "$NEW_PACKAGE_ID" ]; then
    # 如果没有新创建的，说明 Package ID 保持不变
    NEW_PACKAGE_ID="$OLD_PACKAGE_ID"
fi

# 提取 PolicyRegistry ID（从 objectChanges 中查找）
POLICY_REGISTRY_ID=$(echo "$UPGRADE_OUTPUT" | jq -r '.objectChanges[] | select(.type == "created" and (.objectType | contains("PolicyRegistry"))) | .objectId' 2>/dev/null | head -1)

# 提取交易 digest
TX_DIGEST=$(echo "$UPGRADE_OUTPUT" | jq -r '.digest' 2>/dev/null)

echo "   Package ID: $NEW_PACKAGE_ID"
echo "   PolicyRegistry ID: $POLICY_REGISTRY_ID"
echo "   Transaction Digest: $TX_DIGEST"
echo ""

# 8. 保存升级信息
echo -e "${YELLOW}8️⃣ 保存升级信息...${NC}"

DEPLOY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > deploy-info-mainnet.json <<EOF
{
  "network": "mainnet",
  "packageId": "$NEW_PACKAGE_ID",
  "policyRegistryId": "$POLICY_REGISTRY_ID",
  "upgradeCap": "$UPGRADE_CAP",
  "transactionDigest": "$TX_DIGEST",
  "deployedAt": "$DEPLOY_TIME",
  "modules": [
    "diary",
    "diary_with_policy",
    "seal_access_policies"
  ],
  "upgradeInfo": {
    "upgradedFrom": "$OLD_PACKAGE_ID",
    "upgradeType": "add_seal_policies"
  },
  "explorerUrl": "https://suiexplorer.com/?network=mainnet&object=$NEW_PACKAGE_ID"
}
EOF

echo -e "${GREEN}✅ 升级信息已保存到 deploy-info-mainnet.json${NC}"
echo ""

# 9. 显示浏览器链接
echo "=========================================="
echo -e "${GREEN}🎉 升级完成！${NC}"
echo ""
echo "📝 升级详情:"
echo "   Package ID: $NEW_PACKAGE_ID"
echo "   PolicyRegistry ID: $POLICY_REGISTRY_ID"
echo ""
echo "🔗 浏览器链接:"
echo "   Package: https://suiexplorer.com/?network=mainnet&object=$NEW_PACKAGE_ID"
if [ -n "$POLICY_REGISTRY_ID" ]; then
    echo "   PolicyRegistry: https://suiexplorer.com/?network=mainnet&object=$POLICY_REGISTRY_ID"
fi
echo "   Transaction: https://suiexplorer.com/?network=mainnet&txblock=$TX_DIGEST"
echo ""
echo -e "${YELLOW}📋 下一步:${NC}"
echo "   1. 运行验证脚本: ./scripts/verify-mainnet-upgrade.sh"
echo "   2. 更新前端配置: src/lib/policyRegistry.ts"
echo "   3. 测试 Seal Access Policies 功能"
echo ""

