# 功能测试指南

## 🎯 测试目标

验证已修复的 7 个高优先级逻辑问题在实际使用场景中的表现。

---

## 🚀 启动测试环境

### 1. 启动开发服务器

```bash
# 终端 1: 启动前端开发服务器
npm run dev

# 终端 2: 启动后端 API 服务器（如果需要）
npm run server
```

前端将在 `http://localhost:5173` 启动。

---

## 📋 测试清单

### ✅ 测试 1: 时间戳格式一致性

**目标**: 验证所有记录的时间戳都使用 ISO 字符串格式

**步骤**:
1. 打开浏览器开发者工具（F12）
2. 进入 Console 标签
3. 创建一个新记录（选择情绪、输入描述、保存）
4. 在 Console 中执行：
   ```javascript
   // 检查本地存储中的记录
   const localData = localStorage.getItem('echoma_encrypted_mvp_records') || 
                     localStorage.getItem('echoma_mvp_records');
   if (localData) {
     const records = JSON.parse(localData);
     console.log('Timestamp format:', records[0]?.timestamp);
     console.log('Is ISO string?', typeof records[0]?.timestamp === 'string' && 
                 records[0]?.timestamp.includes('T'));
   }
   ```

**预期结果**:
- ✅ 时间戳格式为 ISO 字符串（如 `2025-01-15T10:30:00.000Z`）
- ✅ 不是数字时间戳

---

### ✅ 测试 2: 组件卸载安全（setTimeout 导航）

**目标**: 验证组件卸载后不会尝试导航，避免内存泄漏

**步骤**:
1. 打开浏览器开发者工具（F12）
2. 进入 Console 标签
3. 创建一个新记录
4. **在保存成功后、导航发生前（约 1-1.5 秒内）**，快速点击浏览器的返回按钮或关闭标签页
5. 检查 Console 是否有 React 警告

**预期结果**:
- ✅ 无 React 警告（如 "Can't perform a React state update on an unmounted component"）
- ✅ 无内存泄漏警告
- ✅ 导航不会在组件卸载后执行

**验证代码**:
```javascript
// 在 Console 中检查是否有警告
console.log('检查完成：应该没有 React 警告')
```

---

### ✅ 测试 3: localStorage 并发保存（锁机制）

**目标**: 验证快速连续保存多个记录时不会丢失数据

**步骤**:
1. 打开浏览器开发者工具（F12）
2. 进入 Console 标签
3. 快速连续创建 5-10 个记录（每次保存后立即创建下一个）
4. 等待所有保存完成
5. 检查 Timeline 页面，验证所有记录都存在

**预期结果**:
- ✅ 所有记录都成功保存
- ✅ 无数据丢失
- ✅ 记录按时间正确排序
- ✅ Console 中无错误信息

**验证代码**:
```javascript
// 在 Console 中检查记录数量
const localData = localStorage.getItem('echoma_encrypted_mvp_records') || 
                  localStorage.getItem('echoma_mvp_records');
if (localData) {
  const records = JSON.parse(localData);
  console.log('保存的记录数量:', records.length);
  console.log('所有记录 ID:', records.map(r => r.id));
}
```

---

### ✅ 测试 4: 去重逻辑（优先使用 id）

**目标**: 验证 Timeline 正确去重，优先使用 `id` 作为主键

**步骤**:
1. 创建一个记录（记录其 ID）
2. 在本地存储中手动复制该记录，修改 `created_at` 为更早的时间
3. 刷新 Timeline 页面
4. 检查是否只显示一个记录（最新的）

**预期结果**:
- ✅ 只显示一个记录（保留最新的）
- ✅ Console 中显示去重日志（如 "Dedup: keeping..." 或 "Dedup: replacing..."）

**验证代码**:
```javascript
// 在 Console 中检查去重逻辑
// 应该看到类似这样的日志：
// "[Timeline] Dedup: keeping ... (same id, older or equal timestamp)"
// 或
// "[Timeline] Dedup: replacing ... with ... (same id, newer timestamp)"
```

---

### ✅ 测试 5: 强度值保存

**目标**: 验证情绪强度值正确保存和显示

**步骤**:
1. 创建一个记录，设置强度值为 80
2. 保存记录
3. 进入 Timeline 页面
4. 检查记录的强度值是否显示为 80

**预期结果**:
- ✅ 强度值正确保存（80）
- ✅ Timeline 中正确显示强度值
- ✅ 强度值不为 undefined 或 null

**验证代码**:
```javascript
// 在 Console 中检查强度值
const localData = localStorage.getItem('echoma_encrypted_mvp_records') || 
                  localStorage.getItem('echoma_mvp_records');
if (localData) {
  const records = JSON.parse(localData);
  const lastRecord = records[records.length - 1];
  console.log('强度值:', lastRecord?.intensity);
  console.log('强度值类型:', typeof lastRecord?.intensity);
}
```

---

### ✅ 测试 6: 加密密钥选择一致性

**目标**: 验证公开记录和私密记录使用正确的加密密钥

