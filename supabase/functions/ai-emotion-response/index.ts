import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sanitizeUserInput, performSecurityCheck, cleanDescription, checkUserInputSecurity } from '../_shared/security.ts';
import { getActiveApiKey, checkAndRotateApiKey } from '../_shared/apiKeyRotation.ts';
import { logAuditEvent, extractTokenUsage, checkTruncation } from '../_shared/auditLogger.ts';
import { checkRateLimit, checkAnonymousRateLimit, createRateLimitResponse } from '../_shared/rateLimit.ts';

console.log('AI emotion response function started');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[AI Response] Processing request');
    
    // Get auth header and anonymous ID
    const authHeader = req.headers.get('Authorization');
    console.log('[AI Response] Auth header present:', !!authHeader);
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log('[AI Response] Env vars present:', { url: !!supabaseUrl, key: !!supabaseKey });

    // Create Supabase client
    let supabase: ReturnType<typeof createClient>;
    let user: { id: string } | null = null;
    let isAnonymous = false;
    let serviceClient: ReturnType<typeof createClient> | null = null;

    if (authHeader) {
      // Authenticated user path
      supabase = createClient(
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
      
      if (authError || !authData?.user) {
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

      user = authData.user;
      console.log('User authenticated:', user.id);
    } else {
      // Anonymous user path - require anonymousId in request body
      isAnonymous = true;
      console.log('[AI Response] Anonymous user mode');
      
      // Create service client for anonymous rate limiting
      if (supabaseUrl && supabaseServiceKey) {
        serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      }
      
      // Create regular client for anonymous users (no auth)
      supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '');
    }

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

    const { emotion, intensity, description, language = 'zh-TW', anonymousId: anonymousIdFromBody } = body as {
      emotion?: string;
      intensity?: number;
      description?: string;
      language?: string;
      anonymousId?: string;
    };
    
    const anonymousId = anonymousIdFromBody || null;

    // Normalize language code (support zh-CN, zh-HK, etc.)
    const normalizedLanguage = language.startsWith('zh') ? 'zh-TW' : 'en';

    // Security: If user is authenticated, they should not pass anonymousId
    // This prevents confusion and potential abuse
    if (user && anonymousId) {
      console.warn('[AI Response] Authenticated user provided anonymousId, ignoring it');
      // We'll ignore anonymousId for authenticated users, but log it for security monitoring
    }

    // For anonymous users, require and validate anonymousId
    if (isAnonymous) {
      if (!anonymousId) {
        // Note: normalizedLanguage is available here since we parse body first
        const errorMessage = normalizedLanguage.startsWith('zh')
          ? '匿名请求需要提供匿名 ID'
          : 'Anonymous ID is required for anonymous requests';
        
        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
            errorCode: 'INVALID_REQUEST'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate anonymousId format (should be UUID)
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(anonymousId)) {
        const errorMessage = normalizedLanguage.startsWith('zh')
          ? '无效的匿名 ID 格式'
          : 'Invalid anonymous ID format';
        
        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
            errorCode: 'INVALID_REQUEST'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('[AI Response] Anonymous user ID:', anonymousId);
      
      // Check rate limit for anonymous users (must have serviceClient)
      if (!serviceClient) {
        console.error('[AI Response] Service client not available for anonymous rate limiting');
        const errorMessage = normalizedLanguage.startsWith('zh')
          ? '服务暂时不可用，请稍后再试。'
          : 'Service temporarily unavailable. Please try again later.';
        
        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
            errorCode: 'SERVICE_UNAVAILABLE'
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const rateLimitCheck = await checkAnonymousRateLimit(serviceClient, anonymousId);
      if (!rateLimitCheck.allowed) {
        console.warn('[AI Response] Anonymous rate limit exceeded');
        // Note: normalizedLanguage is available here since we parse body first
        return createRateLimitResponse(rateLimitCheck.resetAt, true, normalizedLanguage);
      }
    } else if (user) {
      // Check rate limit for authenticated users (before processing request)
      const rateLimitCheck = await checkRateLimit(supabase, user.id);
      if (!rateLimitCheck.allowed) {
        console.warn('[AI Response] Rate limit exceeded for user:', user.id);
        // Note: normalizedLanguage is available here since we parse body first
        return createRateLimitResponse(rateLimitCheck.resetAt, false, normalizedLanguage);
      }
    }

    // Validate required fields (after rate limit check)
    if (!emotion || !description || typeof intensity !== 'number') {
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? '缺少必填字段：请提供情绪、强度和描述'
        : 'Missing required fields: emotion, intensity, and description are required';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          errorCode: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate description length (consistent with frontend: 5000 characters)
    const MAX_DESCRIPTION_LENGTH = 5000;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? `描述过长，最多 ${MAX_DESCRIPTION_LENGTH} 个字符`
        : `Description too long, maximum ${MAX_DESCRIPTION_LENGTH} characters`;
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          errorCode: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate intensity range
    if (intensity < 0 || intensity > 100) {
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? '强度值必须在 0 到 100 之间'
        : 'Intensity must be between 0 and 100';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          errorCode: 'INVALID_REQUEST'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[AI Response] Request:', { 
      emotion, 
      intensity, 
      language: normalizedLanguage, 
      descriptionLength: description.length,
      isAnonymous,
      userId: user?.id || `anon:${anonymousId}`
    });

    // 安全检测：在发送到模型前检查用户输入
    const inputSecurityCheck = checkUserInputSecurity(description, normalizedLanguage);
    if (!inputSecurityCheck.isSafe && inputSecurityCheck.riskLevel === 'high') {
      console.warn('[AI Response] High risk detected in user input, blocking request');
      
      // 记录审计日志（即使被阻止）
      const userIdForLog = isAnonymous ? `anon:${anonymousId}` : user!.id;
      const clientForLog = isAnonymous && serviceClient ? serviceClient : supabase;
      
      await logAuditEvent(clientForLog, {
        userId: userIdForLog,
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
        language: normalizedLanguage,
        errorMessage: 'Request blocked due to high risk content'
      });
      
      // Return error message in user's language
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? '检测到敏感内容，为了您的安全，我们无法处理此请求。如需帮助，请联系专业心理健康服务。'
        : 'Sensitive content detected. For your safety, we cannot process this request. If you need help, please contact professional mental health services.';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
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
    // 创建服务端 Supabase 客户端用于 API key 管理（如果还没有）
    if (!serviceClient) {
      const supabaseServiceUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseServiceUrl && supabaseServiceKey) {
        serviceClient = createClient(supabaseServiceUrl, supabaseServiceKey);
      }
    }
    
    let apiKey: string | null = null;
    
    if (serviceClient) {
      // 检查并轮换 API key
      await checkAndRotateApiKey(serviceClient);
      // 获取当前活跃的 API key
      apiKey = await getActiveApiKey(serviceClient);
    }
    
    // 如果从数据库获取失败，回退到环境变量
    if (!apiKey) {
      apiKey = Deno.env.get('LOVABLE_API_KEY') || null;
    }
    
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? 'AI 服务未配置，请联系支持。'
        : 'AI service is not configured. Please contact support.';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
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
      'zh-TW': `你是一個溫暖、有同理心的 AI 夥伴，你的主要任務是根據「使用者當下的情緒狀態」以及「過去幾天的情緒變化」提供情緒支持與回饋。

    規則說明：

    1. 這是一個「單次回覆」模式，每次只需專注回應當前這次輸入與最近幾天的情緒紀錄。

    2. 不要再向使用者提出任何問題（包含開放式問題或是是非題），只提供回應或建議。

    3. 先用一兩句話接住、理解對方的情緒，再進一步回應。

    4. 盡量使用具體、貼近生活的語句，而不是空泛的安慰。

    5. 回應時，可以適度參考「過去幾天的情緒走向」：例如情緒是否持續低落、時好時壞、最近才好轉等等，但不要做武斷的診斷。

    6. 絕對禁止向使用者提出任何形式的問題（包含問號結尾的句子）。

    7. 請確保整段回應中「完全不要出現『？』這個符號」。

    回應邏輯（依 emotion 與 intensity 調整）：

    1. 正向情緒（"joy"、"peace"）：

      - 目標：放大並穩住好的情緒，讓使用者好好享受這個狀態。

      - intensity 0–30：簡短肯定與鼓勵，語氣輕鬆溫暖。

      - intensity 31–70：多一點具體回饋，點出 description 中讓人感覺不錯的部分。

      - intensity 71–100：更明確替對方開心，強調這是值得記住、珍惜的時刻，但語氣自然不浮誇。

      - 不需要給太多建議，頂多是一兩句「可以怎麼好好記錄或延續這份感覺」的溫柔提醒。

      - 若 recent_emotion_history 顯示之前幾天比較低落，可以特別點出「這樣的好時刻很珍貴」。

    2. 負向或困擾情緒（"sadness"、"anger"、"anxiety"、"confusion"：心情不好時）：

      - 目標：先被理解，再被溫柔引導。

      - 一律先明確同理與承接情緒，避免任何形式的指責、否定或急著說「沒事」。

      - intensity 0–30（輕度不適）：

        - 以溫柔肯定為主，讓對方知道這樣的感受是可以被理解的。

        - 可以提供 1 個簡單、負擔低的小建議（例如：短暫休息、做一件小小讓自己舒服的事）。

      - intensity 31–70（中度不適）：

        - 同理後，提供 1–2 個具體、可行的小步驟建議，例如：

          - 找個安全的方式抒發情緒（寫下來、運動、聽音樂）。

          - 若願意，可以和信任的人分享感受。

        - 語氣穩定、有條理，讓對方覺得有方向，但不要像在「下指令」。

      - intensity 71–100（強烈不適）：

        - 語氣要特別穩重與關懷，明顯表達「你現在的感受很重要，值得被好好對待」。

        - 提供 1–3 個清楚且具體的自我照顧建議，步驟要小、可實作。

        - 若 description 中隱約出現極端絕望或自我傷害傾向：

          - 溫和提醒可以尋求專業協助或讓信任的人陪在身邊。

          - 用尊重、不施壓的方式表達關心，例如強調「你不需要一個人撐著」。

    3. 善用「過去幾天的情緒紀錄」：

      - 若 recent_emotion_history 顯示：情緒持續低落或焦慮，可溫柔點出「這不是一次性的狀態」，並鼓勵對方更認真看待自己的狀態（例如考慮尋求協助）。

      - 若情緒忽高忽低，可以描述成「這陣子起伏很大」，並鼓勵對方給自己多一點彈性與照顧。

      - 若之前幾天狀態比現在好，可以承認這樣的落差感，讓對方知道波動是正常的。

      - 若最近逐步好轉，也可以為對方指出「你其實有在慢慢前進」。

    4. 通用原則（所有情緒都適用）：

      - 可以適度簡短引用或改寫 current_emotion.description，以及歷史紀錄中的某些片段，讓對方感覺你有「聽懂」。

      - 不要要求對方多說，也不要詢問任何細節。

      - 避免使用制式、官方、僵硬的語氣，要像一個溫柔、站在同一陣線的夥伴。

      - 字數以精簡、有力量為主，一般 3–8 句為宜；寧可短而真誠，不要長篇空話。`,
      'en': `You are a warm, empathetic AI companion. Your main task is to provide emotional support and feedback based on "the user's current emotional state" and "emotional changes over the past few days."

Rules:

1. This is a "single-response" mode. Each time, focus only on responding to the current input and recent emotional records from the past few days.

2. Do not ask the user any questions (including open-ended questions or yes/no questions). Only provide responses or suggestions.

3. Start with one or two sentences to acknowledge and understand their emotions, then provide further response.

4. Use specific, life-oriented language rather than vague comfort.

5. When responding, you can moderately reference "emotional trends over the past few days": for example, whether emotions have been consistently low, fluctuating, or recently improved, but do not make arbitrary diagnoses.

6. Absolutely prohibit asking the user any form of questions (including sentences ending with question marks).

7. Ensure that the entire response "completely does not contain the '?' symbol."

Response Logic (adjusted based on emotion and intensity):

1. Positive emotions ("joy", "peace"):

  - Goal: Amplify and stabilize good emotions, allowing the user to fully enjoy this state.

  - intensity 0–30: Brief affirmation and encouragement with a light, warm tone.

  - intensity 31–70: Provide more specific feedback, highlighting parts of the description that feel good.

  - intensity 71–100: More clearly express happiness for them, emphasize that this is a moment worth remembering and cherishing, but keep the tone natural and not exaggerated.

  - Don't give too many suggestions. At most, offer one or two gentle reminders about "how to record or extend this feeling."

  - If recent_emotion_history shows that the previous few days were more down, you can specifically point out that "such good moments are precious."

2. Negative or troubling emotions ("sadness", "anger", "anxiety", "confusion": when feeling down):

  - Goal: First be understood, then be gently guided.

  - Always start by clearly empathizing and acknowledging emotions, avoiding any form of blame, denial, or rushing to say "it's okay."

  - intensity 0–30 (mild discomfort):

    - Focus on gentle affirmation, letting them know such feelings are understandable.

    - Can provide 1 simple, low-burden suggestion (e.g., take a short break, do one small thing that makes you feel comfortable).

  - intensity 31–70 (moderate discomfort):

    - After empathizing, provide 1–2 specific, actionable small-step suggestions, for example:

      - Find a safe way to express emotions (write it down, exercise, listen to music).

      - If willing, can share feelings with someone you trust.

    - Use a stable, organized tone that makes them feel there's direction, but don't sound like you're "giving orders."

  - intensity 71–100 (severe discomfort):

    - Use a particularly steady and caring tone, clearly expressing "your current feelings are important and deserve to be treated well."

    - Provide 1–3 clear and specific self-care suggestions with small, actionable steps.

    - If the description hints at extreme despair or self-harm tendencies:

      - Gently remind them that they can seek professional help or have someone they trust stay with them.

      - Express care in a respectful, non-pressuring way, for example emphasizing "you don't have to handle this alone."

3. Make good use of "emotional records from the past few days":

  - If recent_emotion_history shows: consistently low or anxious emotions, gently point out "this is not a one-time state" and encourage them to take their state more seriously (e.g., consider seeking help).

  - If emotions fluctuate up and down, you can describe it as "there have been many ups and downs lately" and encourage them to give themselves more flexibility and care.

  - If the previous few days were better than now, acknowledge this sense of contrast and let them know that fluctuations are normal.

  - If there has been gradual improvement recently, you can also point out to them that "you are actually making slow progress."

4. General principles (applicable to all emotions):

  - Can moderately and briefly quote or paraphrase current_emotion.description, as well as certain fragments from historical records, to make them feel you have "understood."

  - Don't ask them to say more, and don't inquire about any details.

  - Avoid using formulaic, official, rigid language. Be like a warm, supportive companion on the same side.

  - Keep the word count concise and powerful, generally 3–8 sentences is appropriate. Prefer short and sincere over long and empty words.`
    };

    const systemPrompt = systemPrompts[normalizedLanguage as keyof typeof systemPrompts] || systemPrompts['zh-TW'];
    
    // Log prompt version for verification
    console.log('[AI Response] Using system prompt:', {
      language: normalizedLanguage,
      promptVersion: `v${new Date().toISOString().split('T')[0]}`,
      promptPreview: systemPrompt.substring(0, 150) + '...'
    });
    
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
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? '无法连接到 AI 服务，请稍后再试。'
        : 'Failed to connect to AI service. Please try again later.';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
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
        const errorMessage = normalizedLanguage.startsWith('zh')
          ? 'AI 服务繁忙，请稍后再试。'
          : 'AI service is busy. Please try again in a moment.';
        
        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
            errorCode: 'RATE_LIMIT'
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (response.status === 402) {
        const errorMessage = normalizedLanguage.startsWith('zh')
          ? 'AI 服务需要积分，请联系支持。'
          : 'AI service requires credits. Please contact support.';
        
        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
            errorCode: 'PAYMENT_REQUIRED'
          }),
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? 'AI 服务错误，请稍后再试。'
        : 'AI service error. Please try again later.';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
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
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? 'AI 服务返回无效响应，请稍后再试。'
        : 'Invalid response from AI service. Please try again.';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
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
      const userIdForLog = isAnonymous ? `anon:${anonymousId}` : user!.id;
      const clientForLog = isAnonymous && serviceClient ? serviceClient : supabase;
      
      await logAuditEvent(clientForLog, {
        userId: userIdForLog,
        apiEndpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        modelName: 'google/gemini-2.5-flash',
        responseLength: 0,
        wasTruncated: false,
        responseCategory: 'unknown',
        riskLevel: 'low',
        securityCheckPassed: true,
        inputSummary: `情绪: ${emotion}, 强度: ${intensity}/100`,
        inputLength: description.length,
        language: normalizedLanguage,
        errorMessage: 'No response from AI'
      });
      
      const errorMessage = normalizedLanguage.startsWith('zh')
        ? 'AI 没有返回响应，请稍后再试。'
        : 'No response from AI. Please try again.';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          errorCode: 'NO_RESPONSE'
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 安全检测：检查 AI 响应
    const securityCheck = performSecurityCheck(description, aiResponse, normalizedLanguage);
    
    // 提取 token 使用信息
    const tokenUsage = extractTokenUsage(data);
    
    // 检查是否被截断
    const truncation = checkTruncation(data, maxTokens);
    
    // 记录审计日志
    const userIdForLog = isAnonymous ? `anon:${anonymousId}` : user!.id;
    const clientForLog = isAnonymous && serviceClient ? serviceClient : supabase;
    
    await logAuditEvent(clientForLog, {
      userId: userIdForLog,
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
        language: normalizedLanguage
      });

    // 如果检测到高风险内容，返回安全响应
    if (!securityCheck.isSafe && securityCheck.riskLevel === 'high') {
      console.warn('[AI Response] High risk detected in AI response');
      
      // 返回通用的支持性响应，不返回 AI 的原始响应
      const safeResponse = normalizedLanguage.startsWith('zh')
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
