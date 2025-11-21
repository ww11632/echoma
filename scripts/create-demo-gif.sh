#!/bin/bash
# scripts/create-demo-gif.sh
# 快速创建 echōma Demo GIF

set -e

echo "🎬 echōma Demo GIF 制作工具"
echo "================================"
echo ""

# 检查依赖
echo "📦 检查依赖..."

if ! command -v gifski &> /dev/null; then
    echo "❌ 未安装 gifski"
    echo "📥 正在安装 gifski..."
    brew install gifski
fi

if ! command -v gifsicle &> /dev/null; then
    echo "❌ 未安装 gifsicle"
    echo "📥 正在安装 gifsicle..."
    brew install gifsicle
fi

echo "✅ 所有依赖已安装"
echo ""

# 创建目录
mkdir -p public/demos
mkdir -p temp

echo "📹 录制指南："
echo "================================"
echo ""
echo "请使用以下方式录制屏幕："
echo ""
echo "方法 1：QuickTime Player (推荐)"
echo "  1. 打开 QuickTime Player"
echo "  2. 文件 → 新建屏幕录制"
echo "  3. 选择录制区域（建议 1280x720）"
echo "  4. 录制以下流程（约 20 秒）："
echo "     - [0-3s]  打开 echōma → 连接钱包"
echo "     - [3-6s]  撰写日记内容"
echo "     - [6-9s]  点击加密（展示参数）"
echo "     - [9-12s] 上传到 Walrus"
echo "     - [12-15s] 鑄造 NFT"
echo "     - [15-18s] 创建 Seal Policy"
echo "     - [18-20s] 查看时间线"
echo "  5. 保存为 demo.mov"
echo ""
echo "方法 2：使用 OBS Studio"
echo "  下载：https://obsproject.com/"
echo ""
echo "================================"
echo ""

# 等待用户录制
read -p "📹 录制完成后，请将视频文件保存为 'demo.mov' 并放在当前目录，然后按 Enter 继续..."

if [ ! -f "demo.mov" ]; then
    echo "❌ 未找到 demo.mov 文件"
    echo "请确保视频文件名为 'demo.mov' 并放在项目根目录"
    exit 1
fi

echo ""
echo "🔄 正在转换为 GIF..."

# 转换为 GIF
gifski \
    --fps 10 \
    --quality 90 \
    --width 1280 \
    --output temp/demo-raw.gif \
    demo.mov

echo "✅ GIF 转换完成"
echo ""

# 获取原始文件大小
RAW_SIZE=$(du -h temp/demo-raw.gif | cut -f1)
echo "📊 原始文件大小: $RAW_SIZE"
echo ""

# 优化 GIF
echo "🎨 正在优化 GIF（减小文件大小）..."
gifsicle -O3 --lossy=80 --colors 256 \
    -o public/demos/demo.gif \
    temp/demo-raw.gif

echo "✅ GIF 优化完成"
echo ""

# 获取优化后文件大小
FINAL_SIZE=$(du -h public/demos/demo.gif | cut -f1)
echo "📊 优化后文件大小: $FINAL_SIZE"
echo ""

# 创建不同尺寸版本
echo "📐 创建不同尺寸版本..."

# 小尺寸版本（适用于 GitHub README）
gifsicle --scale 0.75 -O3 \
    -o public/demos/demo-small.gif \
    public/demos/demo.gif

# 中等尺寸版本
gifsicle --scale 0.5 -O3 \
    -o public/demos/demo-medium.gif \
    public/demos/demo.gif

echo "✅ 已创建多个尺寸版本"
echo ""

# 显示文件信息
echo "📦 生成的文件："
echo "================================"
ls -lh public/demos/*.gif | awk '{print $9, "-", $5}'
echo ""

# 生成 Markdown 代码
echo "📝 Markdown 使用代码："
echo "================================"
echo ""
echo "## 🎬 Demo"
echo ""
echo "![echōma Demo](./public/demos/demo.gif)"
echo ""
echo "或者使用 HTML 控制尺寸："
echo ""
echo '<div align="center">'
echo '  <img src="./public/demos/demo.gif" alt="echōma Demo" width="100%" />'
echo '</div>'
echo ""
echo "================================"
echo ""

# 清理临时文件
read -p "🗑️  是否删除原始视频文件 demo.mov？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm demo.mov
    echo "✅ 已删除 demo.mov"
fi

rm -rf temp
echo "✅ 已清理临时文件"
echo ""

echo "🎉 Demo GIF 制作完成！"
echo ""
echo "📍 文件位置："
echo "   - 完整版: public/demos/demo.gif ($FINAL_SIZE)"
echo "   - 小尺寸: public/demos/demo-small.gif"
echo "   - 中等尺寸: public/demos/demo-medium.gif"
echo ""
echo "💡 下一步："
echo "   1. 查看 GIF 效果: open public/demos/demo.gif"
echo "   2. 更新 README.md 添加 GIF"
echo "   3. 提交到 Git: git add public/demos/ && git commit -m 'Add demo GIF'"
echo ""

