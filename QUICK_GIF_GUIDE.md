# 🎬 快速制作 Demo GIF 指南

> **10 分钟完成专业 Demo GIF**

---

## 🚀 快速开始（3 步完成）

### 步骤 1：安装工具
```bash
brew install gifski gifsicle
```

### 步骤 2：录制屏幕
使用 QuickTime Player 录制 20 秒操作演示

### 步骤 3：一键转换
```bash
chmod +x scripts/create-demo-gif.sh
./scripts/create-demo-gif.sh
```

---

## 📹 详细录制指南

### 使用 QuickTime Player（推荐 - macOS 内置）

1. **打开 QuickTime Player**
   - 应用程序 → QuickTime Player

2. **开始录制**
   - 菜单：文件 → 新建屏幕录制（⌘ Command + Control + N）
   - 点击录制按钮
   - 选择录制区域：
     - 全屏：点击屏幕任意位置
     - 区域：拖拽选择 1280x720 区域（推荐）

3. **录制操作流程（20 秒）**
   ```
   [0-3秒]   打开 echōma → 连接 Sui 钱包
   [3-6秒]   点击"新建日记本" → 创建成功
   [6-9秒]   撰写日记内容 → 点击"保存"
   [9-12秒]  显示加密参数（Argon2id）→ 上传 Walrus
   [12-15秒] 点击"铸造 NFT" → 交易确认
   [15-18秒] 创建 Seal Policy → 添加授权地址
   [18-20秒] 查看时间线 → 展示情感分析
   ```

4. **停止录制**
   - 点击顶部状态栏的停止按钮
   - 或按 ⌘ Command + Control + Esc

5. **保存视频**
   - 文件 → 存储
   - 文件名：`demo.mov`
   - 位置：echoma 项目根目录

---

## 🎨 录制技巧

### ✅ 最佳实践

1. **屏幕分辨率**
   - 推荐：1280x720（HD）
   - 最大：1920x1080（Full HD）
   - 原因：GIF 文件大小适中

2. **录制区域**
   - 只录制浏览器窗口
   - 隐藏不必要的浏览器扩展
   - 关闭其他标签页

3. **操作速度**
   - 不要太快（评审者需要看清）
   - 不要太慢（20 秒时间有限）
   - 每个操作停留 2-3 秒

4. **光标移动**
   - 移动要平滑
   - 关键操作前短暂停顿
   - 点击要明确

5. **界面准备**
   - 清空不必要的数据
   - 使用示例内容
   - 确保 UI 语言（中文或英文）

### ❌ 避免的错误

- ❌ 录制时收到通知弹窗
- ❌ 鼠标移动过快
- ❌ 录制区域包含桌面杂乱内容
- ❌ 网络延迟导致的等待时间过长
- ❌ 视频文件过大（> 50MB）

---

## 🛠️ 手动转换（如果不使用脚本）

### 转换为 GIF
```bash
gifski \
    --fps 10 \
    --quality 90 \
    --width 1280 \
    --output demo-raw.gif \
    demo.mov
```

### 优化 GIF
```bash
gifsicle -O3 --lossy=80 --colors 256 \
    -o public/demos/demo.gif \
    demo-raw.gif
```

### 创建小尺寸版本
```bash
# 75% 大小
gifsicle --scale 0.75 -O3 \
    -o public/demos/demo-small.gif \
    public/demos/demo.gif

# 50% 大小
gifsicle --scale 0.5 -O3 \
    -o public/demos/demo-medium.gif \
    public/demos/demo.gif
```

---

## 📐 GIF 参数说明

### FPS（帧率）
```bash
--fps 10   # 推荐：流畅且文件小
--fps 15   # 更流畅，但文件大
--fps 24   # 视频级，文件很大
```

### Quality（质量）
```bash
--quality 80   # 适中，文件小
--quality 90   # 推荐：质量好
--quality 100  # 最高质量，文件大
```

### Width（宽度）
```bash
--width 1280   # 推荐：Full HD
--width 960    # 中等
--width 640    # 小尺寸
```

### Lossy（有损压缩）
```bash
--lossy=80   # 推荐：平衡质量与大小
--lossy=60   # 更小，质量下降明显
--lossy=100  # 最大压缩
```

---

## 📊 文件大小优化

### 目标文件大小
- GitHub README：< 10MB（推荐 < 5MB）
- 社交媒体：< 5MB
- 网站嵌入：< 3MB

### 如果文件过大

**方法 1：降低帧率**
```bash
gifski --fps 8 --quality 90 --width 1280 demo.mov -o demo.gif
```

**方法 2：减小尺寸**
```bash
gifski --fps 10 --quality 90 --width 960 demo.mov -o demo.gif
```

**方法 3：增加压缩**
```bash
gifsicle -O3 --lossy=90 --colors 128 -o demo-compressed.gif demo.gif
```

**方法 4：缩短视频**
- 重新录制，只保留最核心的 15 秒

---

## 🎬 替代方案：使用其他工具

