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
    
    // Get auth header first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client with user's auth context
    // This ensures RLS policies work correctly with auth.uid()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    // Create service client for rate limiting (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Check rate limit before processing (using service client to bypass RLS)
    const rateLimitCheck = await checkRateLimit(serviceClient, user.id);
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

    const { emotion, intensity, description, encryptedData, isPublic, epochs, network } = validationResult.data;

    console.log('Request data validated:', { 
      emotion, 
      intensity, 
      isPublic, 
      descriptionLength: description.length 
    });

    // Upload to Walrus
    console.log('Uploading to Walrus...');
    console.log('Encrypted data type:', typeof encryptedData);
    console.log('Encrypted data length:', encryptedData.length);
    
    // Convert JSON string to binary data (Uint8Array) for Walrus
    // Walrus expects binary data, not JSON strings
    const encoder = new TextEncoder();
    const binaryData = encoder.encode(encryptedData);
    console.log('Binary data length:', binaryData.length);
    
    // Calculate payload hash (before Walrus upload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', binaryData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    let blobId: string | null = null;
    let walrusUrl: string | null = null;
    let suiRef: string | null = null;
    let useDbFallback = false;
    
    // Validate and set epochs (default to 200 if not provided)
    const validEpochs = epochs && epochs >= 1 && epochs <= 1000 ? epochs : 200;
    // Validate network (default to testnet for backward compatibility)
    const targetNetwork = network === "mainnet" ? "mainnet" : "testnet";
    
    // Get Walrus endpoints based on network
    const walrusPublisherUrl = targetNetwork === "mainnet"
      ? "https://upload-relay.mainnet.walrus.space"
      : "https://upload-relay.testnet.walrus.space";
    const walrusAggregatorUrl = targetNetwork === "mainnet"
      ? "https://aggregator.mainnet.walrus.space"
      : "https://aggregator.testnet.walrus.space";
    
    console.log(`Using ${validEpochs} epochs for Walrus upload on ${targetNetwork}`);
    console.log(`Walrus publisher: ${walrusPublisherUrl}`);
    console.log(`Walrus aggregator: ${walrusAggregatorUrl}`);
    
    try {
      const walrusResponse = await fetch(
        `${walrusPublisherUrl}/v1/store?epochs=${validEpochs}`,
        {
          method: 'PUT',
          body: binaryData,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        }
      );

      if (!walrusResponse.ok) {
        let errorText = '';
        try {
          errorText = await walrusResponse.text();
        } catch (e) {
          console.error('[INTERNAL] Failed to read error response:', e);
        }
        
        console.error('[INTERNAL] Walrus upload error:', {
          status: walrusResponse.status,
          statusText: walrusResponse.statusText,
          error: errorText,
          dataLength: encryptedData.length,
          binaryDataLength: binaryData.length,
          headers: Object.fromEntries(walrusResponse.headers.entries()),
        });
        
        // If Walrus is unavailable (404) or has server error (5xx), use database fallback
        if (walrusResponse.status === 404 || walrusResponse.status >= 500) {
          console.warn('Walrus unavailable, using database fallback for encrypted data storage');
          useDbFallback = true;
        } else if (walrusResponse.status === 400) {
          const details = errorText ? ` Details: ${errorText.substring(0, 200)}` : '';
          throw new Error(`Invalid data format sent to storage service.${details}`);
        } else if (walrusResponse.status === 413) {
          throw new Error('Data too large for storage service.');
        } else {
          const details = errorText ? ` ${errorText.substring(0, 200)}` : '';
          throw new Error(`Storage upload failed (${walrusResponse.status}).${details}`);
        }
      } else {
        const walrusResult = await walrusResponse.json();
        console.log('Walrus upload successful');
        
        // Extract blob ID
        if (walrusResult.alreadyCertified) {
          blobId = walrusResult.alreadyCertified.blobId;
        } else if (walrusResult.newlyCreated) {
          blobId = walrusResult.newlyCreated.blobObject.blobId;
        } else {
          throw new Error('Unexpected storage response format');
        }

        walrusUrl = `${walrusAggregatorUrl}/v1/${blobId}`;
        suiRef = walrusResult.newlyCreated?.blobObject?.id || null;
      }
    } catch (error) {
      // If it's a network error or timeout, use database fallback
      if (error instanceof TypeError) {
        console.warn('Network error connecting to Walrus, using database fallback:', error);
        useDbFallback = true;
      } else if (error instanceof Error && error.message?.includes('fetch')) {
        console.warn('Fetch error connecting to Walrus, using database fallback:', error);
        useDbFallback = true;
      } else {
        // Re-throw other errors (validation errors, etc.)
        throw error;
      }
    }

    console.log('Storing in database...');

    // Store in database
    // Security: Do not store plaintext description
    // Description is encrypted in encryptedData (stored in Walrus or database fallback)
    // All sensitive data should be decrypted client-side
    // This ensures encryption-at-rest for all mental health data
    const { data: record, error: dbError } = await supabase
      .from('emotion_records')
      .insert({
        user_id: user.id,
        emotion,
        intensity,
        // Do not store plaintext description - it's encrypted in Walrus or database
        description: null,
        blob_id: blobId,
        walrus_url: walrusUrl,
        payload_hash: payloadHash,
        is_public: isPublic || false,
        proof_status: 'confirmed',
        sui_ref: suiRef,
        // Fallback: Store encrypted data in database if Walrus is unavailable
        encrypted_data: useDbFallback ? encryptedData : null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store record');
    }

    console.log('Record created successfully:', record.id);
    if (useDbFallback) {
      console.log('Encrypted data stored in database (Walrus unavailable)');
    }

    return new Response(
      JSON.stringify({
        success: true,
        record: {
          id: record.id,
          blobId,
          walrusUrl,
          payloadHash,
          proofStatus: 'confirmed',
          suiRef,
          timestamp: record.created_at,
          fallbackUsed: useDbFallback,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in upload-emotion:', error);
    
    // Extract error message safely
    let errorMessage = 'Upload failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    // Ensure error message is not too long and is safe for JSON
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '...';
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
