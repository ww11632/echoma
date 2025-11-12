-- 创建审计日志表
-- 记录 AI API 调用信息：时间、用户、token 花费、截断长度等

create table if not exists public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- API 调用信息
  api_endpoint text not null,
  model_name text not null,
  request_timestamp timestamptz not null default now(),
  
  -- Token 使用情况
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  
  -- 响应信息
  response_length integer,
  was_truncated boolean default false,
  truncation_reason text,
  
  -- 安全检测结果
  response_category text check (response_category in ('supportive', 'suggestion', 'crisis', 'unknown')),
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  security_check_passed boolean not null default true,
  detected_keywords text[],
  
  -- 输入信息（仅存储摘要，不存储完整内容）
  input_summary text, -- 仅存储情绪类型和强度，不存储完整描述
  input_length integer,
  
  -- 元数据
  language text,
  error_message text,
  created_at timestamptz not null default now()
);

-- 创建索引以提高查询性能
create index idx_ai_audit_logs_user_id on public.ai_audit_logs(user_id);
create index idx_ai_audit_logs_created_at on public.ai_audit_logs(created_at desc);
create index idx_ai_audit_logs_security_check on public.ai_audit_logs(security_check_passed, risk_level);
create index idx_ai_audit_logs_category on public.ai_audit_logs(response_category);

-- 启用 RLS
alter table public.ai_audit_logs enable row level security;

-- RLS 策略：用户只能查看自己的审计日志
create policy "Users can view their own audit logs"
  on public.ai_audit_logs
  for select
  using (auth.uid() = user_id);

-- RLS 策略：系统可以插入审计日志（通过 service_role）
-- 注意：实际插入应该通过 Edge Function 使用 service_role key

-- 添加注释
comment on table public.ai_audit_logs is 'AI API 调用审计日志，记录所有 AI 请求的详细信息和安全检测结果';
comment on column public.ai_audit_logs.input_summary is '仅存储输入摘要（情绪类型和强度），不存储完整的用户描述以保护隐私';
comment on column public.ai_audit_logs.detected_keywords is '检测到的安全关键词列表';

