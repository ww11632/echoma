/**
 * Rate limiting utilities for Supabase Edge Functions
 * Prevents abuse and excessive resource usage
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

/**
 * Rate limit configuration
 */
export const RATE_LIMIT_CONFIG = {
  // Maximum requests per window for authenticated users
  maxRequests: 10,
  // Maximum requests per window for anonymous users (more restrictive)
  maxRequestsAnonymous: 3,
  // Maximum requests per IP address per window (防止单 IP 大量请求)
  maxRequestsPerIP: 20,
  // Time window in milliseconds (1 minute)
  windowMs: 60 * 1000,
} as const;

/**
 * Check if user has exceeded rate limit
 * Uses ai_audit_logs table to count recent AI API calls
 * 
 * Improved race condition handling:
 * - Uses a transaction-like pattern with immediate reservation
 * - Creates a pending entry before checking the count
 * - If rate limit exceeded, deletes the pending entry
 * - If allowed, the pending entry will be updated by the calling function
 * 
 * This reduces (but doesn't completely eliminate) race conditions by ensuring
 * that concurrent requests increment the count atomically.
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @param reservationId - Optional reservation ID to track this request
 * @returns Object with allowed status, remaining requests, and optional reservationId
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  reservationId?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; reservationId?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_CONFIG.windowMs);
  const resetAt = new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs);
  
  try {
    // Step 1: Create a "pending" entry to reserve a slot
    // This happens before we check the count, reducing race conditions
    const pendingReservationId = reservationId || crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('ai_audit_logs')
      .insert({
        user_id: userId,
        api_endpoint: 'rate_limit_check',
        input_length: 0,
        input_summary: `Rate limit reservation: ${pendingReservationId}`,
        language: 'en',
        model_name: 'rate_limit',
        response_category: 'pending',
        response_length: 0,
        risk_level: 'low',
        security_check_passed: true,
      });
    
    if (insertError) {
      console.error('Rate limit reservation error:', insertError);
      // If we can't create a reservation, deny conservatively
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }
    
    // Step 2: Count existing requests (including our pending reservation)
    const { count, error: countError } = await supabase
      .from('ai_audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart.toISOString());

    if (countError) {
      console.error('Rate limit count error:', countError);
      // Delete our pending reservation
      await supabase
        .from('ai_audit_logs')
        .delete()
        .eq('user_id', userId)
        .eq('input_summary', `Rate limit reservation: ${pendingReservationId}`);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    const requestCount = count || 0;
    const allowed = requestCount <= RATE_LIMIT_CONFIG.maxRequests;
    
    if (!allowed) {
      // Step 3a: Rate limit exceeded, delete our pending reservation
      await supabase
        .from('ai_audit_logs')
        .delete()
        .eq('user_id', userId)
        .eq('input_summary', `Rate limit reservation: ${pendingReservationId}`);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }
    
    // Step 3b: Allowed, return reservation ID for the caller to update
    const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - requestCount);
    return {
      allowed: true,
      remaining,
      resetAt,
      reservationId: pendingReservationId,
    };
  } catch (error) {
    console.error('Rate limit check exception:', error);
    // On exception, deny conservatively
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }
}

/**
 * Check rate limit for anonymous users using anonymous ID
 * Uses ai_audit_logs table to track anonymous requests
 * 
 * Improved race condition handling with reservation pattern (same as authenticated users)
 * 
 * @param supabase - Supabase client instance (service role for anonymous tracking)
 * @param anonymousId - Anonymous user ID
 * @param requestIp - Optional IP address for additional tracking (not currently used)
 * @param reservationId - Optional reservation ID to track this request
 * @returns Object with allowed status, remaining requests, and optional reservationId
 */
