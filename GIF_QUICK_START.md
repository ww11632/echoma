# 🎬 制作 Demo GIF - 超快速指南

## 3 步完成（只需 10 分钟）

### 1️⃣ 安装工具（1 分钟）
```bash
brew install gifski gifsicle
```

### 2️⃣ 录制屏幕（5 分钟）
使用 **QuickTime Player**（macOS 内置）：

1. 打开 QuickTime → 文件 → 新建屏幕录制
2. 选择录制区域（1280x720）
3. 录制 20 秒操作：
   ```
   打开应用 → 连接钱包 → 写日记 → 加密 → 
   上传 → 铸造 NFT → 创建 Policy → 查看时间线
   ```
4. 停止录制（⌘ + Ctrl + Esc）
5. 保存为 `demo.mov` 到项目根目录

### 3️⃣ 一键转换（2 分钟）
```bash
./scripts/create-demo-gif.sh
```

## 完成！ 🎉

GIF 文件位置：`public/demos/demo.gif`

---

## 🚀 更快的方法（手动命令）

如果你已经有 `demo.mov`：

```bash
# 创建目录
mkdir -p public/demos

# 转换 + 优化（一行命令）
gifski --fps 10 --quality 90 --width 1280 demo.mov -o temp.gif && \
gifsicle -O3 --lossy=80 --colors 256 -o public/demos/demo.gif temp.gif && \
rm temp.gif

# 完成！
open public/demos/demo.gif
```

---

## 📝 录制检查清单

- [ ] 分辨率：1280x720
- [ ] 时长：15-20 秒
- [ ] 操作流畅，不要太快
- [ ] 关闭通知和弹窗
- [ ] 界面干净整洁

---

## 🎯 文件大小目标

- ✅ < 5MB - 完美
- ⚠️ 5-10MB - 可接受
- ❌ > 10MB - 需要优化

### 如果文件太大：

```bash
# 方法 1：降低质量
gifsicle -O3 --lossy=90 --colors 128 -o demo-compressed.gif demo.gif

# 方法 2：缩小尺寸
gifsicle --scale 0.75 -O3 -o demo-smaller.gif demo.gif

# 方法 3：降低帧率（重新转换）
gifski --fps 8 --quality 85 --width 960 demo.mov -o demo.gif
```

---

## 📸 添加到 README

```markdown
## 🎬 Demo

![Echoma Demo](./public/demos/demo.gif)
```

或使用 HTML 控制尺寸：

```html
<div align="center">
  <img src="./public/demos/demo.gif" alt="Echoma Demo" width="100%" />
</div>
```

---

## 🆘 遇到问题？

查看详细指南：[QUICK_GIF_GUIDE.md](./QUICK_GIF_GUIDE.md)

---

**就这么简单！** 🎬✨

