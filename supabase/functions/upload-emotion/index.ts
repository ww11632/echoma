import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    const body = await req.json();
    const { emotion, intensity, description, encryptedData, isPublic } = body;

    console.log('Request data:', { emotion, intensity, isPublic, descriptionLength: description?.length });

    // Validate inputs
    if (!emotion || !intensity || !description || !encryptedData) {
      throw new Error('Missing required fields');
    }

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
