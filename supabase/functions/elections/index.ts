import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const electionId = pathParts[pathParts.length - 2]; // Get election ID
    const action = pathParts[pathParts.length - 1]; // Get action (result)

    console.log(`Request: ${req.method} ${url.pathname}`, { electionId, action });

    if (req.method === 'GET' && action === 'result') {
      // Get election result endpoint
      console.log('Getting results for election:', electionId);

      // Get current election data
      const { data: election, error: electionError } = await supabase
        .from('votazioni')
        .select('si, no, concluded, categoria, topic')
        .eq('id', parseInt(electionId))
        .single();

      if (electionError) {
        console.error('Election not found:', electionError);
        return new Response(
          JSON.stringify({ error: 'Election not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!election.concluded) {
        // Check if all users have voted
        const { data: categoryData } = await supabase
          .from('categoria')
          .select('num_utenti')
          .eq('nome', election.categoria)
          .single();

        const { data: votesData } = await supabase
          .from('votes')
          .select('user_id')
          .eq('votazione_id', parseInt(electionId));

        const totalUsers = categoryData?.num_utenti || 0;
        const totalVotes = votesData?.length || 0;

        console.log(`Votes check: ${totalVotes}/${totalUsers} votes`);

        if (totalVotes < totalUsers) {
          return new Response(
            JSON.stringify({ status: 'Votazione non conclusa' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // All users have voted, need to conclude the election
        // Here we would normally decrypt the homomorphic sum and update the database
        // For now, we'll simulate with the current si/no values from the database
        const { error: updateError } = await supabase
          .from('votazioni')
          .update({ concluded: true })
          .eq('id', parseInt(electionId));

        if (updateError) {
          console.error('Error concluding election:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to conclude election' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Election concluded successfully');
      }

      return new Response(
        JSON.stringify({ status: 'ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})