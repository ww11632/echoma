-- Create audit logs table for AI API calls
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_endpoint TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  response_length INTEGER NOT NULL,
  was_truncated BOOLEAN NOT NULL DEFAULT false,
  truncation_reason TEXT,
  response_category TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  security_check_passed BOOLEAN NOT NULL,
  detected_keywords TEXT[] DEFAULT '{}',
  input_summary TEXT NOT NULL,
  input_length INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'zh-TW',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs (users cannot see their own logs for security)
CREATE POLICY "Admins can view audit logs"
  ON public.ai_audit_logs
  FOR SELECT
  TO authenticated
  USING (false); -- No regular users can view, only service role

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON public.ai_audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create index for efficient querying
CREATE INDEX idx_ai_audit_logs_user_id ON public.ai_audit_logs(user_id);
CREATE INDEX idx_ai_audit_logs_created_at ON public.ai_audit_logs(created_at DESC);

-- Create API keys table for key rotation management
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL UNIQUE,
  encrypted_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_rotation_at TIMESTAMP WITH TIME ZONE,
  last_rotated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on API keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access API keys
CREATE POLICY "Service role can manage API keys"
  ON public.api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();