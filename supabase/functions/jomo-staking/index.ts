import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import * as nearAPI from "npm:near-api-js@2.1.4"
import { decrypt } from "../withdraw-near/crypto.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const toYocto = (amount: string | number): string => {
  if (!amount) return "0";
  const cleanAmount = amount.toString().replace(',', '.').trim();
  const [whole, fraction = ""] = cleanAmount.split(".");
  const paddedFraction = fraction.padEnd(24, "0").slice(0, 24);
  return (whole + paddedFraction).replace(/^0+/, "") || "0";
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, amount, providerId = 'linear-protocol.near' } = await req.json();

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('encrypted_private_key, near_account_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) throw new Error('Profile not found');

    const masterSecret = Deno.env.get('ENCRYPTION_SECRET');
    if (!masterSecret) throw new Error('Server configuration error');

    const decryptedKey = await decrypt(profile.encrypted_private_key, masterSecret);

    const { KeyPair, keyStores, connect } = nearAPI;
    const myKeyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(decryptedKey);
    await myKeyStore.setKey("mainnet", profile.near_account_id, keyPair);

    const near = await connect({
      networkId: "mainnet",
      keyStore: myKeyStore,
      nodeUrl: "https://rpc.mainnet.near.org",
    });

    const account = await near.account(profile.near_account_id);
    const PROXY_CONTRACT = Deno.env.get("CONTRACT_ID") || "proxy.jomo-vault.near";
    const MAX_GAS = "300000000000000";

    let result;

    switch (action) {
      case 'stake': {
        if (!amount) throw new Error("Amount is required");
        console.log(`[STAKE] Depositing ${amount} NEAR to ${providerId}`);

        result = await account.functionCall({
          contractId: PROXY_CONTRACT,
          methodName: 'deposit_and_stake',
          args: { provider_id: providerId },
          gas: MAX_GAS,
          attachedDeposit: toYocto(amount),
        });
        break;
      }

      case 'unstake': {
        if (!amount) throw new Error("Amount is required");
        const yoctoAmount = toYocto(amount);
        console.log(`[DELAYED_UNSTAKE] Initiating unstake of ${amount} shares for ${profile.near_account_id}`);

        result = await account.functionCall({
          contractId: PROXY_CONTRACT,
          methodName: 'delayed_unstake',
          args: { amount: String(yoctoAmount), provider_id: providerId },
          gas: MAX_GAS,
          attachedDeposit: "0",
        });
        break;
      }

      case 'claim': {
        console.log(`[CLAIM] Claiming ready funds for ${profile.near_account_id}`);

        result = await account.functionCall({
          contractId: PROXY_CONTRACT,
          methodName: 'claim_unstaked',
          args: {},
          gas: MAX_GAS,
          attachedDeposit: "0",
        });
        break;
      }

      case 'instant_unstake': {
        if (!amount) throw new Error("Amount is required");
        const yoctoAmount = toYocto(amount);
        console.log(`[INSTANT_UNSTAKE] Converting ${amount} Shares to NEAR via PROXY for ${profile.near_account_id}`);

        result = await account.functionCall({
          contractId: PROXY_CONTRACT,
          methodName: 'instant_withdraw_shares',
          args: { amount: String(yoctoAmount), provider_id: providerId },
          gas: MAX_GAS,
          attachedDeposit: "1",
        });

        console.log("Instant Unstake successful, proxy distributed NEAR");
        break;
      }

      default:
        throw new Error(`Invalid action provided: ${action}`);
    }

    return new Response(
        JSON.stringify({ success: true, hash: result.transaction?.hash }),
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