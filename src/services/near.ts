import { JsonRpcProvider } from "@near-js/providers";
import { InMemoryKeyStore } from "@near-js/keystores";
import { KeyPair } from "@near-js/crypto";
import * as nearUtils from "@near-js/utils";
// @ts-ignore
import * as nearAPI from "near-api-js";

// === CONFIGURATION ===
const NETWORK_ID = import.meta.env.VITE_NETWORK_ID || 'mainnet';
const RPC_URL = import.meta.env.VITE_NEAR_URL || 'https://rpc.mainnet.near.org';
const PROXY_CONTRACT_ID = import.meta.env.VITE_STAKING_PROXY_CONTRACT_ID || 'proxy.jomo-vault.near';

const provider = new JsonRpcProvider({ url: RPC_URL });

const toYocto = (amount: string | number): string => {
    const cleanAmount = (amount || "0").toString().trim();
    try {
        // @ts-ignore
        const parsed = nearAPI.utils?.format?.parseNearAmount(cleanAmount) ||
            nearUtils?.parseNearAmount?.(cleanAmount);
        if (parsed) return parsed;
    } catch (e) {
        console.warn("Library parse failed, falling back to manual conversion");
    }
    let [whole, fraction = ""] = cleanAmount.split(".");
    const paddedFraction = fraction.padEnd(24, "0").slice(0, 24);
    const result = (whole + paddedFraction).replace(/^0+/, "") || "0";
    return result;
};

const decodeResult = (result: number[]) => {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(result)));
};

export interface UnstakeRequest {
    provider_id: string;
    amount: string;
    initial_deposit_value: string;
    unlock_epoch: number;
    is_claimed: boolean;
}

export interface UserMetrics {
    total_deposited: string;
    total_withdrawn: string;
}

// ========================================================
// 1. DATA READING SERVICE (FREE, NO SIGNATURE REQUIRED)
// ========================================================
export const stakingService = {
    async getUserShares(accountId: string, providerId: string = 'linear-protocol.near'): Promise<string> {
        try {
            const argsBase64 = window.btoa(JSON.stringify({ account_id: accountId, provider_id: providerId }));
            const res = await provider.query({
                request_type: 'call_function',
                account_id: PROXY_CONTRACT_ID,
                method_name: 'get_user_shares',
                args_base64: argsBase64,
                finality: 'optimistic',
            });
            return decodeResult((res as any).result);
        } catch (error) {
            console.error("Error fetching shares:", error);
            return "0";
        }
    },

    // Rate for LiNEAR
    async getLinearPrice(): Promise<string> {
        try {
            const res = await fetch(import.meta.env.VITE_NEAR_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: "dontcare",
                    method: "query",
                    params: {
                        request_type: "call_function",
                        finality: "optimistic",
                        account_id: "linear-protocol.near",
                        method_name: "ft_price",
                        args_base64: btoa("{}")
                    }
                })
            });
            const data = await res.json();
            if (data.result?.result) {
                const resultString = String.fromCharCode(...data.result.result);
                return JSON.parse(resultString);
            }
            return "1000000000000000000000000";
        } catch (e) {
            console.error("Failed to fetch LiNEAR price", e);
            return "1000000000000000000000000";
        }
    },

    /**
     * Fetches the SINGLE active unstake request (or null)
     */
    async getUserUnstakeRequest(accountId: string): Promise<UnstakeRequest | null> {
        try {
            const argsBase64 = window.btoa(JSON.stringify({ account_id: accountId }));
            const res = await provider.query({
                request_type: 'call_function',
                account_id: PROXY_CONTRACT_ID,
                method_name: 'get_user_unstake_request',
                args_base64: argsBase64,
                finality: 'optimistic',
            });
            return decodeResult((res as any).result);
        } catch (error) {
            console.error("Error fetching unstake request:", error);
            return null;
        }
    },

    /**
     * Fetches user metrics to calculate P&L on frontend
     */
    async getUserMetrics(accountId: string): Promise<UserMetrics> {
        try {
            const argsBase64 = window.btoa(JSON.stringify({ account_id: accountId }));
            const res = await provider.query({
                request_type: 'call_function',
                account_id: PROXY_CONTRACT_ID,
                method_name: 'get_user_metrics',
                args_base64: argsBase64,
                finality: 'optimistic',
            });
            return decodeResult((res as any).result);
        } catch (error) {
            console.error("Error fetching user metrics:", error);
            return { total_deposited: "0", total_withdrawn: "0" };
        }
    },

    async getCurrentEpoch(): Promise<number> {
        try {
            const res = await provider.query({
                request_type: 'call_function',
                account_id: PROXY_CONTRACT_ID,
                method_name: 'get_current_epoch',
                args_base64: window.btoa(JSON.stringify({})),
                finality: 'optimistic',
            });
            return decodeResult((res as any).result);
        } catch (error) {
            console.error("Error fetching current epoch:", error);
            return 0;
        }
    }
};

