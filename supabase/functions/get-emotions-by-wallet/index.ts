import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Get emotions by wallet function started');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('walletAddress');

    if (!walletAddress) {
      throw new Error('Wallet address is required');
    }

    console.log('Fetching records for wallet:', walletAddress);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get public emotion records for this wallet
    const { data: records, error: dbError } = await supabase
      .from('emotion_records')
      .select('*')
      .eq('user_id', walletAddress)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to fetch records');
    }

    console.log(`Found ${records?.length || 0} public records`);

    return new Response(
      JSON.stringify({
        success: true,
        records: records || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-emotions-by-wallet:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch records',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
