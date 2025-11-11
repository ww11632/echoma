/**
 * Rate limiting utilities for Supabase Edge Functions
 * Prevents abuse and excessive resource usage
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Rate limit configuration
 */
export const RATE_LIMIT_CONFIG = {
  // Maximum requests per window
  maxRequests: 10,
  // Time window in milliseconds (1 minute)
  windowMs: 60 * 1000,
} as const;

/**
 * Check if user has exceeded rate limit
 * Uses emotion_records table to count recent requests
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
  
  // Count records created in the last minute
  const { count, error } = await supabase
    .from('emotion_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log it
    // This prevents rate limiting from breaking the service
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests,
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
 * Create rate limit error response
 */
export function createRateLimitResponse(resetAt: Date): Response {
  const resetSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${resetSeconds} seconds.`,
      retryAfter: resetSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': resetSeconds.toString(),
        'X-RateLimit-Limit': RATE_LIMIT_CONFIG.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetAt.toISOString(),
      },
    }
  );
}

