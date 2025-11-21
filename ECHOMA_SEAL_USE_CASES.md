# 🔐 Echoma 中 Seal Access Policies 的实际用例

## 📱 Echoma 产品定位

Echoma 是一个**情绪日记应用**，用户记录：
- 情绪类型（joy, sadness, anger, anxiety, confusion, peace）
- 情绪强度（0-100）
- 情绪描述（加密存储）
- 时间戳和标签

**核心价值**：保护用户最私密的情绪数据，同时提供分享和协作的可能性。

---

## 🎯 在 Echoma 中的实际用例

### 1. 🏥 **与心理医生/治疗师分享情绪记录** ⭐⭐⭐⭐⭐

**场景描述：**
用户正在接受心理治疗，希望让心理医生看到自己的情绪日记，以便医生更好地了解自己的情绪变化和治疗进展。

**当前问题：**
- ❌ 如果设为公开，所有人都能看到（隐私泄露）
- ❌ 如果设为私有，医生无法访问
- ❌ 无法选择性分享给特定医生

**使用 Seal Policies 后：**
```typescript
// 用户创建治疗相关的情绪记录
const therapyRecord = await mintEntryWithPolicy(
  journalId,
  moodScore,
  "今天的治疗让我意识到...",
  ["therapy", "depression", "progress"],
  imageUrl,
  imageMime,
  imageHash,
  audioUrl,
  audioMime,
  audioHash,
  audioDuration,
  false,  // 私有记录，不公开
  policyRegistryId
);

// 授权心理医生访问
await grantAccess(therapyRecord.nftId, therapistAddress, policyRegistryId);
```

**用户价值：**
- ✅ 只授权给医生，保护隐私
- ✅ 医生可以看到完整的情绪变化趋势
- ✅ 可以更换医生而不丢失记录
- ✅ 可以授权多个医疗专业人员（如精神科医生 + 心理治疗师）

**实际使用流程：**
1. 用户在 Echoma 中记录情绪
2. 选择"分享给医生"选项
3. 输入医生的钱包地址（或通过二维码分享）
4. 医生可以访问这些记录，但其他人不能

---

### 2. 👨‍👩‍👧‍👦 **与伴侣/家人分享情绪记录** ⭐⭐⭐⭐

**场景描述：**
用户希望与伴侣或家人分享某些情绪记录，增进理解和沟通，但不想公开给所有人。

**当前问题：**
- ❌ 如果设为公开，所有人都能看到
- ❌ 如果设为私有，伴侣无法访问
- ❌ 无法选择性分享特定记录

**使用 Seal Policies 后：**
```typescript
// 用户创建关于关系的情绪记录
const relationshipRecord = await mintEntryWithPolicy(
  journalId,
  moodScore,
  "关于我们关系的思考...",
  ["relationship", "family", "love"],
  imageUrl,
  imageMime,
  imageHash,
  audioUrl,
  audioMime,
  audioHash,
  audioDuration,
  false,  // 私有记录
  policyRegistryId
);

// 授权伴侣访问
await grantAccess(relationshipRecord.nftId, partnerAddress, policyRegistryId);
```

**用户价值：**
- ✅ 可以创建"家庭共享"的情绪记录
- ✅ 增进伴侣/家人之间的理解和沟通
- ✅ 可以授权多个家庭成员
- ✅ 可以随时撤销授权（如关系结束）

**实际使用场景：**
- 夫妻分享情绪，增进理解
- 父母与孩子分享情绪，建立信任
- 兄弟姐妹分享情绪，互相支持

---

### 3. 📚 **治疗进展追踪与回顾** ⭐⭐⭐⭐

**场景描述：**
用户希望与治疗师一起追踪治疗进展，定期回顾情绪变化，但不想公开所有记录。

**使用 Seal Policies 后：**
```typescript
// 用户可以选择性地授权某些记录给治疗师
// 例如：只授权标记为 "therapy" 的记录
const therapyRecords = records.filter(r => r.tags.includes("therapy"));

for (const record of therapyRecords) {
  await grantAccess(record.nftId, therapistAddress, policyRegistryId);
}
```

**用户价值：**
- ✅ 可以选择性地分享相关记录
- ✅ 治疗师可以看到完整的治疗进展
- ✅ 可以撤销某些记录的授权
- ✅ 保护其他隐私记录

---

### 4. 🔬 **匿名研究数据分享** ⭐⭐⭐

**场景描述：**
用户愿意将匿名的情绪数据分享给心理健康研究机构，用于科学研究，但不想暴露个人身份。

**使用 Seal Policies 后：**
```typescript
// 用户创建匿名化的情绪记录
const researchRecord = await mintEntryWithPolicy(
  journalId,
  moodScore,
  sanitizedDescription,  // 已移除个人标识信息
  ["research", "anonymous"],
  imageUrl,
  imageMime,
  imageHash,
  audioUrl,
  audioMime,
  audioHash,
  audioDuration,
  false,  // 私有记录
  policyRegistryId
);

// 授权研究机构访问
await grantAccess(researchRecord.nftId, researchInstitutionAddress, policyRegistryId);
```

