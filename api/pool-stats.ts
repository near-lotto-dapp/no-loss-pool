import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const POOL_CONTRACT_ID = process.env.VITE_CONTRACT_ID;

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { data: dbData, error: dbError } = await supabase
            .from('pool_stats')
            .select('*')
            .eq('id', 1)
            .single();

        if (dbError) throw dbError;

        const lastUpdate = new Date(dbData.last_update).getTime();
        const now = new Date().getTime();
        const diffInSeconds = (now - lastUpdate) / 1000;

        if (diffInSeconds < 60) {
            return res.status(200).json({
                tvl: dbData.total_tvl,
                prizePool: dbData.prize_pool,
                cached: true
            });
        }

        const jomoBody = {
            jsonrpc: "2.0",
            id: "dontcare",
            method: "query",
            params: {
                request_type: "call_function",
                finality: "optimistic",
                account_id: POOL_CONTRACT_ID,
                method_name: "get_pool_info",
                args_base64: "e30=" // Порожній {}
            }
        };

        const linearArgsStr = JSON.stringify({ account_id: POOL_CONTRACT_ID });
        const linearBody = {
            jsonrpc: "2.0",
            id: "dontcare",
            method: "query",
            params: {
                request_type: "call_function",
                finality: "optimistic",
                account_id: "linear-protocol.near",
                method_name: "get_account_staked_balance",
                args_base64: Buffer.from(linearArgsStr).toString('base64')
            }
        };

        const [jomoRes, linearRes] = await Promise.all([
            fetch("https://free.rpc.fastnear.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(jomoBody) }),
            fetch("https://free.rpc.fastnear.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(linearBody) })
        ]);

        const jomoData: any = await jomoRes.json();
        const linearData: any = await linearRes.json();

        if (jomoData.error || linearData.error) {
            throw new Error("RPC Error in fetching contract data");
        }

        const jomoResultStr = Buffer.from(jomoData.result.result).toString('utf-8');
        const jomoPoolInfo = JSON.parse(jomoResultStr);

        const linearResultStr = Buffer.from(linearData.result.result).toString('utf-8');
        const totalLinearBalance = JSON.parse(linearResultStr);

        const totalStaked = Number(jomoPoolInfo.total_staked) / 1e24;
        const currentLinearBalance = Number(totalLinearBalance) / 1e24;

        const newTvl = totalStaked;
        const newPrizePool = Math.max(0, currentLinearBalance - totalStaked);

        await supabase
            .from('pool_stats')
            .update({
                total_tvl: newTvl,
                prize_pool: newPrizePool,
                last_update: new Date().toISOString()
            })
            .eq('id', 1);

        return res.status(200).json({
            tvl: newTvl,
            prizePool: newPrizePool,
            cached: false
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: "Failed to fetch pool data" });
    }
}