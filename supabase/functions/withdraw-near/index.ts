import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import * as nearAPI from "npm:near-api-js@2.1.4"
import { decrypt } from "./crypto.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recipientId, amount } = await req.json()
    console.log(`WD ${amount} NEAR to ${recipientId}`);

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing Authorization header");
      throw new Error('Missing Authorization header');
    }

    console.log("Check user transaction...");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      console.error("Unauthorized:", authError?.message);
      throw new Error('Unauthorized');
    }
    console.log(`User is active: ${user.email} (ID: ${user.id})`);

    console.log("Check wallet...");
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('encrypted_private_key, near_account_id')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
      console.error("Profile not found:", profileError?.message);
      throw new Error('Profile not found');
    }
    console.log(`Profile was found: ${profile.near_account_id}`);

    const masterSecret = Deno.env.get('ENCRYPTION_SECRET');
    if (!masterSecret) {
      throw new Error('Server configuration error');
    }

    const decryptedKey = await decrypt(profile.encrypted_private_key, masterSecret);

    const { KeyPair, keyStores, connect, utils } = nearAPI;
    const myKeyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(decryptedKey);
    await myKeyStore.setKey("mainnet", profile.near_account_id, keyPair);
    const nodeUrl = Deno.env.get("VITE_NEAR_MAINNET_URL");
    console.log(`Connecting to NEAR RPC: ${nodeUrl}`);

    const near = await connect({
      networkId: "mainnet",
      keyStore: myKeyStore,
      nodeUrl: nodeUrl,
    });

    const account = await near.account(profile.near_account_id);
    const amountInYocto = utils.format.parseNearAmount(amount.toString());

    if (!amountInYocto) {
      throw new Error('Invalid amount format');
    }

    console.log("Verifying balance...");
    const state = await account.state();
    const availableBalance = BigInt(state.amount);
    const requestedAmount = BigInt(amountInYocto);

    const reserveForGasString = utils.format.parseNearAmount("0.001");
    if (!reserveForGasString) {
      throw new Error('Failed to calculate gas reserve');
    }
    const reserveForGas = BigInt(reserveForGasString);

    if (requestedAmount + reserveForGas > availableBalance) {
      const maxAvailable = availableBalance > reserveForGas ? availableBalance - reserveForGas : 0n;
      const maxAvailableNear = utils.format.formatNearAmount(maxAvailable.toString());

      throw new Error(`Insufficient balance. You can withdraw up to ${maxAvailableNear} NEAR.`);
    }

    console.log(`Sending ${amountInYocto} yoctoNEAR to ${recipientId}...`);
    const result = await account.sendMoney(recipientId, amountInYocto);
    console.log("Success! Hash:", result.transaction.hash);

    return new Response(
        JSON.stringify({ success: true, hash: result.transaction.hash }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})