**用户价值：**
- ✅ 可以贡献数据给科学研究
- ✅ 保护个人隐私和身份
- ✅ 可以控制数据分享范围
- ✅ 可以撤销授权

---

### 5. 💼 **工作压力管理** ⭐⭐⭐

**场景描述：**
用户希望与职业导师或 HR 分享工作相关的情绪记录，寻求职业发展建议，但不想公开个人生活。

**使用 Seal Policies 后：**
```typescript
// 用户创建工作相关的情绪记录
const workRecord = await mintEntryWithPolicy(
  journalId,
  moodScore,
  "工作压力让我感到...",
  ["work", "career", "stress"],
  imageUrl,
  imageMime,
  imageHash,
  audioUrl,
  audioMime,
  audioHash,
  audioDuration,
  false,  // 私有记录
  policyRegistryId
);

// 授权职业导师访问
await grantAccess(workRecord.nftId, mentorAddress, policyRegistryId);
```

**用户价值：**
- ✅ 可以分享工作相关情绪，获得职业建议
- ✅ 保护个人生活隐私
- ✅ 可以授权多个职业关系人

---

### 6. 🎓 **学生心理健康支持** ⭐⭐⭐

**场景描述：**
学生希望与学校心理咨询师分享情绪记录，获得心理健康支持，但不想让同学或老师看到。

**使用 Seal Policies 后：**
```typescript
// 学生创建情绪记录
const studentRecord = await mintEntryWithPolicy(
  journalId,
  moodScore,
  "学习压力让我感到...",
  ["study", "stress", "academic"],
  imageUrl,
  imageMime,
  imageHash,
  audioUrl,
  audioMime,
  audioHash,
  audioDuration,
  false,  // 私有记录
  policyRegistryId
);

// 授权学校心理咨询师访问
await grantAccess(studentRecord.nftId, counselorAddress, policyRegistryId);
```

**用户价值：**
- ✅ 可以获得专业的心理健康支持
- ✅ 保护学生隐私
- ✅ 可以授权多个支持人员（如心理咨询师 + 班主任）

---

### 7. 🕐 **时间胶囊：留给未来的自己** ⭐⭐⭐

**场景描述：**
用户希望创建一些情绪记录，在未来某个时间点后自动授权给特定人（如"10年后给孩子的信"）。

**使用 Seal Policies 后：**
```typescript
// 用户创建时间胶囊记录
const timeCapsuleRecord = await mintEntryWithPolicy(
  journalId,
  moodScore,
  "给10年后的自己/孩子的信...",
  ["time-capsule", "future"],
  imageUrl,
  imageMime,
  imageHash,
  audioUrl,
  audioMime,
  audioHash,
  audioDuration,
  false,  // 私有记录
  policyRegistryId
);

// 可以在未来某个时间点授权
// 或者结合时间锁合约，自动授权
```

**用户价值：**
- ✅ 可以创建"时间胶囊"类型的情绪记录
- ✅ 可以设置未来授权
- ✅ 可以留给未来的自己或家人

---

## 📊 用例优先级（针对 Echoma）

### 高优先级用例 ⭐⭐⭐⭐⭐

1. **与心理医生/治疗师分享** - 最符合产品定位
   - 用户需求：高
   - 使用频率：中高
   - 实现难度：低

2. **与伴侣/家人分享** - 常见使用需求
   - 用户需求：高
   - 使用频率：高
   - 实现难度：低

### 中优先级用例 ⭐⭐⭐⭐

3. **治疗进展追踪** - 医疗场景的延伸
   - 用户需求：中
   - 使用频率：中
   - 实现难度：中

4. **工作压力管理** - 职业场景
   - 用户需求：中
   - 使用频率：中
   - 实现难度：低

### 低优先级用例 ⭐⭐⭐

5. **匿名研究数据分享** - 小众但有用
   - 用户需求：低
   - 使用频率：低
   - 实现难度：低

6. **学生心理健康支持** - 特定用户群体
   - 用户需求：中
   - 使用频率：低
   - 实现难度：低

7. **时间胶囊** - 有趣的扩展功能
   - 用户需求：低
   - 使用频率：低
   - 实现难度：高

---

## 🎯 Echoma 中的核心价值主张

### 对用户的价值

1. **"你的情绪，你的控制权"**
   - 可以选择公开/私有
   - 可以授权特定人访问
   - 可以随时撤销授权

2. **"专业医疗支持"**
   - 安全分享给心理医生
   - 保护隐私的同时获得帮助
   - 可以更换医生而不丢失记录

