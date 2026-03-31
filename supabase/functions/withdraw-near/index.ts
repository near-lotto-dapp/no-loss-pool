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
    console.log(`WD Request: ${amount} NEAR to ${recipientId}`);

    const JOMO_TREASURY = Deno.env.get('VITE_STAKING_PROXY_CONTRACT_ID');
    if (!JOMO_TREASURY) {
      throw new Error('Server configuration error: Treasury ID missing');
    }

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized');

    console.log(`Processing withdrawal for: ${user.email}`);

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('encrypted_private_key, near_account_id')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) throw new Error('Profile/Wallet not found');

    const masterSecret = Deno.env.get('ENCRYPTION_SECRET');
    if (!masterSecret) throw new Error('Server configuration error: Secret missing');

    const decryptedKey = await decrypt(profile.encrypted_private_key, masterSecret);

    const { KeyPair, keyStores, connect, utils } = nearAPI;
    const myKeyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(decryptedKey);
    await myKeyStore.setKey("mainnet", profile.near_account_id, keyPair);

    const nodeUrl = Deno.env.get("VITE_NEAR_MAINNET_URL");
    const near = await connect({
      networkId: "mainnet",
      keyStore: myKeyStore,
      nodeUrl: nodeUrl,
    });

    const account = await near.account(profile.near_account_id);

    // --- Ensure 0.05 NEAR buffer remains untouched ---
    const SAFE_RESERVE_NEAR = "0.05";
    const reserveYocto = BigInt(utils.format.parseNearAmount(SAFE_RESERVE_NEAR)!);

    // Calculate requested amount
    const totalAmountYocto = BigInt(utils.format.parseNearAmount(amount.toString()) || "0");
    if (totalAmountYocto <= 0n) throw new Error('Invalid amount');

    // Verify state balance against the requested amount + our strict reserve buffer
    const state = await account.state();
    const availableBalance = BigInt(state.amount);

    if (totalAmountYocto + reserveYocto > availableBalance) {
      // Calculate how much they can safely withdraw without breaching the reserve
      const maxAvailable = availableBalance > reserveYocto ? availableBalance - reserveYocto : 0n;
      const maxAvailableNear = utils.format.formatNearAmount(maxAvailable.toString());
      throw new Error(`Insufficient balance. Maximum allowed withdrawal is ${maxAvailableNear} NEAR.`);
    }

    // --- Commission calculation (0.1% service security fee) ---
    const jomoFeeYocto = totalAmountYocto / 1000n;

    // 99.9% goes to the requested user address
    const userReceiveYocto = totalAmountYocto - jomoFeeYocto;

    console.log(`Splitting payout: User gets ${userReceiveYocto}, JOMO gets ${jomoFeeYocto}`);

    // Execute the main transaction
    const result = await account.sendMoney(recipientId, userReceiveYocto.toString());
    console.log("Main transfer success! Hash:", result.transaction.hash);

    // Collect the fee
    if (jomoFeeYocto > 0n && recipientId !== JOMO_TREASURY) {
      try {
        await account.sendMoney(JOMO_TREASURY, jomoFeeYocto.toString());
        console.log(`Fee of ${utils.format.formatNearAmount(jomoFeeYocto.toString())} NEAR sent to treasury.`);
      } catch (feeError) {
        console.error("Failed to collect JOMO fee:", feeError.message);
      }
    }

    return new Response(
        JSON.stringify({
          success: true,
          hash: result.transaction.hash,
          fee_collected: utils.format.formatNearAmount(jomoFeeYocto.toString())
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Final Error:", error.message);
    return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})