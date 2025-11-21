#!/bin/bash
# 从 Mainnet 部署交易中提取 UpgradeCap ID

echo "🔍 查询 Mainnet 部署交易..."

MAINNET_TX="BSFreoSf5M38J8QkNgNhLJ6cnYpfAGNTroU5ULFCpLSS"

# 确保在 mainnet
sui client switch --env mainnet

# 查询交易详情
echo "📡 正在查询交易: $MAINNET_TX"

# 使用 curl 直接调用 Sui RPC
curl -s -X POST https://fullnode.mainnet.sui.io:443 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sui_getTransactionBlock",
    "params": [
      "'$MAINNET_TX'",
      {
        "showInput": true,
        "showRawInput": false,
        "showEffects": true,
        "showEvents": true,
        "showObjectChanges": true,
        "showBalanceChanges": false
      }
    ]
  }' > /tmp/mainnet_tx.json

# 提取 UpgradeCap ID
UPGRADE_CAP=$(cat /tmp/mainnet_tx.json | jq -r '.result.objectChanges[] | select(.type == "created" and (.objectType | contains("UpgradeCap"))) | .objectId' 2>/dev/null | head -1)

if [ -n "$UPGRADE_CAP" ]; then
    echo "✅ 找到 UpgradeCap ID:"
    echo "   $UPGRADE_CAP"
    echo ""
    echo "📝 保存到文件..."
    
    # 创建 mainnet 配置文件
    cat > nft_mint_test/deploy-info-mainnet.json <<EOF
{
  "network": "mainnet",
  "packageId": "0x6ec7914c755708fd77ed3fe0dc8aed25ec5ccae2ff781267da3a5ca3549535b9",
  "upgradeCap": "$UPGRADE_CAP",
  "transactionDigest": "$MAINNET_TX",
  "deployedAt": "2024-xx-xx",
  "modules": [
    "diary"
  ],
  "note": "Initial deployment - needs upgrade to add seal_access_policies"
}
EOF
    
    echo "✅ 已保存到 nft_mint_test/deploy-info-mainnet.json"
    echo ""
    echo "🔑 UpgradeCap ID: $UPGRADE_CAP"
    
else
    echo "❌ 未找到 UpgradeCap ID"
    echo "请检查交易详情:"
    cat /tmp/mainnet_tx.json | jq '.objectChanges'
fi