// ========================================================
// 2. TRANSACTION SERVICE (DEPOSIT, UNSTAKE - REQUIRES KEY)
// ========================================================

const _getAccount = async (accountId: string, privateKey: string) => {
    if (!privateKey) throw new Error(`CRITICAL: privateKey is missing for account ${accountId}. Cannot sign transaction!`);

    const keyStore = new InMemoryKeyStore();
    const keyPair = KeyPair.fromString(privateKey as any);
    await keyStore.setKey(NETWORK_ID, accountId, keyPair);

    // @ts-ignore
    const nearConnection = await nearAPI.connect({
        networkId: NETWORK_ID,
        keyStore: keyStore,
        nodeUrl: RPC_URL,
    });

    return await nearConnection.account(accountId);
};

export const seamlessStakingActions = {
    async depositAndStake(accountId: string, privateKey: string, amountInNear: string | number, providerId: string = 'linear-protocol.near') {
        const account = await _getAccount(accountId, privateKey);
        const amountInYocto = toYocto(amountInNear);

        console.log(`Depositing ${amountInNear} NEAR (${amountInYocto} yocto) from ${accountId}...`);

        return await account.functionCall({
            contractId: PROXY_CONTRACT_ID,
            methodName: "deposit_and_stake",
            args: { provider_id: providerId },
            gas: "150000000000000",
            attachedDeposit: amountInYocto as any,
        });
    },

    async delayedUnstake(accountId: string, privateKey: string, sharesAmount: string | number, providerId: string = 'linear-protocol.near') {
        const account = await _getAccount(accountId, privateKey);
        const amountInYocto = toYocto(sharesAmount);

        console.log(`Requesting unstake: ${sharesAmount} shares (${amountInYocto} yocto) for ${accountId}...`);

        return await account.functionCall({
            contractId: PROXY_CONTRACT_ID,
            methodName: "delayed_unstake",
            args: { amount: amountInYocto, provider_id: providerId },
            gas: "150000000000000",
            attachedDeposit: "0" as any,
        });
    },

    async claimUnstaked(accountId: string, privateKey: string) {
        const account = await _getAccount(accountId, privateKey);

        console.log(`Claiming ready funds for ${accountId}...`);

        return await account.functionCall({
            contractId: PROXY_CONTRACT_ID,
            methodName: "claim_unstaked",
            args: {},
            gas: "150000000000000",
            attachedDeposit: "0" as any,
        });
    },

    async instantWithdraw(accountId: string, privateKey: string, sharesAmount: string | number, providerId: string = 'linear-protocol.near') {
        const account = await _getAccount(accountId, privateKey);
        const amountInYocto = toYocto(sharesAmount);

        console.log(`Instant unstake: ${sharesAmount} shares (${amountInYocto} yocto) for ${accountId}...`);

        return await account.functionCall({
            contractId: PROXY_CONTRACT_ID,
            methodName: "instant_withdraw_shares",
            args: { amount: amountInYocto, provider_id: providerId },
            gas: "150000000000000",
            attachedDeposit: "1" as any,
        });
    },
};