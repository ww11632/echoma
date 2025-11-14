-- 修改 ai_audit_logs 表的 user_id 字段以支持匿名用户
-- 将 user_id 从 UUID 改为 TEXT，以支持 "anon:{anonymousId}" 格式

-- 1. 删除外键约束
ALTER TABLE public.ai_audit_logs 
  DROP CONSTRAINT IF EXISTS ai_audit_logs_user_id_fkey;

-- 2. 修改字段类型为 TEXT
ALTER TABLE public.ai_audit_logs 
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 3. 添加检查约束：确保 user_id 要么是有效的 UUID（认证用户），要么是 "anon:" 前缀（匿名用户）
ALTER TABLE public.ai_audit_logs 
  ADD CONSTRAINT ai_audit_logs_user_id_format 
  CHECK (
    user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
    user_id ~ '^anon:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- 4. 重新创建索引（因为字段类型改变了）
DROP INDEX IF EXISTS idx_ai_audit_logs_user_id;
CREATE INDEX idx_ai_audit_logs_user_id ON public.ai_audit_logs(user_id);

-- 5. 更新 RLS 策略以支持匿名用户
-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.ai_audit_logs;

-- 创建新策略：只有 service_role 可以查看所有日志（包括匿名用户）
CREATE POLICY "Service role can view all audit logs"
  ON public.ai_audit_logs
  FOR SELECT
  TO service_role
  USING (true);

-- 系统可以插入审计日志（通过 service_role）
-- 这个策略已经存在，不需要修改

-- 添加注释
COMMENT ON COLUMN public.ai_audit_logs.user_id IS 
  'User identifier: UUID for authenticated users, "anon:{uuid}" for anonymous users';

