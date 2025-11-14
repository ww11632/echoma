/**
 * Rate limiting utilities for Supabase Edge Functions
 * Prevents abuse and excessive resource usage
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Rate limit configuration
 */
export const RATE_LIMIT_CONFIG = {
  // Maximum requests per window for authenticated users
  maxRequests: 10,
  // Maximum requests per window for anonymous users (more restrictive)
  maxRequestsAnonymous: 3,
  // Time window in milliseconds (1 minute)
  windowMs: 60 * 1000,
} as const;

/**
 * Check if user has exceeded rate limit
 * Uses ai_audit_logs table to count recent AI API calls
 * 
 * Note: This checks completed requests only. There's a potential race condition
 * where concurrent requests may all pass the rate limit check before any are logged.
 * However, this is acceptable because:
 * 1. The rate limit window is 1 minute, limiting the impact
 * 2. Even with concurrent requests, users can only exceed the limit by a small margin
 * 3. This is a common pattern in rate limiting implementations
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @returns Object with allowed status and remaining requests
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_CONFIG.windowMs);
  
  // Use ai_audit_logs table to track all AI API calls (consistent with anonymous users)
  // This ensures rate limiting is based on actual AI usage, not just emotion record creation
  const { count, error } = await supabase
    .from('ai_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, be conservative: deny the request to prevent abuse
    // This is consistent with anonymous user rate limiting behavior
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs),
    };
  }

  const requestCount = count || 0;
  const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - requestCount);
  const allowed = requestCount < RATE_LIMIT_CONFIG.maxRequests;
  const resetAt = new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs);

  return {
    allowed,
    remaining,
    resetAt,
  };
}

/**
 * Check rate limit for anonymous users using anonymous ID
 * Uses ai_audit_logs table to track anonymous requests
 * 
 * Note: Same race condition consideration as checkRateLimit() - checks completed
 * requests only. The impact is limited by the 1-minute window and low limits (3/min).
 * 
 * @param supabase - Supabase client instance (service role for anonymous tracking)
 * @param anonymousId - Anonymous user ID
 * @param requestIp - Optional IP address for additional tracking (not currently used)
 * @returns Object with allowed status and remaining requests
 */
export async function checkAnonymousRateLimit(
  supabase: SupabaseClient,
  anonymousId: string,
  requestIp?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_CONFIG.windowMs);
  
  // Use ai_audit_logs table to track anonymous requests
  // We'll use a special format for anonymous user_id: "anon:{anonymousId}"
  const anonUserId = `anon:${anonymousId}`;
  
  const { count, error } = await supabase
    .from('ai_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', anonUserId)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Anonymous rate limit check error:', error);
    // On error, be more conservative: deny the request to prevent abuse
    // This is safer for anonymous users who could abuse the system
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs),
    };
  }

  const requestCount = count || 0;
  const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequestsAnonymous - requestCount);
  const allowed = requestCount < RATE_LIMIT_CONFIG.maxRequestsAnonymous;
  const resetAt = new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs);

  return {
    allowed,
    remaining,
    resetAt,
  };
}

/**
 * Create rate limit error response
 * 
 * @param resetAt - When the rate limit will reset
 * @param isAnonymous - Whether this is for an anonymous user
 * @param language - User's language preference (defaults to 'en')
 */
export function createRateLimitResponse(
  resetAt: Date, 
  isAnonymous: boolean = false,
  language: string = 'en'
): Response {
  const resetSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
  const maxRequests = isAnonymous ? RATE_LIMIT_CONFIG.maxRequestsAnonymous : RATE_LIMIT_CONFIG.maxRequests;
  
  // Return error message in user's language
  const isZh = language.startsWith('zh');
  const errorMessage = isZh
    ? '请求过于频繁'
    : 'Rate limit exceeded';
  const message = isZh
    ? `请求过于频繁。请在 ${resetSeconds} 秒后重试。`
    : `Too many requests. Please try again in ${resetSeconds} seconds.`;
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      message: message,
      retryAfter: resetSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': resetSeconds.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetAt.toISOString(),
      },
    }
  );
}

