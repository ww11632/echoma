#!/bin/bash
# CI 檢查腳本：防止安全測試旗標出現在生產環境
# 檢查 .env.example、Dockerfile 和生產構建命令中是否包含安全測試相關的環境變數

set -e

ERROR_COUNT=0

# 定義要檢查的危險旗標
DANGEROUS_FLAGS=(
  "VITE_ENABLE_SECURITY_TESTS"
  "VITE_FORCE_ENABLE_SECURITY_TESTS"
)

# 定義要檢查的文件和模式
FILES_TO_CHECK=(
  ".env.example"
  "Dockerfile"
  "Dockerfile.*"
  "docker-compose.yml"
  "docker-compose.*.yml"
  "*.sh"
  "package.json"
)

echo "🔍 檢查安全測試旗標防漏..."

# 檢查 .env.example
if [ -f ".env.example" ]; then
  echo "檢查 .env.example..."
  for flag in "${DANGEROUS_FLAGS[@]}"; do
    if grep -q "$flag" .env.example 2>/dev/null; then
      echo "❌ 錯誤：.env.example 中發現危險旗標: $flag"
      echo "   .env.example 不應包含任何 VITE_*SECURITY_TESTS* 環境變數"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
  done
else
  echo "⚠️  警告：.env.example 不存在，建議創建此文件"
fi

# 檢查 Dockerfile
for dockerfile in Dockerfile Dockerfile.*; do
  if [ -f "$dockerfile" ]; then
    echo "檢查 $dockerfile..."
    for flag in "${DANGEROUS_FLAGS[@]}"; do
      if grep -qi "$flag" "$dockerfile" 2>/dev/null; then
        echo "❌ 錯誤：$dockerfile 中發現危險旗標: $flag"
        echo "   生產環境 Dockerfile 不應包含安全測試相關的環境變數"
        ERROR_COUNT=$((ERROR_COUNT + 1))
      fi
    done
  fi
done

# 檢查 docker-compose 文件
for compose_file in docker-compose.yml docker-compose.*.yml; do
  if [ -f "$compose_file" ]; then
    echo "檢查 $compose_file..."
    for flag in "${DANGEROUS_FLAGS[@]}"; do
      if grep -qi "$flag" "$compose_file" 2>/dev/null; then
        echo "❌ 錯誤：$compose_file 中發現危險旗標: $flag"
        echo "   生產環境 docker-compose 文件不應包含安全測試相關的環境變數"
        ERROR_COUNT=$((ERROR_COUNT + 1))
      fi
    done
  fi
done

# 檢查 package.json 中的構建腳本
if [ -f "package.json" ]; then
  echo "檢查 package.json 構建腳本..."
  for flag in "${DANGEROUS_FLAGS[@]}"; do
    if grep -q "$flag" package.json 2>/dev/null; then
      echo "❌ 錯誤：package.json 中發現危險旗標: $flag"
      echo "   構建腳本不應包含安全測試相關的環境變數"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
  done
fi

# 檢查所有 shell 腳本
for script in *.sh scripts/**/*.sh; do
  if [ -f "$script" ] && [ "$(basename "$script")" != "$(basename "$0")" ]; then
    echo "檢查 $script..."
    for flag in "${DANGEROUS_FLAGS[@]}"; do
      if grep -q "$flag.*=.*true" "$script" 2>/dev/null; then
        echo "❌ 錯誤：$script 中發現危險旗標設置: $flag=true"
        echo "   生產環境腳本不應設置安全測試相關的環境變數為 true"
        ERROR_COUNT=$((ERROR_COUNT + 1))
      fi
    done
  fi
done

# 總結
if [ $ERROR_COUNT -eq 0 ]; then
  echo "✅ 通過：未發現安全測試旗標洩漏"
  exit 0
else
  echo ""
  echo "❌ 失敗：發現 $ERROR_COUNT 個安全測試旗標洩漏問題"
  echo ""
  echo "修復建議："
  echo "1. 從 .env.example 中移除所有 VITE_*SECURITY_TESTS* 環境變數"
  echo "2. 從 Dockerfile 和 docker-compose 文件中移除安全測試相關的環境變數"
  echo "3. 從生產構建腳本中移除安全測試相關的環境變數"
  echo "4. 安全測試頁面應僅在開發環境或特殊測試場景中使用"
  exit 1
fi

