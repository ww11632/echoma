# 安全功能实现说明

本文档说明已实现的安全功能，用于防止 Prompt Injection、越權資料洩漏，并提供审计日志和 API key rotation 支持。

## 一、防止 Prompt Injection / 越權資料洩漏

### 1. 最小化上下文拼接

**实现位置**: `supabase/functions/_shared/security.ts`

- **功能**: 对用户输入进行清理和最小化处理，避免将解密后的敏感字段暴露到模型
- **方法**: 
  - `cleanDescription()`: 清理用户描述，移除常见的 prompt injection 模式
  - `sanitizeUserInput()`: 只提取必要的情绪信息（情绪类型、强度），不包含完整描述

**清理规则**:
- 移除系统指令尝试（如 "ignore previous instructions"）
- 移除特殊标记（如 `<|...|>`, `[INST]...[/INST]`）
- 限制长度（最大 2000 字符）
- 移除角色标记（system:, assistant:, user:）

### 2. 模型输出分类和安全检测

**实现位置**: `supabase/functions/_shared/security.ts`

**输出分类**:
- `supportive`: 支持性文本（默认）
- `suggestion`: 建议性内容
- `crisis`: 危机提示（检测到自伤/他伤关键词）
- `unknown`: 未知分类

**安全关键词检测**:
- 支持中英文关键词检测
- 自伤关键词：自杀、自伤、自残、结束生命等
- 他伤关键词：杀人、伤害、报复、攻击等
- 检测到高风险关键词时，触发安全卡控

### 3. 本地端安全卡控

**实现位置**: `supabase/functions/ai-emotion-response/index.ts`

**工作流程**:
1. **输入检测**: 在发送到模型前检查用户输入
   - 如果检测到高风险内容，直接阻止请求
   - 记录审计日志（即使被阻止）
   - 返回友好的错误消息

2. **输出检测**: 检查 AI 响应
   - 如果检测到高风险内容，不返回原始响应
   - 返回通用的安全响应（提供心理健康资源）
   - 记录审计日志

**安全响应示例**:
- 中文: "我理解你正在经历困难。请记住，你并不孤单。如果你正在考虑伤害自己或他人，请立即联系专业心理健康服务或紧急服务。"
- 英文: "I understand you are going through a difficult time. Please remember you are not alone. If you are considering harming yourself or others, please contact professional mental health services or emergency services immediately."

## 二、审计日志

### 1. 数据库表结构

**表名**: `ai_audit_logs`

**字段**:
- `id`: UUID 主键
- `user_id`: 用户 ID（外键）
- `api_endpoint`: API 端点
- `model_name`: 模型名称
- `request_timestamp`: 请求时间
- `prompt_tokens`: Prompt token 数量
- `completion_tokens`: Completion token 数量
- `total_tokens`: 总 token 数量
- `response_length`: 响应长度
- `was_truncated`: 是否被截断
- `truncation_reason`: 截断原因
- `response_category`: 响应分类
- `risk_level`: 风险等级（low/medium/high）
- `security_check_passed`: 安全检测是否通过
- `detected_keywords`: 检测到的关键词数组
- `input_summary`: 输入摘要（仅存储情绪类型和强度，不存储完整描述）
- `input_length`: 输入长度
- `language`: 语言
- `error_message`: 错误消息（如果有）
- `created_at`: 创建时间

### 2. 审计日志记录

**实现位置**: `supabase/functions/_shared/auditLogger.ts`

**功能**:
- `logAuditEvent()`: 记录审计日志
- `extractTokenUsage()`: 从 AI 响应中提取 token 使用信息
- `checkTruncation()`: 检查响应是否被截断

**记录时机**:
- 每次 AI API 调用后记录
- 即使请求被安全检测阻止，也会记录
- 记录所有错误情况

### 3. 数据隐私保护

- **不存储完整用户描述**: 只存储摘要（情绪类型和强度）
- **RLS 策略**: 用户只能查看自己的审计日志
- **敏感信息过滤**: 检测到的关键词会被记录，但不会存储完整的敏感内容

## 三、API Key Rotation

### 1. 数据库表结构

