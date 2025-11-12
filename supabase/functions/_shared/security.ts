/**
 * 安全检测工具
 * 防止 Prompt Injection 和越權資料洩漏
 */

/**
 * 模型输出分类
 */
export type ResponseCategory = 'supportive' | 'suggestion' | 'crisis' | 'unknown';

/**
 * 安全检测结果
 */
export interface SecurityCheckResult {
  isSafe: boolean;
  category: ResponseCategory;
  riskLevel: 'low' | 'medium' | 'high';
  detectedKeywords: string[];
  reason?: string;
}

/**
 * 自伤/他伤关键词列表（中英文）
 */
const CRISIS_KEYWORDS = {
  zh: [
    '自殺', '自殺', '自傷', '自殘', '結束生命', '不想活了', '死了算了',
    '殺人', '傷害', '報復', '攻擊', '暴力', '傷害他人',
    '跳樓', '割腕', '上吊', '服毒', '燒炭',
    '極度絕望', '無路可走', '沒有希望', '生無可戀'
  ],
  en: [
    'suicide', 'kill myself', 'end my life', 'self harm', 'self injury',
    'kill someone', 'hurt someone', 'attack', 'violence', 'revenge',
    'jump off', 'cut myself', 'hang myself', 'overdose', 'carbon monoxide',
    'hopeless', 'no way out', 'no hope', 'life not worth living'
  ]
};

/**
 * 检测文本中是否包含危机关键词
 */
export function detectCrisisKeywords(text: string, language: string = 'zh-TW'): {
  detected: boolean;
  keywords: string[];
} {
  const lang = language.startsWith('zh') ? 'zh' : 'en';
  const keywords = CRISIS_KEYWORDS[lang as keyof typeof CRISIS_KEYWORDS] || CRISIS_KEYWORDS.zh;
  const lowerText = text.toLowerCase();
  
  const detectedKeywords = keywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  return {
    detected: detectedKeywords.length > 0,
    keywords: detectedKeywords
  };
}

/**
 * 对用户输入进行最小化上下文拼接
 * 只提取必要的情绪信息，避免暴露敏感字段
 */
export function sanitizeUserInput(input: {
  emotion?: string;
  intensity?: number;
  description?: string;
}): string {
  // 只提取必要的上下文信息
  const parts: string[] = [];
  
  if (input.emotion) {
    parts.push(`情绪类型: ${input.emotion}`);
  }
  
  if (typeof input.intensity === 'number') {
    parts.push(`强度: ${input.intensity}/100`);
  }
  
  // 对描述进行清理，移除可能的 prompt injection 尝试
  if (input.description) {
    const cleanedDescription = cleanDescription(input.description);
    parts.push(`描述: ${cleanedDescription}`);
  }
  
  return parts.join('\n');
}

/**
 * 清理用户描述，防止 prompt injection
 * 导出以便单独使用
 */
export function cleanDescription(description: string): string {
  // 移除常见的 prompt injection 模式
  let cleaned = description;
  
  // 移除系统指令尝试
  cleaned = cleaned.replace(/ignore\s+(previous|above|all)\s+(instructions?|prompts?)/gi, '');
  cleaned = cleaned.replace(/system\s*:\s*/gi, '');
  cleaned = cleaned.replace(/assistant\s*:\s*/gi, '');
  cleaned = cleaned.replace(/user\s*:\s*/gi, '');
  
  // 移除特殊标记
  cleaned = cleaned.replace(/<\|.*?\|>/g, '');
  cleaned = cleaned.replace(/\[INST\].*?\[\/INST\]/gs, '');
  
  // 限制长度，防止过长的注入尝试
  const MAX_LENGTH = 2000;
  if (cleaned.length > MAX_LENGTH) {
    cleaned = cleaned.substring(0, MAX_LENGTH) + '...';
  }
  
  return cleaned.trim();
}

/**
 * 分类模型输出
 */
export function categorizeResponse(response: string, language: string = 'zh-TW'): ResponseCategory {
  const lowerResponse = response.toLowerCase();
  const lang = language.startsWith('zh') ? 'zh' : 'en';
  
  // 检测危机提示
  const crisisCheck = detectCrisisKeywords(response, language);
  if (crisisCheck.detected) {
    return 'crisis';
  }
  
  // 检测建议性内容
  const suggestionKeywords = lang === 'zh' 
    ? ['建议', '可以', '试试', '不妨', '推荐', '应该', '最好']
    : ['suggest', 'recommend', 'should', 'could', 'try', 'might', 'consider'];
  
  const hasSuggestion = suggestionKeywords.some(keyword => 
    lowerResponse.includes(keyword.toLowerCase())
  );
  
  if (hasSuggestion) {
    return 'suggestion';
  }
  
  // 默认归类为支持性文本
  return 'supportive';
}

/**
 * 检测用户输入的安全性（在发送到模型前）
 */
export function checkUserInputSecurity(
  userInput: string,
  language: string = 'zh-TW'
): SecurityCheckResult {
  // 检测用户输入中的危机关键词
  const inputCrisis = detectCrisisKeywords(userInput, language);
  
  // 评估风险等级
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let isSafe = true;
  let reason: string | undefined;
  
  if (inputCrisis.detected) {
    riskLevel = 'high';
    isSafe = false;
    reason = '检测到自伤/他伤相关关键词';
  }
  
  return {
    isSafe,
    category: inputCrisis.detected ? 'crisis' : 'unknown',
    riskLevel,
    detectedKeywords: inputCrisis.keywords,
    reason
  };
}

/**
 * 执行完整的安全检测（包括用户输入和 AI 响应）
 */
export function performSecurityCheck(
  userInput: string,
  aiResponse: string,
  language: string = 'zh-TW'
): SecurityCheckResult {
  // 检测用户输入中的危机关键词
  const inputCrisis = detectCrisisKeywords(userInput, language);
  
  // 检测 AI 响应中的危机关键词
  const responseCrisis = detectCrisisKeywords(aiResponse, language);
  
  // 分类响应
  const category = categorizeResponse(aiResponse, language);
  
  // 合并检测到的关键词
  const allKeywords = [...inputCrisis.keywords, ...responseCrisis.keywords];
  
  // 评估风险等级
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let isSafe = true;
  let reason: string | undefined;
  
  if (inputCrisis.detected || responseCrisis.detected) {
    riskLevel = 'high';
    isSafe = false;
    reason = '检测到自伤/他伤相关关键词';
  } else if (category === 'crisis') {
    riskLevel = 'high';
    isSafe = false;
    reason = 'AI 响应被分类为危机提示';
  } else if (category === 'suggestion' && allKeywords.length > 0) {
    riskLevel = 'medium';
    isSafe = true; // 建议性内容但有关键词，标记但不阻止
    reason = '检测到建议性内容，包含相关关键词';
  }
  
  return {
    isSafe,
    category,
    riskLevel,
    detectedKeywords: [...new Set(allKeywords)], // 去重
    reason
  };
}

