#!/bin/bash

# 檢查 Sui Mainnet 合約部署狀態腳本

# Mainnet Package ID
PACKAGE_ID="${MAINNET_PACKAGE_ID:-0x962039ad659c57c87206546c0dd9f801e7c679d9cced3edea2b6f411ed603c3c}"
NETWORK="mainnet"

echo "🔍 檢查 Sui Mainnet 合約部署狀態..."
echo ""
echo "Package ID: $PACKAGE_ID"
echo "Network: $NETWORK"
echo ""

# 檢查 Sui CLI 是否安裝
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI 未安裝"
    echo "請先安裝 Sui CLI:"
    echo "  cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui"
    exit 1
fi

echo "✅ Sui CLI 已安裝"
echo ""

# 檢查當前網絡
CURRENT_ENV=$(sui client active-env 2>/dev/null | grep -oP '(?<=Active environment: ).*' || echo "unknown")

if [ "$CURRENT_ENV" != "$NETWORK" ]; then
    echo "⚠️  當前環境: $CURRENT_ENV"
    echo "切換到 $NETWORK..."
    sui client switch --env $NETWORK 2>/dev/null || {
        echo "❌ 無法切換到 $NETWORK"
        echo ""
        echo "💡 提示：如果 mainnet 環境不存在，請先添加："
        echo "  sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443"
        exit 1
    }
fi

echo "✅ 當前環境: $NETWORK"
echo ""

# 檢查合約是否已部署
echo "檢查合約是否已部署..."
OBJECT_INFO=$(sui client object $PACKAGE_ID 2>&1)

if echo "$OBJECT_INFO" | grep -q "Object not found"; then
    echo "❌ 合約未部署到 $NETWORK"
    echo ""
    echo "📝 部署步驟："
    echo "1. 確保已切換到 mainnet: sui client switch --env mainnet"
    echo "2. 進入合約目錄: cd nft_mint_test"
    echo "3. 編譯合約: sui move build"
    echo "4. 發布合約到 mainnet: sui client publish --gas-budget 100000000"
    echo "5. 更新代碼中的 MAINNET_PACKAGE_ID"
    echo ""
    echo "⚠️  注意：Mainnet 需要真實的 SUI 代幣支付 gas 費用"
    echo ""
    echo "詳細說明請參考: nft_mint_test/DEPLOY.md"
    exit 1
elif echo "$OBJECT_INFO" | grep -q "error"; then
    echo "⚠️  檢查合約時發生錯誤"
    echo "$OBJECT_INFO"
    exit 1
else
    echo "✅ 合約已部署到 Mainnet！"
    echo ""
    echo "合約信息:"
    echo "$OBJECT_INFO" | head -30
    echo ""
    echo "🌐 在瀏覽器查看:"
    echo "https://suiexplorer.com/?network=mainnet&object=$PACKAGE_ID"
    echo ""
    echo "📊 合約統計:"
    # 嘗試獲取更多合約信息
    sui client object $PACKAGE_ID --json 2>/dev/null | jq -r '
        "Package ID: \(.data.objectId // "N/A")
Version: \(.data.content.fields.version // "N/A")
Publisher: \(.data.content.fields.publisher // "N/A")" 2>/dev/null || echo "無法解析合約詳細信息"
fi

