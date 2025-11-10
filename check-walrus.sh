#!/bin/bash

# Walrus 服务状态检查脚本

echo "🔍 检查 Walrus Testnet 服务状态..."
echo ""

# 检查 Upload Relay
echo "1. 检查 Upload Relay (upload-relay.testnet.walrus.space)..."
UPLOAD_RELAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://upload-relay.testnet.walrus.space/v1/tip-config --max-time 10)
if [ "$UPLOAD_RELAY_STATUS" = "200" ]; then
  echo "   ✅ Upload Relay 可用 (HTTP $UPLOAD_RELAY_STATUS)"
  echo "   获取 tip-config:"
  curl -s https://upload-relay.testnet.walrus.space/v1/tip-config | head -20
elif [ "$UPLOAD_RELAY_STATUS" = "404" ]; then
  echo "   ❌ Upload Relay 返回 404 - 端点不存在"
elif [ "$UPLOAD_RELAY_STATUS" = "000" ]; then
  echo "   ⚠️  Upload Relay 无法连接（超时或网络错误）"
else
  echo "   ⚠️  Upload Relay 返回 HTTP $UPLOAD_RELAY_STATUS"
fi
echo ""

# 检查 Aggregator
echo "2. 检查 Aggregator (aggregator.testnet.walrus.space)..."
AGGREGATOR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://aggregator.testnet.walrus.space/v1/health --max-time 10)
if [ "$AGGREGATOR_STATUS" = "200" ]; then
  echo "   ✅ Aggregator 可用 (HTTP $AGGREGATOR_STATUS)"
elif [ "$AGGREGATOR_STATUS" = "404" ]; then
  echo "   ❌ Aggregator 返回 404 - 端点不存在"
elif [ "$AGGREGATOR_STATUS" = "000" ]; then
  echo "   ⚠️  Aggregator 无法连接（超时或网络错误）"
else
  echo "   ⚠️  Aggregator 返回 HTTP $AGGREGATOR_STATUS"
fi
echo ""

# 总结
echo "📊 总结:"
if [ "$UPLOAD_RELAY_STATUS" = "200" ] && [ "$AGGREGATOR_STATUS" = "200" ]; then
  echo "   ✅ Walrus 服务可用！可以正常使用。"
  echo "   💡 建议：更新代码使用 @mysten/walrus SDK"
elif [ "$UPLOAD_RELAY_STATUS" = "404" ] || [ "$AGGREGATOR_STATUS" = "404" ]; then
  echo "   ❌ Walrus 服务端点不存在（404）"
  echo "   💡 可能原因："
  echo "      - 服务暂时不可用"
  echo "      - 端点地址已更改"
  echo "      - 需要使用不同的网络"
  echo "   💡 当前解决方案：数据会保存到本地（server/data/emotions.json）"
else
  echo "   ⚠️  Walrus 服务状态未知"
  echo "   💡 建议：检查网络连接或稍后重试"
fi
echo ""

