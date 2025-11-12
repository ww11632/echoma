-- 创建 API Key 管理表
-- 支持 API key rotation 机制

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key_name text not null unique, -- 例如: 'lovable_api_key_v1'
  key_value_encrypted text not null, -- 加密存储的 API key
  is_active boolean not null default true,
  rotation_schedule_days integer default 90, -- 每 90 天轮换一次
  last_rotated_at timestamptz,
  next_rotation_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 创建索引
create index idx_api_keys_active on public.api_keys(is_active);
create index idx_api_keys_rotation on public.api_keys(next_rotation_at) where is_active = true;

-- 添加注释
comment on table public.api_keys is 'API Key 管理表，支持 key rotation';
comment on column public.api_keys.key_value_encrypted is '加密存储的 API key，需要使用服务端密钥解密';
comment on column public.api_keys.rotation_schedule_days is '轮换周期（天数）';

-- 注意：此表应该只允许服务端访问（service_role）
-- 不启用 RLS，因为这是服务端管理的数据

