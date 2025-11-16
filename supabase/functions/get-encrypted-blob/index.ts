import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Get encrypted blob function started');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const blobId = url.searchParams.get('blobId');
    const network = url.searchParams.get('network') || 'mainnet';

    if (!blobId) {
      throw new Error('Blob ID is required');
    }

    console.log('Fetching encrypted data for blob:', blobId, 'network:', network);
    
    // Get auth header if present for private records
    const authHeader = req.headers.get('Authorization');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: authHeader ? {
          headers: {
            Authorization: authHeader,
          },
        } : {},
        auth: {
          persistSession: false,
        },
      }
    );

    // Find the record with this blob_id
    // Use maybeSingle() to handle missing records gracefully
    const { data: record, error: dbError } = await supabase
      .from('emotion_records')
      .select('encrypted_data, is_public, user_id')
      .eq('blob_id', blobId)
      .maybeSingle();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to fetch record');
    }

    // If no record found with this blob_id, it means the data is stored only on Walrus
    // Return success with null to indicate the client should fetch directly from Walrus
    if (!record) {
      console.log('No database record found for blob_id:', blobId, '- data is on Walrus only');
      return new Response(
        JSON.stringify({
          success: true,
          encryptedData: null,
          message: 'Data is stored on Walrus, not in database backup',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!record.encrypted_data) {
      console.log('Record found but no encrypted data - should fetch from Walrus');
      return new Response(
        JSON.stringify({
          success: true,
          encryptedData: null,
          message: 'Data is stored on Walrus, not in database backup',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Found encrypted data in database for blob:', blobId);

    return new Response(
      JSON.stringify({
        success: true,
        encryptedData: record.encrypted_data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-encrypted-blob:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch encrypted data',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
