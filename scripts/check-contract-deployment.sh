#!/bin/bash

# 檢查 Sui 合約部署狀態腳本

PACKAGE_ID="0x55f1c575f979ad2b16c264191627ca6716c9b0b397ab041280da1ad6bce37e71"
NETWORK="testnet"

echo "🔍 檢查 Sui 合約部署狀態..."
echo ""
echo "Package ID: $PACKAGE_ID"
echo "Network: $NETWORK"
echo ""

# 檢查 Sui CLI 是否安裝
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI 未安裝"
    echo "請先安裝 Sui CLI:"
    echo "  cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui"
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
    echo "1. 進入合約目錄: cd nft_mint_test"
    echo "2. 編譯合約: sui move build"
    echo "3. 發布合約: sui client publish --gas-budget 100000000"
    echo "4. 更新代碼中的 PACKAGE_ID"
    echo ""
    echo "詳細說明請參考: nft_mint_test/DEPLOY.md"
    exit 1
elif echo "$OBJECT_INFO" | grep -q "error"; then
    echo "⚠️  檢查合約時發生錯誤"
    echo "$OBJECT_INFO"
    exit 1
else
    echo "✅ 合約已部署！"
    echo ""
    echo "合約信息:"
    echo "$OBJECT_INFO" | head -20
    echo ""
    echo "🌐 在瀏覽器查看:"
    echo "https://suiexplorer.com/?network=$NETWORK&object=$PACKAGE_ID"
fi

