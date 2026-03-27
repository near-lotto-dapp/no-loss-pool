import { ProxyContractId as PROXY_CONTRACT_ID } from '../config.ts';

export const stakingActions = {
    /**
     * Deposits and stakes funds into the provider (LiNEAR)
     */
    async depositAndStake(wallet: any, accountId: string, amountYocto: string, providerId: string = 'linear-protocol.near') {
        return await wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId: PROXY_CONTRACT_ID,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "deposit_and_stake",
                        args: { provider_id: providerId },
                        gas: "150000000000000", // 150 TGas
                        deposit: amountYocto, // Attached deposit
                    },
                },
            ],
        });
    },

    async delayedUnstake(wallet: any, accountId: string, sharesAmount: string, providerId: string = 'linear-protocol.near') {
        return await wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId: PROXY_CONTRACT_ID,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "delayed_unstake",
                        args: { amount: sharesAmount, provider_id: providerId },
                        gas: "150000000000000",
                        deposit: "0",
                    },
                },
            ],
        });
    },

    async claimUnstaked(wallet: any, accountId: string) {
        return await wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId: PROXY_CONTRACT_ID,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "claim_unstaked",
                        args: {},
                        gas: "150000000000000",
                        deposit: "0",
                    },
                },
            ],
        });
    },

    /**
     * Instant withdrawal of liquid tokens (LiNEAR)
     */
    async instantWithdraw(wallet: any, accountId: string, sharesAmount: string, providerId: string = 'linear-protocol.near') {
        return await wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId: PROXY_CONTRACT_ID,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "instant_withdraw_shares",
                        args: { amount: sharesAmount, provider_id: providerId },
                        gas: "150000000000000",
                        deposit: "1", // Requires exactly 1 yoctoNEAR
                    },
                },
            ],
        });
    }
};