import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { emotion, intensity, description, language = 'zh-TW' } = await req.json();

    console.log('[AI Response] Request:', { emotion, intensity, language });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build system prompt based on language
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

情境：
- 情緒：${emotion}
- 強度：${intensity}/100
- 描述：${description}

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

Context:
- Emotion: ${emotion}
- Intensity: ${intensity}/100
- Description: ${description}

Please respond in English.`
    };

    const systemPrompt = systemPrompts[language as keyof typeof systemPrompts] || systemPrompts['zh-TW'];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: description }
        ],
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('[AI Response] Rate limit exceeded');
        return new Response(JSON.stringify({ 
          error: 'AI service is busy. Please try again in a moment.',
          errorCode: 'RATE_LIMIT'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error('[AI Response] Payment required');
        return new Response(JSON.stringify({ 
          error: 'AI service requires credits. Please contact support.',
          errorCode: 'PAYMENT_REQUIRED'
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const errorText = await response.text();
      console.error('[AI Response] API error:', response.status, errorText);
      throw new Error('AI service error');
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    console.log('[AI Response] Success');

    return new Response(JSON.stringify({ 
      success: true, 
      response: aiResponse 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI Response] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
