import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import * as nearAPI from "npm:near-api-js@2.1.4"
import { encrypt } from "../withdraw-near/crypto.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    const { data: existingProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('near_account_id')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
      console.error("Database check error:", profileError.message);
      throw new Error('Database error while verifying wallet status');
    }

    if (existingProfile && existingProfile.near_account_id) {
      console.error(`[SECURITY ALERT] Blocked attempt to overwrite existing wallet for user ${user.id}. Wallet: ${existingProfile.near_account_id}`);
      throw new Error('WALLET_ALREADY_EXISTS');
    }

    const { KeyPair } = nearAPI;
    const keyPair = KeyPair.fromRandom('ed25519');

    const privateKey = keyPair.toString();

    const pkData = keyPair.getPublicKey().data;
    const implicitAccountId = Array.from(pkData)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const masterSecret = Deno.env.get('ENCRYPTION_SECRET');
    if (!masterSecret) throw new Error('Server configuration error: Missing ENCRYPTION_SECRET');

    const encryptedKey = await encrypt(privateKey, masterSecret);

    const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          near_account_id: implicitAccountId,
          encrypted_private_key: encryptedKey,
          public_key: keyPair.getPublicKey().toString(),
        })
        .eq('id', user.id);

    if (updateError) throw updateError;

    console.log(`[SUCCESS] Wallet created for user ${user.id}: ${implicitAccountId}`);

    return new Response(
        JSON.stringify({ success: true, account_id: implicitAccountId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[ERROR] Wallet generation failed:", error.message);

    if (error.message === 'WALLET_ALREADY_EXISTS') {
      return new Response(
          JSON.stringify({ error: "User already has a wallet. Overwriting is strictly prohibited." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})