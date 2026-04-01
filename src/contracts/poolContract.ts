import { JsonRpcProvider } from '@near-js/providers';
import { parseNearAmount } from '@near-js/utils';
import { PoolContractId, RpcUrl } from '../config';
import {WinnerRecord} from "@/components/pool/winners_history.tsx";
import {MAX_GAS} from "@/utils/constants.ts";

const provider = new JsonRpcProvider({ url: RpcUrl });

export interface UserData {
    active_balance: string;
    pending_balance: string;
    unstaking_balance: string;
    unstake_unlock_time: string;
}

export interface PoolInfo {
    total_active: string;
    total_pending: string;
    total_staked: string;
}

export const poolContract = {
    getUserStaked: async (accountId: string): Promise<UserData | null> => {
        try {
            const argsBase64 = btoa(JSON.stringify({ account_id: accountId }));

            const res = await provider.query({
                request_type: 'call_function',
                account_id: PoolContractId,
                method_name: 'get_user',
                args_base64: argsBase64,
                finality: 'optimistic',
            });

            const resultBytes = (res as any).result;
            const userData = JSON.parse(Buffer.from(resultBytes).toString());

            return userData;
        } catch (error) {
            console.error("Failed to get balance:", error);
            return null;
        }
    },

    getPoolInfo: async (): Promise<PoolInfo> => {
        try {
            const res = await provider.query({
                request_type: 'call_function',
                account_id: PoolContractId,
                method_name: 'get_pool_info',
                args_base64: btoa('{}'),
                finality: 'optimistic',
            });
            const resultBytes = (res as any).result;
            return JSON.parse(Buffer.from(resultBytes).toString());
        } catch (error) {
            console.error("Failed to get pool info:", error);
            return {
                total_active: "0",
                total_pending: "0",
                total_staked: "0"
            };
        }
    },

    getWinnersHistory: async (): Promise<WinnerRecord[]> => {
        try {
            const res = await provider.query({
                request_type: 'call_function',
                account_id: PoolContractId,
                method_name: 'get_winners_history',
                args_base64: btoa('{}'),
                finality: 'optimistic',
            });
            const resultBytes = (res as any).result;
            return JSON.parse(Buffer.from(resultBytes).toString());
        } catch (error) {
            console.error("Failed to fetch winners history:", error);
            return [];
        }
    },

    getLinearBalance: async (): Promise<string> => {
        try {
            const argsBase64 = btoa(JSON.stringify({ account_id: PoolContractId }));

            const res = await provider.query({
                request_type: 'call_function',
                account_id: 'linear-protocol.near',
                method_name: 'get_account_total_balance',
                args_base64: argsBase64,
                finality: 'optimistic',
            });

            const resultBytes = (res as any).result;
            return JSON.parse(Buffer.from(resultBytes).toString());
        } catch (error) {
            console.error("Failed to get LiNEAR balance:", error);
            return "0";
        }
    },

    claim: async (callFunction: any) => {
        return await callFunction({
            contractId: PoolContractId,
            method: 'claim',
            args: {},
            gas: MAX_GAS,
            deposit: '0',
        });
    },

    deposit: async (callFunction: any, amountInNear: string) => {
        const depositInYocto = parseNearAmount(amountInNear);
        if (!depositInYocto) throw new Error("Invalid amount");

        return await callFunction({
            contractId: PoolContractId,
            method: 'deposit',
            args: {},
            gas: MAX_GAS,
            deposit: depositInYocto,
        });
    },

    withdraw: async (callFunction: any, amountInNear: string) => {
        const amountInYocto = parseNearAmount(amountInNear);
        if (!amountInYocto) throw new Error("Invalid amount");

        return await callFunction({
            contractId: PoolContractId,
            method: 'withdraw',
            args: { amount: amountInYocto },
            gas: MAX_GAS,
            deposit: '1',
        });
    },
};