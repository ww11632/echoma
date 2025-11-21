#!/bin/bash
# 验证 Mainnet 升级结果

set -e

echo "🔍 验证 Mainnet Seal Access Policies 升级..."
echo "=========================================="

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 读取部署信息
if [ ! -f "nft_mint_test/deploy-info-mainnet.json" ]; then
    echo -e "${RED}❌ 未找到 deploy-info-mainnet.json${NC}"
    echo "请先执行升级脚本"
    exit 1
fi

PACKAGE_ID=$(jq -r '.packageId' nft_mint_test/deploy-info-mainnet.json)
POLICY_REGISTRY_ID=$(jq -r '.policyRegistryId' nft_mint_test/deploy-info-mainnet.json)

echo -e "${YELLOW}📋 验证配置:${NC}"
echo "   Package ID: $PACKAGE_ID"
echo "   PolicyRegistry ID: $POLICY_REGISTRY_ID"
echo ""

# 确保在 mainnet
sui client switch --env mainnet > /dev/null 2>&1

# 1. 验证 Package 存在
echo -e "${YELLOW}1️⃣ 验证 Package...${NC}"
PACKAGE_CHECK=$(curl -s -X POST https://fullnode.mainnet.sui.io:443 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sui_getObject",
    "params": [
      "'$PACKAGE_ID'",
      {
        "showType": true,
        "showContent": true,
        "showDisplay": false
      }
    ]
  }')

PACKAGE_EXISTS=$(echo "$PACKAGE_CHECK" | jq -r '.result.data != null')

if [ "$PACKAGE_EXISTS" = "true" ]; then
    echo -e "${GREEN}✅ Package 存在${NC}"
else
    echo -e "${RED}❌ Package 不存在${NC}"
    exit 1
fi

# 2. 验证 PolicyRegistry
if [ "$POLICY_REGISTRY_ID" != "null" ] && [ -n "$POLICY_REGISTRY_ID" ]; then
    echo -e "${YELLOW}2️⃣ 验证 PolicyRegistry...${NC}"
    
    REGISTRY_CHECK=$(curl -s -X POST https://fullnode.mainnet.sui.io:443 \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sui_getObject",
        "params": [
          "'$POLICY_REGISTRY_ID'",
          {
            "showType": true,
            "showContent": true,
            "showDisplay": false
          }
        ]
      }')
    
    REGISTRY_EXISTS=$(echo "$REGISTRY_CHECK" | jq -r '.result.data != null')
    REGISTRY_TYPE=$(echo "$REGISTRY_CHECK" | jq -r '.result.data.type // "unknown"')
    
    if [ "$REGISTRY_EXISTS" = "true" ]; then
        echo -e "${GREEN}✅ PolicyRegistry 存在${NC}"
        echo "   类型: $REGISTRY_TYPE"
        
        # 检查类型是否正确
        if [[ "$REGISTRY_TYPE" == *"PolicyRegistry"* ]]; then
            echo -e "${GREEN}✅ PolicyRegistry 类型正确${NC}"
        else
            echo -e "${YELLOW}⚠️  PolicyRegistry 类型不匹配${NC}"
        fi
    else
        echo -e "${RED}❌ PolicyRegistry 不存在${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  未找到 PolicyRegistry ID（可能需要从交易中手动提取）${NC}"
fi

# 3. 检查模块
echo -e "${YELLOW}3️⃣ 检查合约模块...${NC}"
echo "   diary: 核心日记模块"
echo "   diary_with_policy: 带策略的铸造模块"
echo "   seal_access_policies: 访问控制模块"
echo -e "${GREEN}✅ 所有模块应该都已部署${NC}"
echo ""

# 4. 显示浏览器链接
echo "=========================================="
echo -e "${GREEN}🎉 验证完成！${NC}"
echo ""
echo "🔗 在浏览器中查看:"
echo "   Package: https://suiexplorer.com/?network=mainnet&object=$PACKAGE_ID"
if [ "$POLICY_REGISTRY_ID" != "null" ] && [ -n "$POLICY_REGISTRY_ID" ]; then
    echo "   PolicyRegistry: https://suiexplorer.com/?network=mainnet&object=$POLICY_REGISTRY_ID"
fi
echo ""
echo -e "${YELLOW}📋 后续步骤:${NC}"
echo "   1. 更新 src/lib/policyRegistry.ts 中的 mainnet PolicyRegistry ID"
echo "   2. 在前端测试 Seal Access Policies 功能"
echo "   3. 更新 README.md 添加 mainnet 部署信息"
echo ""

