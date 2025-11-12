import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sanitizeUserInput, performSecurityCheck, cleanDescription, checkUserInputSecurity } from '../_shared/security.ts';
import { getActiveApiKey, checkAndRotateApiKey } from '../_shared/apiKeyRotation.ts';
import { logAuditEvent, extractTokenUsage, checkTruncation } from '../_shared/auditLogger.ts';

console.log('AI emotion response function started');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[AI Response] Processing request');
    
    // Get auth header first
    const authHeader = req.headers.get('Authorization');
    console.log('[AI Response] Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[AI Response] No authorization header provided');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No authorization header',
          errorCode: 'UNAUTHORIZED'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    console.log('[AI Response] Env vars present:', { url: !!supabaseUrl, key: !!supabaseKey });

    // Create Supabase client with user's auth context
    const supabase = createClient(
      supabaseUrl ?? '',
      supabaseKey ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    console.log('[AI Response] Supabase client created, verifying user...');

    // Verify user authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();
    console.log('[AI Response] Auth result:', { 
      hasData: !!authData, 
      hasUser: !!authData?.user, 
      hasError: !!authError,
      errorMessage: authError?.message 
    });
    
    const user = authData?.user;
    
    if (authError || !user) {
      console.error('[AI Response] Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          errorCode: 'UNAUTHORIZED'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('User authenticated:', user.id);

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          errorCode: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate required fields
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request body',
          errorCode: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { emotion, intensity, description, language = 'zh-TW' } = body as {
      emotion?: string;
      intensity?: number;
      description?: string;
      language?: string;
    };

    // Validate required fields
    if (!emotion || !description || typeof intensity !== 'number') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: emotion, intensity, and description are required',
          errorCode: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[AI Response] Request:', { emotion, intensity, language, descriptionLength: description.length });

    // 安全检测：在发送到模型前检查用户输入
    const inputSecurityCheck = checkUserInputSecurity(description, language);
    if (!inputSecurityCheck.isSafe && inputSecurityCheck.riskLevel === 'high') {
      console.warn('[AI Response] High risk detected in user input, blocking request');
      
      // 记录审计日志（即使被阻止）
      await logAuditEvent(supabase, {
        userId: user.id,
        apiEndpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        modelName: 'google/gemini-2.5-flash',
        responseLength: 0,
        wasTruncated: false,
        responseCategory: 'crisis',
        riskLevel: inputSecurityCheck.riskLevel,
        securityCheckPassed: false,
        detectedKeywords: inputSecurityCheck.detectedKeywords,
        inputSummary: `情绪: ${emotion}, 强度: ${intensity}/100`,
        inputLength: description.length,
        language,
        errorMessage: 'Request blocked due to high risk content'
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: '检测到敏感内容，为了您的安全，我们无法处理此请求。如需帮助，请联系专业心理健康服务。',
          errorCode: 'SECURITY_BLOCKED',
          category: 'crisis'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 获取 API key（支持 rotation）
    // 创建服务端 Supabase 客户端用于 API key 管理
    const supabaseServiceUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let apiKey: string | null = null;
    
    if (supabaseServiceUrl && supabaseServiceKey) {
      const serviceClient = createClient(supabaseServiceUrl, supabaseServiceKey);
      // 检查并轮换 API key
      await checkAndRotateApiKey(serviceClient);
      // 获取当前活跃的 API key
      apiKey = await getActiveApiKey(serviceClient);
    }
    
    // 如果从数据库获取失败，回退到环境变量
    if (!apiKey) {
      apiKey = Deno.env.get('LOVABLE_API_KEY');
    }
    
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI service is not configured. Please contact support.',
          errorCode: 'SERVICE_UNAVAILABLE'
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 使用最小化上下文拼接，避免暴露敏感字段
    const sanitizedContext = sanitizeUserInput({
      emotion,
      intensity,
      description
    });

    // Build system prompt based on language (不包含完整描述，只包含摘要)
    const systemPrompts = {
      'zh-TW': `你是一位充滿同理心的情緒支持夥伴。你的任務是：

1. **真誠回應**：用溫暖、真實的語氣回應使用者的情緒
2. **肯定感受**：認可並肯定使用者的感受，不評判
3. **適度提問**：問 1-2 個開放式問題，幫助使用者深入探索情緒
4. **保持簡潔**：回應控制在 3-5 句話，不要過長
5. **正向引導**：在適當時機給予鼓勵和正向觀點

回應風格：
- 使用口語化、親切的語言（像朋友聊天）
- 避免說教或給建議（除非使用者明確請求）
- 多用「你」而不是「我」開頭
- 適度使用表情符號增加溫度

請用繁體中文回應。`,
      'en': `You are an empathetic emotional support companion. Your role is to:

1. **Genuine Response**: Respond with warmth and authenticity
2. **Validate Feelings**: Acknowledge and validate user's emotions without judgment
3. **Ask Thoughtfully**: Ask 1-2 open-ended questions to help explore emotions deeper
4. **Keep It Concise**: Limit response to 3-5 sentences
5. **Positive Guidance**: Offer encouragement and positive perspectives when appropriate

Response Style:
- Use conversational, friendly language (like talking to a friend)
- Avoid being preachy or giving unsolicited advice
- Use "you" rather than "I" to start sentences
- Use emojis moderately to add warmth

Please respond in English.`
    };

    const systemPrompt = systemPrompts[language as keyof typeof systemPrompts] || systemPrompts['zh-TW'];
    
    // 用户消息只包含清理后的描述（最小化上下文，防止 prompt injection）
    const userMessage = cleanDescription(description);

    // Call AI service
    console.log('[AI Response] Calling AI service...');
    const maxTokens = 300;
    let response: Response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.8,
          max_tokens: maxTokens,
        }),
      });
    } catch (fetchError) {
      console.error('[AI Response] Network error calling AI service:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to connect to AI service. Please try again later.',
          errorCode: 'NETWORK_ERROR'
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        console.error('[AI Response] Failed to read error response:', e);
      }

      console.error('[AI Response] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'AI service is busy. Please try again in a moment.',
            errorCode: 'RATE_LIMIT'
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'AI service requires credits. Please contact support.',
            errorCode: 'PAYMENT_REQUIRED'
          }),
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI service error. Please try again later.',
          errorCode: 'AI_SERVICE_ERROR'
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse AI response
    let data: unknown;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[AI Response] Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid response from AI service.',
          errorCode: 'INVALID_RESPONSE'
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract AI response content
    const aiResponse = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.error('[AI Response] No response content in AI response:', JSON.stringify(data).substring(0, 500));
      
      // 记录错误审计日志
      await logAuditEvent(supabase, {
        userId: user.id,
        apiEndpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        modelName: 'google/gemini-2.5-flash',
        responseLength: 0,
        wasTruncated: false,
        responseCategory: 'unknown',
        riskLevel: 'low',
        securityCheckPassed: true,
        inputSummary: `情绪: ${emotion}, 强度: ${intensity}/100`,
        inputLength: description.length,
        language,
        errorMessage: 'No response from AI'
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No response from AI. Please try again.',
          errorCode: 'NO_RESPONSE'
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 安全检测：检查 AI 响应
    const securityCheck = performSecurityCheck(description, aiResponse, language);
    
    // 提取 token 使用信息
    const tokenUsage = extractTokenUsage(data);
    
    // 检查是否被截断
    const truncation = checkTruncation(data, maxTokens);
    
    // 记录审计日志
    await logAuditEvent(supabase, {
      userId: user.id,
      apiEndpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
      modelName: 'google/gemini-2.5-flash',
      promptTokens: tokenUsage.promptTokens,
      completionTokens: tokenUsage.completionTokens,
      totalTokens: tokenUsage.totalTokens,
      responseLength: aiResponse.length,
      wasTruncated: truncation.wasTruncated,
      truncationReason: truncation.reason,
      responseCategory: securityCheck.category,
      riskLevel: securityCheck.riskLevel,
      securityCheckPassed: securityCheck.isSafe,
      detectedKeywords: securityCheck.detectedKeywords,
      inputSummary: `情绪: ${emotion}, 强度: ${intensity}/100`,
      inputLength: description.length,
      language
    });

    // 如果检测到高风险内容，返回安全响应
    if (!securityCheck.isSafe && securityCheck.riskLevel === 'high') {
      console.warn('[AI Response] High risk detected in AI response');
      
      // 返回通用的支持性响应，不返回 AI 的原始响应
      const safeResponse = language.startsWith('zh')
        ? '我理解你正在经历困难。请记住，你并不孤单。如果你正在考虑伤害自己或他人，请立即联系专业心理健康服务或紧急服务。'
        : 'I understand you are going through a difficult time. Please remember you are not alone. If you are considering harming yourself or others, please contact professional mental health services or emergency services immediately.';
      
      return new Response(
        JSON.stringify({
          success: true,
          response: safeResponse,
          category: 'crisis',
          securityNote: 'Response filtered for safety'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[AI Response] Success, response length:', aiResponse.length, 'category:', securityCheck.category);

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        category: securityCheck.category
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[AI Response] Unexpected error:', error);
    
    // Extract error message safely
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    // Ensure error message is not too long
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '...';
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorCode: 'INTERNAL_ERROR'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