export async function checkAnonymousRateLimit(
  supabase: SupabaseClient,
  anonymousId: string,
  requestIp?: string,
  reservationId?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; reservationId?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_CONFIG.windowMs);
  const resetAt = new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs);
  
  // Use ai_audit_logs table to track anonymous requests
  // We'll use a special format for anonymous user_id: "anon:{anonymousId}"
  const anonUserId = `anon:${anonymousId}`;
  
  try {
    // Step 1: Create a "pending" entry to reserve a slot
    const pendingReservationId = reservationId || crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('ai_audit_logs')
      .insert({
        user_id: anonUserId,
        api_endpoint: 'rate_limit_check_anon',
        input_length: 0,
        input_summary: `Rate limit reservation: ${pendingReservationId} (IP: ${requestIp || 'unknown'})`,
        language: 'en',
        model_name: 'rate_limit',
        response_category: 'pending',
        response_length: 0,
        risk_level: 'low',
        security_check_passed: true,
      });
    
    if (insertError) {
      console.error('Anonymous rate limit reservation error:', insertError);
      // If table doesn't exist or RLS blocks us, allow request but log warning
      console.warn('Allowing anonymous request due to reservation failure');
      return {
        allowed: true,
        remaining: RATE_LIMIT_CONFIG.maxRequestsAnonymous - 1,
        resetAt,
      };
    }
    
    // Step 2: Count existing requests (including our pending reservation)
    const { count, error: countError } = await supabase
      .from('ai_audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', anonUserId)
      .gte('created_at', windowStart.toISOString());

    if (countError) {
      console.error('Anonymous rate limit count error:', countError);
      // Delete our pending reservation
      await supabase
        .from('ai_audit_logs')
        .delete()
        .eq('user_id', anonUserId)
        .eq('input_summary', `Rate limit reservation: ${pendingReservationId} (IP: ${requestIp || 'unknown'})`);
      
      // Allow request on error to prevent blocking legitimate users
      return {
        allowed: true,
        remaining: RATE_LIMIT_CONFIG.maxRequestsAnonymous - 1,
        resetAt,
      };
    }

    const requestCount = count || 0;
    const allowed = requestCount <= RATE_LIMIT_CONFIG.maxRequestsAnonymous;
    
    if (!allowed) {
      // Step 3a: Rate limit exceeded, delete our pending reservation
      await supabase
        .from('ai_audit_logs')
        .delete()
        .eq('user_id', anonUserId)
        .eq('input_summary', `Rate limit reservation: ${pendingReservationId} (IP: ${requestIp || 'unknown'})`);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }
    
    // Step 3b: Allowed, return reservation ID for the caller to update
    const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequestsAnonymous - requestCount);
    return {
      allowed: true,
      remaining,
      resetAt,
      reservationId: pendingReservationId,
    };
  } catch (err) {
    console.error('Anonymous rate limit check exception:', err);
    // Allow request on exception to prevent blocking legitimate users
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequestsAnonymous - 1,
      resetAt,
    };
  }
}

/**
 * Check rate limit for IP address
 * Prevents a single IP from making too many requests regardless of user identity
 * This complements user-based rate limiting
 * 
 * @param supabase - Supabase client instance (service role)
 * @param requestIp - IP address to check
 * @returns Object with allowed status and remaining requests
 */
export async function checkIPRateLimit(
  supabase: SupabaseClient,
  requestIp: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; reservationId?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_CONFIG.windowMs);
  const resetAt = new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs);
  
  // Use special format for IP tracking: "ip:{address}"
  const ipUserId = `ip:${requestIp}`;
  
  try {
    // Step 1: Create a "pending" entry to reserve a slot
    const pendingReservationId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('ai_audit_logs')
      .insert({
        user_id: ipUserId,
        api_endpoint: 'rate_limit_check_ip',
        input_length: 0,
        input_summary: `Rate limit reservation: ${pendingReservationId} (IP: ${requestIp})`,
        language: 'en',
        model_name: 'rate_limit',
        response_category: 'pending',
        response_length: 0,
        risk_level: 'low',
        security_check_passed: true,
      });
    
    if (insertError) {
      console.error('IP rate limit reservation error:', insertError);
      // On error, allow request but log warning
      console.warn('Allowing request due to IP rate limit check failure');
      return {
        allowed: true,
        remaining: RATE_LIMIT_CONFIG.maxRequestsPerIP - 1,
        resetAt,
      };
    }
    
    // Step 2: Count existing requests from this IP
    const { count, error: countError } = await supabase
      .from('ai_audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ipUserId)
      .gte('created_at', windowStart.toISOString());

    if (countError) {
      console.error('IP rate limit count error:', countError);
      // Delete our pending reservation
      await supabase
        .from('ai_audit_logs')
        .delete()
        .eq('user_id', ipUserId)
        .eq('input_summary', `Rate limit reservation: ${pendingReservationId} (IP: ${requestIp})`);
      
      // Allow request on error to prevent blocking legitimate users
      return {
        allowed: true,
        remaining: RATE_LIMIT_CONFIG.maxRequestsPerIP - 1,
        resetAt,
      };
    }

    const requestCount = count || 0;
    const allowed = requestCount <= RATE_LIMIT_CONFIG.maxRequestsPerIP;
    
    if (!allowed) {
      // Step 3a: Rate limit exceeded, delete our pending reservation
      await supabase
        .from('ai_audit_logs')
        .delete()
        .eq('user_id', ipUserId)
        .eq('input_summary', `Rate limit reservation: ${pendingReservationId} (IP: ${requestIp})`);
      
      console.warn(`[IPRateLimit] IP ${requestIp} exceeded rate limit: ${requestCount}/${RATE_LIMIT_CONFIG.maxRequestsPerIP}`);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }
    
    // Step 3b: Allowed, return reservation ID for the caller to update
    const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequestsPerIP - requestCount);
    return {
      allowed: true,
      remaining,
      resetAt,
      reservationId: pendingReservationId,
    };
  } catch (err) {
    console.error('IP rate limit check exception:', err);
    // Allow request on exception to prevent blocking legitimate users
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequestsPerIP - 1,
      resetAt,
    };
  }
}

