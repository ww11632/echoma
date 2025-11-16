import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Get encrypted blob function started');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const blobId = pathParts[pathParts.length - 1];
    const network = url.searchParams.get('network') || 'mainnet';

    if (!blobId) {
      throw new Error('Blob ID is required');
    }

    console.log('Fetching encrypted data for blob:', blobId, 'network:', network);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Find the record with this blob_id
    const { data: record, error: dbError } = await supabase
      .from('emotion_records')
      .select('encrypted_data')
      .eq('blob_id', blobId)
      .single();

    if (dbError || !record) {
      console.error('Database error:', dbError);
      throw new Error('Record not found');
    }

    if (!record.encrypted_data) {
      throw new Error('No encrypted data available for this blob');
    }

    console.log('Found encrypted data');

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