**步骤**:
1. 创建一个**公开记录**（isPublic = true）
2. 创建一个**私密记录**（isPublic = false）
3. 检查本地存储中的密钥使用情况

**预期结果**:
- ✅ 公开记录存储在 `echoma_encrypted_public_records`
- ✅ 私密记录存储在 `echoma_encrypted_mvp_records`
- ✅ 两者使用不同的加密密钥

**验证代码**:
```javascript
// 在 Console 中检查存储位置
const publicData = localStorage.getItem('echoma_encrypted_public_records');
const privateData = localStorage.getItem('echoma_encrypted_mvp_records');

console.log('公开记录存在?', !!publicData);
console.log('私密记录存在?', !!privateData);
console.log('存储分离正确?', publicData && privateData);
```

---

### ✅ 测试 7: 钱包连接检查

**目标**: 验证在保存过程中断开钱包时，错误处理正确

**步骤**:
1. 连接钱包
2. 开始创建记录（选择情绪、输入描述）
3. **在点击保存后、上传完成前**，断开钱包连接
4. 检查错误消息

**预期结果**:
- ✅ 显示友好的错误消息（如 "Wallet disconnected during operation..."）
- ✅ 不会导致应用崩溃
- ✅ 用户可以重新连接钱包后重试

**注意**: 此测试需要精确的时机控制，可能需要多次尝试。

---

### ✅ 测试 8: 存储模式初始化

**目标**: 验证切换用户账户时，加密存储正确初始化

**步骤**:
1. 使用钱包 A 创建记录
2. 断开钱包 A，连接钱包 B
3. 尝试创建新记录
4. 检查是否提示需要清除旧数据或正确初始化新存储

**预期结果**:
- ✅ 如果检测到加密数据但无法解密，显示友好错误
- ✅ 如果无加密数据，正确初始化新存储
- ✅ 不会导致数据混合存储

---

### ✅ 测试 9: 删除操作状态一致性

**目标**: 验证删除操作失败时，记录仍然可见

**步骤**:
1. 创建一个记录
2. 进入 Timeline 页面
3. 尝试删除记录
4. **模拟删除失败**（可以临时断开网络或修改代码）
5. 检查记录是否仍然可见

**预期结果**:
- ✅ 如果删除失败，记录仍然在 Timeline 中显示
- ✅ 显示错误消息
- ✅ UI 状态与后端状态一致

---

### ✅ 测试 10: 批量删除错误处理

**目标**: 验证批量删除时，部分失败的处理

**步骤**:
1. 创建 5 个记录
2. 进入 Timeline 页面
3. 选择所有记录进行批量删除
4. **模拟部分删除失败**（可以临时断开网络）
5. 检查成功和失败的记录处理

**预期结果**:
- ✅ 成功删除的记录从 UI 中移除
- ✅ 失败删除的记录仍然可见
- ✅ 显示成功和失败的数量
- ✅ 失败的记录保持选中状态（可重试）

---

## 🔍 调试技巧

### 查看 Console 日志

所有关键操作都会在 Console 中输出日志，格式如下：
- `[Record]` - 记录创建相关
- `[Timeline]` - Timeline 相关
- `[LocalIndex]` - 本地存储相关
- `[StorageService]` - 存储服务相关

### 检查本地存储

```javascript
// 在 Console 中执行
console.log('公开记录:', localStorage.getItem('echoma_encrypted_public_records'));
console.log('私密记录:', localStorage.getItem('echoma_encrypted_mvp_records'));
console.log('明文记录:', localStorage.getItem('echoma_mvp_records'));
```

### 清除测试数据

```javascript
// 在 Console 中执行（谨慎使用）
localStorage.removeItem('echoma_encrypted_public_records');
localStorage.removeItem('echoma_encrypted_mvp_records');
localStorage.removeItem('echoma_mvp_records');
```

---

## 📊 测试结果记录

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 时间戳格式一致性 | ⬜ | |
| 组件卸载安全 | ⬜ | |
| localStorage 并发保存 | ⬜ | |
| 去重逻辑 | ⬜ | |
| 强度值保存 | ⬜ | |
| 加密密钥选择 | ⬜ | |
| 钱包连接检查 | ⬜ | |
| 存储模式初始化 | ⬜ | |
| 删除操作状态一致性 | ⬜ | |
| 批量删除错误处理 | ⬜ | |

---

## 🐛 发现问题时的处理

如果发现任何问题：

1. **记录问题**:
   - 截图或录屏
   - 复制 Console 错误信息
   - 记录复现步骤

2. **检查修复**:
   - 确认问题是否在修复范围内
   - 检查相关代码文件

3. **报告问题**:
   - 在 `进一步改进建议.md` 中添加新问题
   - 标记优先级和影响范围

---

## ✅ 测试完成标准

所有测试项通过后：
- ✅ 无数据丢失
- ✅ 无 React 警告
- ✅ 无控制台错误
- ✅ 用户体验流畅
- ✅ 错误处理友好

---