### 方案 A：OBS Studio（跨平台）

**安装：**
```bash
brew install --cask obs
```

**录制步骤：**
1. 打开 OBS Studio
2. 添加来源 → 显示器捕获
3. 设置 → 输出 → 录制格式：MP4
4. 开始录制（⌘ Command + Control + R）
5. 停止录制

**转换为 GIF：**
```bash
ffmpeg -i demo.mp4 \
    -vf "fps=10,scale=1280:-1:flags=lanczos" \
    -c:v gif \
    demo.gif
```

---

### 方案 B：直接录制 GIF（LICEcap）

**安装：**
```bash
brew install --cask licecap
```

**优点：**
- ✅ 直接生成 GIF
- ✅ 实时预览文件大小
- ✅ 界面简单

**缺点：**
- ❌ 质量不如 gifski
- ❌ 文件通常较大

---

### 方案 C：在线转换（CloudConvert）

**网址：** https://cloudconvert.com/mov-to-gif

**步骤：**
1. 上传 demo.mov
2. 设置参数：
   - FPS: 10
   - Width: 1280
   - Quality: 90
3. 转换并下载

**优点：**
- ✅ 无需安装工具
- ✅ 支持多种格式

**缺点：**
- ❌ 需要上传文件
- ❌ 可能有文件大小限制

---

## 📝 更新 README

### 在 README.md 中添加 GIF

```markdown
## 🎬 Demo

<div align="center">
  <img src="./public/demos/demo.gif" alt="echōma Demo" width="100%" />
</div>

### 快速预览

![echōma 操作演示](./public/demos/demo.gif)

---
```

### 在 README.zh.md 中添加

```markdown
## 🎬 演示

<div align="center">
  <img src="./public/demos/demo.gif" alt="echōma 演示" width="100%" />
</div>

### 快速预览

![echōma 操作演示](./public/demos/demo.gif)

---
```

---

## ✅ 检查清单

录制前：
- [ ] 安装 gifski 和 gifsicle
- [ ] 清理浏览器界面
- [ ] 准备示例数据
- [ ] 确保网络连接稳定
- [ ] 关闭通知

录制时：
- [ ] 录制区域 1280x720
- [ ] 操作流畅不卡顿
- [ ] 关键步骤清晰可见
- [ ] 总时长 15-20 秒
- [ ] 鼠标移动平滑

转换后：
- [ ] GIF 文件 < 10MB
- [ ] 画质清晰
- [ ] 帧率流畅（10fps）
- [ ] 循环播放正常
- [ ] 已优化文件大小

发布前：
- [ ] 在浏览器中预览 GIF
- [ ] 更新 README.md
- [ ] 提交到 Git
- [ ] 推送到 GitHub
- [ ] 验证 GitHub 显示正常

---

## 🎯 最终效果

### 预期文件：
```
public/demos/
├── demo.gif          (完整版，1280px，~5-8MB)
├── demo-small.gif    (小尺寸，960px，~3-5MB)
└── demo-medium.gif   (中等尺寸，640px，~2-3MB)
```

### 使用场景：
- **demo.gif** - GitHub README, 官网
- **demo-small.gif** - 文档内嵌
- **demo-medium.gif** - 社交媒体分享

---

## 🆘 常见问题

### Q1: GIF 文件太大（> 10MB）
**A:** 
```bash
# 降低帧率和尺寸
gifski --fps 8 --quality 85 --width 960 demo.mov -o demo.gif

# 再次优化
gifsicle -O3 --lossy=85 --colors 128 -o demo-final.gif demo.gif
```

### Q2: GIF 画质模糊
**A:**
```bash
# 提高质量，降低压缩
gifski --fps 10 --quality 95 --width 1280 demo.mov -o demo.gif
gifsicle -O3 --lossy=60 -o demo-final.gif demo.gif
```

### Q3: GIF 播放速度不对
**A:**
```bash
# 调整帧率
gifski --fps 12 demo.mov -o demo.gif  # 更快
gifski --fps 8 demo.mov -o demo.gif   # 更慢
```

### Q4: 转换时间太长
**A:**
- 使用更短的视频（15秒而不是 20秒）
- 降低输出分辨率（960px 而不是 1280px）
- 更新 gifski 到最新版本

### Q5: macOS 上找不到 gifski
**A:**
```bash
# 重新安装
brew uninstall gifski
brew install gifski

# 检查安装
which gifski
gifski --version
```

---

## 📚 参考资源

- **gifski 文档**: https://gif.ski/
- **gifsicle 文档**: https://www.lcdf.org/gifsicle/
- **OBS Studio**: https://obsproject.com/
- **FFmpeg**: https://ffmpeg.org/

---

## 🎉 完成！

录制好的 Demo GIF 将大大提升 echōma 的展示效果，让评审者和用户快速理解产品功能！

**下一步：**
1. 运行 `./scripts/create-demo-gif.sh`
2. 按照提示录制并转换
3. 更新 README 添加 GIF
4. 提交到 Git

🎬 Happy Recording!

