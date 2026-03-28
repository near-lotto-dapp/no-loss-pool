import {fetchWithFallback} from "../../supabase/functions/_shared/near-rpc-base.ts";
export { fetchWithFallback };

export const checkContractClaimReadiness = async (accountId: string, providerId: string): Promise<boolean> => {
    try {
        const data = await fetchWithFallback({
            jsonrpc: "2.0",
            id: "dontcare",
            method: "query",
            params: {
                request_type: "call_function",
                finality: "optimistic",
                account_id: providerId,
                method_name: "get_account",
                args_base64: btoa(JSON.stringify({ account_id: accountId }))
            }
        });

        if (data.result?.result) {
            const resultStr = String.fromCharCode(...data.result.result);
            const accountInfo = JSON.parse(resultStr);

            const canWithdraw = accountInfo.can_withdraw === true;
            const hasUnstakedBalance = BigInt(accountInfo.unstaked_balance || "0") > BigInt(0);

            return canWithdraw && hasUnstakedBalance;
        }
        return false;
    } catch (e) {
        console.error("Failed to fetch deep claim status from pool", e);
        return false;
    }
};