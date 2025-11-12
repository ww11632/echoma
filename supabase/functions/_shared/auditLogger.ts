/**
 * 审计日志记录工具
 * 记录所有 AI API 调用的详细信息
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SecurityCheckResult } from './security.ts';

/**
 * AI API 调用审计日志数据
 */
export interface AuditLogData {
  userId: string;
  apiEndpoint: string;
  modelName: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  responseLength: number;
  wasTruncated: boolean;
  truncationReason?: string;
  responseCategory: string;
  riskLevel: string;
  securityCheckPassed: boolean;
  detectedKeywords?: string[];
  inputSummary: string; // 仅存储摘要，不存储完整描述
  inputLength: number;
  language: string;
  errorMessage?: string;
}

/**
 * 记录审计日志
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  data: AuditLogData
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_audit_logs')
      .insert({
        user_id: data.userId,
        api_endpoint: data.apiEndpoint,
        model_name: data.modelName,
        prompt_tokens: data.promptTokens,
        completion_tokens: data.completionTokens,
        total_tokens: data.totalTokens,
        response_length: data.responseLength,
        was_truncated: data.wasTruncated,
        truncation_reason: data.truncationReason,
        response_category: data.responseCategory,
        risk_level: data.riskLevel,
        security_check_passed: data.securityCheckPassed,
        detected_keywords: data.detectedKeywords || [],
        input_summary: data.inputSummary,
        input_length: data.inputLength,
        language: data.language,
        error_message: data.errorMessage
      });
    
    if (error) {
      console.error('[Audit] Failed to log event:', error);
      return false;
    }
    
    console.log('[Audit] Event logged successfully');
    return true;
  } catch (error) {
    console.error('[Audit] Error logging event:', error);
    return false;
  }
}

/**
 * 从 AI API 响应中提取 token 使用信息
 */
export function extractTokenUsage(response: any): {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
} {
  const usage = response?.usage || {};
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens
  };
}

/**
 * 检查响应是否被截断
 */
export function checkTruncation(
  response: any,
  maxTokens: number
): {
  wasTruncated: boolean;
  reason?: string;
} {
  const finishReason = response?.choices?.[0]?.finish_reason;
  
  if (finishReason === 'length') {
    return {
      wasTruncated: true,
      reason: `Response truncated due to max_tokens limit (${maxTokens})`
    };
  }
  
  if (finishReason === 'content_filter') {
    return {
      wasTruncated: true,
      reason: 'Response filtered by content filter'
    };
  }
  
  return {
    wasTruncated: false
  };
}

