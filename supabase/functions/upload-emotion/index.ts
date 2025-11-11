import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { uploadEmotionRequestSchema } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

console.log('Upload emotion function started');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing upload emotion request');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Check rate limit before processing
    const rateLimitCheck = await checkRateLimit(supabase, user.id);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitCheck.resetAt.toISOString(),
          },
        }
      );
    }

    console.log(`Rate limit check passed. Remaining: ${rateLimitCheck.remaining} requests`);

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }

    // Comprehensive validation using Zod
    const validationResult = uploadEmotionRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      console.error('Validation errors:', errors);
      throw new Error(`Validation failed: ${errors}`);
    }

    const { emotion, intensity, description, encryptedData, isPublic } = validationResult.data;

    console.log('Request data validated:', { 
      emotion, 
      intensity, 
      isPublic, 
      descriptionLength: description.length 
    });

    // Upload to Walrus
    console.log('Uploading to Walrus...');
    const walrusResponse = await fetch(
      'https://upload-relay.testnet.walrus.space/v1/store?epochs=5',
      {
        method: 'PUT',
        body: encryptedData,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }
    );

    if (!walrusResponse.ok) {
      const errorText = await walrusResponse.text();
      console.error('[INTERNAL] Walrus upload error:', {
        status: walrusResponse.status,
        error: errorText,
      });
      throw new Error('Storage upload failed');
    }

    const walrusResult = await walrusResponse.json();
    console.log('Walrus upload successful');
    
    // Extract blob ID
    let blobId: string;
    if (walrusResult.alreadyCertified) {
      blobId = walrusResult.alreadyCertified.blobId;
    } else if (walrusResult.newlyCreated) {
      blobId = walrusResult.newlyCreated.blobObject.blobId;
    } else {
      throw new Error('Unexpected storage response format');
    }

    const walrusUrl = `https://aggregator.testnet.walrus.space/v1/${blobId}`;

    // Calculate payload hash
    const encoder = new TextEncoder();
    const data = encoder.encode(encryptedData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('Storing in database...');

    // Store in database
    const { data: record, error: dbError } = await supabase
      .from('emotion_records')
      .insert({
        user_id: user.id,
        emotion,
        intensity,
        description,
        blob_id: blobId,
        walrus_url: walrusUrl,
        payload_hash: payloadHash,
        is_public: isPublic || false,
        proof_status: 'confirmed',
        sui_ref: walrusResult.newlyCreated?.blobObject?.id || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store record');
    }

    console.log('Record created successfully:', record.id);

    return new Response(
      JSON.stringify({
        success: true,
        record: {
          id: record.id,
          blobId,
          walrusUrl,
          payloadHash,
          proofStatus: 'confirmed',
          suiRef: walrusResult.newlyCreated?.blobObject?.id || null,
          timestamp: record.created_at,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in upload-emotion:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