3. **"增进理解与沟通"**
   - 与伴侣/家人分享情绪
   - 增进理解和信任
   - 可以创建"家庭共享"记录

4. **"链上可证明"**
   - 时间戳证明记录时间
   - 访问权限证明
   - 数据完整性证明

---

## 💡 产品功能建议

### 阶段 1：核心功能（MVP）

1. ✅ 支持公开/私有记录
2. ✅ 支持授权/撤销访问
3. ✅ 链上权限验证
4. ✅ 授权管理界面

### 阶段 2：增强功能

1. 🔄 批量授权管理
2. 🔄 授权历史记录
3. 🔄 授权通知系统
4. 🔄 预设授权组（如"我的治疗师"、"我的家人"）

### 阶段 3：高级功能

1. 🔮 时间锁定授权
2. 🔮 条件授权（多签）
3. 🔮 授权模板
4. 🔮 跨应用授权（与其他心理健康应用集成）

---

## 🚀 用户故事示例

### 故事 1：心理治疗场景

> "我患有抑郁症，正在接受心理治疗。我想让我的心理医生看到我的情绪日记，以便医生更好地了解我的情绪变化。使用 Seal Access Policies，我可以创建私有记录，只授权给我的心理医生。这样，医生可以看到我的完整情绪变化趋势，但其他人无法访问。"

### 故事 2：家庭分享场景

> "我想和我的伴侣分享一些关于我们关系的情绪记录，增进理解和沟通。使用 Seal Access Policies，我可以创建私有记录，只授权给我的伴侣。这样，我们可以更好地理解彼此的情绪，但其他人无法看到。"

### 故事 3：治疗进展场景

> "我正在接受长期心理治疗，希望与治疗师一起追踪治疗进展。使用 Seal Access Policies，我可以选择性地授权某些记录给治疗师，比如只授权标记为 'therapy' 的记录。这样，治疗师可以看到我的治疗进展，但我的其他隐私记录仍然保持私有。"

---

## 📈 与当前系统的对比

### 当前系统（无 Seal Policies）

**创建记录：**
- 选择公开/私有
- 使用对应密钥加密
- 存储到本地/Walrus
- 可选：铸造 NFT（不包含策略）

**分享记录：**
- 公开记录：所有人可见（无法撤销）
- 私有记录：无法分享

**问题：**
- ❌ 无法选择性分享
- ❌ 无法授权他人访问
- ❌ 无法撤销授权

### 使用 Seal Policies 后

**创建记录：**
- 选择公开/私有
- 使用对应密钥加密
- 存储到本地/Walrus
- 铸造 NFT + 创建访问策略（链上）

**分享记录：**
- 公开记录：所有人可见
- 私有记录：可以授权特定地址，可以撤销

**优势：**
- ✅ 可以选择性分享
- ✅ 可以授权他人访问
- ✅ 可以撤销授权
- ✅ 链上可验证权限

---

## 🎬 产品演示场景

### 场景 1：用户授权心理医生

1. 用户在 Echoma 中记录情绪
2. 选择"分享给医生"选项
3. 输入医生的钱包地址（或扫描二维码）
4. 系统调用 `grantAccess()` 授权
5. 医生可以访问这些记录
6. 用户可以随时撤销授权

### 场景 2：用户与伴侣分享

1. 用户在 Echoma 中记录关于关系的情绪
2. 选择"分享给伴侣"选项
3. 输入伴侣的钱包地址
4. 系统调用 `grantAccess()` 授权
5. 伴侣可以访问这些记录
6. 如果关系结束，用户可以撤销授权

### 场景 3：用户更换医生

1. 用户之前授权了旧医生
2. 用户更换了新医生
3. 用户撤销旧医生的授权：`revokeAccess()`
4. 用户授权新医生：`grantAccess()`
5. 新医生可以访问记录，旧医生无法访问

---

## 🔮 未来扩展

1. **授权请求系统**
   - 医生可以请求访问权限
   - 用户可以选择批准或拒绝

2. **授权模板**
   - 预设授权组（如"我的治疗师"、"我的家人"）
   - 一键授权给整个组

3. **授权通知**
   - 当有人请求访问时通知用户
   - 当授权被撤销时通知相关人员

4. **跨应用集成**
   - 与其他心理健康应用集成
   - 统一的授权管理系统

---

## 📊 总结

在 Echoma 情绪日记产品中，Seal Access Policies 的核心用例是：

1. **与心理医生/治疗师分享** - 最符合产品定位
2. **与伴侣/家人分享** - 常见使用需求
3. **治疗进展追踪** - 医疗场景的延伸

这些用例都围绕一个核心价值：**在保护隐私的同时，提供选择性分享的可能性**。

这对于情绪日记应用来说非常重要，因为：
- 情绪数据非常敏感
- 但有时需要专业支持
- 有时需要与亲近的人分享
- 需要完全的控制权

Seal Access Policies 完美解决了这个矛盾。