**表名**: `api_keys`

**字段**:
- `id`: UUID 主键
- `key_name`: Key 名称（唯一）
- `key_value_encrypted`: 加密存储的 API key
- `is_active`: 是否活跃
- `rotation_schedule_days`: 轮换周期（天数，默认 90 天）
- `last_rotated_at`: 上次轮换时间
- `next_rotation_at`: 下次轮换时间
- `created_at`: 创建时间
- `updated_at`: 更新时间

### 2. API Key 管理

**实现位置**: `supabase/functions/_shared/apiKeyRotation.ts`

**功能**:
- `getActiveApiKey()`: 获取当前活跃的 API key
  - 优先从数据库获取（支持 rotation）
  - 如果数据库获取失败，回退到环境变量
- `checkAndRotateApiKey()`: 检查并触发 API key 轮换
  - 检查是否到了轮换时间
  - 更新轮换时间（实际轮换需要管理员手动执行）
- `initializeApiKey()`: 初始化 API key

### 3. 使用方式

**当前实现**:
- 支持从环境变量获取（向后兼容）
- 支持从数据库获取（需要配置 `SUPABASE_SERVICE_ROLE_KEY`）

**轮换流程**:
1. 系统自动检查轮换时间
2. 如果到了轮换时间，标记需要轮换
3. 管理员手动创建新 key 并更新配置
4. 系统切换到新 key
5. 禁用旧 key

**注意**: 
- API key 加密存储需要服务端密钥解密
- 在实际生产环境中，建议使用密钥管理服务（如 AWS KMS、Azure Key Vault）

## 四、使用示例

### 1. 运行数据库迁移

```bash
# 应用审计日志表迁移
supabase migration up 20250116000000_create_audit_logs

# 应用 API keys 表迁移
supabase migration up 20250116000001_create_api_keys_table
```

### 2. 配置环境变量

```bash
# Supabase Edge Function 环境变量
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # 用于 API key rotation
LOVABLE_API_KEY=your_lovable_api_key  # 向后兼容，如果数据库中没有配置
```

### 3. 初始化 API Key（可选）

如果需要使用数据库存储的 API key，可以通过 Edge Function 或管理脚本初始化：

```typescript
import { initializeApiKey } from './_shared/apiKeyRotation.ts';

// 注意：key_value_encrypted 需要先加密
await initializeApiKey(
  supabase,
  'lovable_api_key',
  encryptedKey,  // 需要先加密
  90  // 90 天轮换一次
);
```

### 4. 查看审计日志

```sql
-- 查看用户的审计日志
SELECT * FROM ai_audit_logs 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC;

-- 查看高风险请求
SELECT * FROM ai_audit_logs 
WHERE risk_level = 'high' 
ORDER BY created_at DESC;

-- 查看被阻止的请求
SELECT * FROM ai_audit_logs 
WHERE security_check_passed = false 
ORDER BY created_at DESC;
```

## 五、安全最佳实践

1. **定期审查审计日志**: 检查高风险请求和异常模式
2. **定期轮换 API keys**: 建议每 90 天轮换一次
3. **监控关键词检测**: 关注检测到的关键词趋势
4. **保护服务端密钥**: 使用安全的密钥管理服务
5. **限制审计日志访问**: 只有授权管理员可以访问完整日志
6. **定期更新关键词列表**: 根据实际情况更新危机关键词

## 六、注意事项

1. **关键词检测**: 当前的关键词列表是基础版本，可能需要根据实际使用情况扩展
2. **API Key 加密**: 当前实现中，API key 的加密/解密需要额外实现（建议使用密钥管理服务）
3. **性能影响**: 安全检测和审计日志记录会增加少量延迟，但影响很小
4. **误报处理**: 如果出现误报，可以通过审计日志分析并调整关键词列表

## 七、未来改进

1. **机器学习分类**: 使用 ML 模型进行更准确的响应分类
2. **动态关键词更新**: 支持从配置中动态加载关键词
3. **实时监控告警**: 当检测到高风险内容时发送告警
4. **用户反馈机制**: 允许用户报告误报，用于改进检测算法