/**
 * Check combined rate limits (user + IP)
 * Checks both user-based and IP-based rate limits
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @param requestIp - IP address to check
 * @param reservationId - Optional reservation ID
 * @returns Object with allowed status and which limit was hit (if any)
 */
export async function checkCombinedRateLimit(
  supabase: SupabaseClient,
  userId: string,
  requestIp: string,
  reservationId?: string
): Promise<{ 
  allowed: boolean; 
  remaining: number; 
  resetAt: Date; 
  reservationId?: string;
  limitType?: 'user' | 'ip';
}> {
  // Check user-based limit first
  const userLimit = await checkRateLimit(supabase, userId, reservationId);
  if (!userLimit.allowed) {
    return { ...userLimit, limitType: 'user' };
  }

  // Check IP-based limit
  const ipLimit = await checkIPRateLimit(supabase, requestIp);
  if (!ipLimit.allowed) {
    // Delete user's pending reservation since IP limit was hit
    if (userLimit.reservationId) {
      await supabase
        .from('ai_audit_logs')
        .delete()
        .eq('user_id', userId)
        .eq('input_summary', `Rate limit reservation: ${userLimit.reservationId}`);
    }
    return { ...ipLimit, limitType: 'ip' };
  }

  // Both limits passed, use the more restrictive remaining count
  return {
    allowed: true,
    remaining: Math.min(userLimit.remaining, ipLimit.remaining),
    resetAt: userLimit.resetAt,
    reservationId: userLimit.reservationId,
  };
}

/**
 * Create rate limit error response
 * 
 * @param resetAt - When the rate limit will reset
 * @param isAnonymous - Whether this is for an anonymous user
 * @param language - User's language preference (defaults to 'en')
 * @param limitType - Type of limit that was hit ('user' or 'ip')
 */
export function createRateLimitResponse(
  resetAt: Date, 
  isAnonymous: boolean = false,
  language: string = 'en',
  limitType?: 'user' | 'ip'
): Response {
  const resetSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
  const maxRequests = isAnonymous ? RATE_LIMIT_CONFIG.maxRequestsAnonymous : RATE_LIMIT_CONFIG.maxRequests;
  
  // Return error message in user's language
  const isZh = language.startsWith('zh');
  
  let errorMessage: string;
  let message: string;
  
  if (limitType === 'ip') {
    // IP-based rate limit hit
    errorMessage = isZh
      ? '来自您 IP 的请求过多'
      : 'Too many requests from your IP';
    message = isZh
      ? `来自您 IP 地址的请求过多。请在 ${resetSeconds} 秒后重试。`
      : `Too many requests from your IP address. Please try again in ${resetSeconds} seconds.`;
  } else {
    // User-based rate limit hit
    errorMessage = isZh
      ? '请求过于频繁'
      : 'Rate limit exceeded';
    message = isZh
      ? `请求过于频繁。请在 ${resetSeconds} 秒后重试。`
      : `Too many requests. Please try again in ${resetSeconds} seconds.`;
  }
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      message: message,
      retryAfter: resetSeconds,
      limitType: limitType || 'user',
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': resetSeconds.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetAt.toISOString(),
        'X-RateLimit-Type': limitType || 'user',
      },
    }
  );
}

