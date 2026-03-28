import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import * as nearAPI from "npm:near-api-js@2.1.4"
import { decrypt } from "../withdraw-near/crypto.ts"
import { RPC_NODES } from "../_shared/near-rpc-base.ts"

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
    const payload = await req.json();
    const { action, amount, claimType, providerId = 'linear-protocol.near' } = payload;

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
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
    const PROXY_CONTRACT = Deno.env.get("CONTRACT_ID") || "proxy.jomo-vault.near";
    const MAX_GAS = "300000000000000";
    const BATCH_GAS = "100000000000000";

    let result;
    let lastRpcError;

    for (const nodeUrl of RPC_NODES) {
      try {
        const { KeyPair, keyStores, connect, providers } = nearAPI;
        const myKeyStore = new keyStores.InMemoryKeyStore();
        const keyPair = KeyPair.fromString(decryptedKey);
        await myKeyStore.setKey("mainnet", profile.near_account_id, keyPair);

        const near = await connect({
          networkId: "mainnet",
          keyStore: myKeyStore,
          nodeUrl: nodeUrl,
        });

        const account = await near.account(profile.near_account_id);

        switch (action) {
          case 'stake': {
            if (!amount) throw new Error("Amount is required");
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

            try {
              const storage = await account.viewFunction({
                contractId: providerId,
                methodName: 'storage_balance_of',
                args: { account_id: profile.near_account_id }
              });

              if (!storage) {
                console.log(`[STORAGE] Registering ${profile.near_account_id} on ${providerId}`);
                await account.functionCall({
                  contractId: providerId,
                  methodName: 'storage_deposit',
                  args: { account_id: profile.near_account_id },
                  gas: "30000000000000",
                  attachedDeposit: "1250000000000000000000",
                });
              }
            } catch (e) {
              console.warn("Storage check skipped or failed, proceeding...", e);
            }

            const tx1 = await account.functionCall({
              contractId: PROXY_CONTRACT,
              methodName: 'delayed_withdraw_shares',
              args: { amount: String(yoctoAmount), provider_id: providerId },
              gas: BATCH_GAS,
              attachedDeposit: "1",
            });

            const isSuccess = providers.getTransactionLastResult(tx1);
            if (isSuccess === false) {
              throw new Error("Internal transfer failed. Contract rolled back the shares.");
            }

            const amountBig = BigInt(yoctoAmount);
            const feeBig = (amountBig * 30n) / 10000n;
            const payoutBig = amountBig - feeBig;

            result = await account.functionCall({
              contractId: providerId,
              methodName: 'unstake',
              args: { amount: payoutBig.toString() },
              gas: "150000000000000",
              attachedDeposit: "0",
            });
            break;
          }

          case 'claim': {
            if (claimType === 'legacy') {
              result = await account.functionCall({
                contractId: PROXY_CONTRACT,
                methodName: 'claim_unstaked',
                args: {},
                gas: MAX_GAS,
                attachedDeposit: "0",
              });
            } else {
              result = await account.functionCall({
                contractId: providerId,
                methodName: 'withdraw_all',
                args: {},
                gas: MAX_GAS,
                attachedDeposit: "0",
              });
            }
            break;
          }

          case 'instant_unstake': {
            const yoctoAmount = toYocto(amount);
            result = await account.functionCall({
              contractId: PROXY_CONTRACT,
              methodName: 'instant_withdraw_shares',
              args: { amount: String(yoctoAmount), provider_id: providerId },
              gas: MAX_GAS,
              attachedDeposit: "1",
            });
            break;
          }
        }

        break;

      } catch (err: any) {
        lastRpcError = err;
        const msg = err.message || "";

        if (msg.includes("panic") || msg.includes("ExecutionError") || msg.includes("Smart contract") || msg.includes("Internal transfer failed")) {
          throw err;
        }
        console.warn(`[RPC Backend Warning] Node ${nodeUrl} failed: ${msg}. Trying next...`);
        continue;
      }
    }

    if (!result && lastRpcError) throw lastRpcError;

    if (result?.transaction?.hash) {
      if (action === 'unstake') {
        await supabaseAdmin
            .from('profiles')
            .update({ unstake_start_time: new Date().toISOString() })
            .eq('id', user.id);
      } else if (action === 'claim') {
        await supabaseAdmin
            .from('profiles')
            .update({ unstake_start_time: null })
            .eq('id', user.id);
      }
    }

    return new Response(
        JSON.stringify({ success: true, hash: result?.transaction?.hash }),
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