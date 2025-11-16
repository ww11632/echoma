#!/bin/bash

# 从交易摘要中提取 Package ID 和 UpgradeCap ID

TX_DIGEST="${1:-BSFreoSf5M38J8QkNgNhLJ6cnYpfAGNTroU5ULFCpLSS}"

echo "🔍 提取 Package ID 和 UpgradeCap ID..."
echo "交易摘要: $TX_DIGEST"
echo ""

# 尝试获取交易详情
echo "正在查询交易..."
sui client tx-block "$TX_DIGEST" --json > /tmp/tx_result.json 2>&1

if [ $? -eq 0 ] && [ -s /tmp/tx_result.json ]; then
    echo "✅ 交易查询成功"
    echo ""
    
    # 提取 Package ID
    PACKAGE_ID=$(cat /tmp/tx_result.json | jq -r '.objectChanges[] | select(.type == "published") | .packageId' 2>/dev/null | head -1)
    
    # 提取 UpgradeCap ID
    UPGRADE_CAP=$(cat /tmp/tx_result.json | jq -r '.objectChanges[] | select(.type == "created" and (.objectType | contains("UpgradeCap"))) | .objectId' 2>/dev/null | head -1)
    
    if [ -n "$PACKAGE_ID" ] && [ "$PACKAGE_ID" != "null" ]; then
        echo "📦 Package ID:"
        echo "   $PACKAGE_ID"
        echo ""
        
        if [ -n "$UPGRADE_CAP" ] && [ "$UPGRADE_CAP" != "null" ]; then
            echo "🔑 UpgradeCap ID:"
            echo "   $UPGRADE_CAP"
            echo ""
        fi
        
        echo "📝 更新代码中的 Package ID:"
        echo ""
        echo "1. 更新 src/lib/mintContract.ts:"
        echo "   const MAINNET_PACKAGE_ID = \"$PACKAGE_ID\";"
        echo ""
        echo "2. 更新 nft_mint_test/README.md 中的 Package ID"
        echo ""
        echo "🌐 在浏览器查看:"
        echo "   https://suiexplorer.com/?network=mainnet&object=$PACKAGE_ID"
    else
        echo "⚠️  无法从交易中提取 Package ID"
        echo "请手动在浏览器查看交易详情:"
        echo "   https://suiexplorer.com/txblock/$TX_DIGEST?network=mainnet"
        echo ""
        echo "或者稍后重试:"
        echo "   sui client tx-block $TX_DIGEST"
    fi
else
    echo "⚠️  交易查询失败或服务器响应慢"
    echo ""
    echo "请尝试以下方法:"
    echo ""
    echo "1. 在浏览器查看交易:"
    echo "   https://suiexplorer.com/txblock/$TX_DIGEST?network=mainnet"
    echo ""
    echo "2. 稍后重试 CLI 命令:"
    echo "   sui client tx-block $TX_DIGEST"
    echo ""
    echo "3. 查看最近的对象（可能包含新发布的 Package）:"
    echo "   sui client objects"
fi

rm -f /tmp/tx_result.json

