declare const Deno: any;

const getPrimaryRpc = (): string => {
    if (typeof Deno !== 'undefined' && Deno.env) {
        return Deno.env.get("NEAR_RPC_URL") || "https://rpc.mainnet.near.org";
    }
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        return import.meta.env.VITE_NEAR_URL || "https://rpc.mainnet.near.org";
    }
    return "https://rpc.mainnet.near.org";
};

export const RPC_NODES = [
    getPrimaryRpc(),
    "https://rpc.mainnet.fastnear.com",
    "https://near.lava.build",
    "https://1rpc.io/near"
];

export const fetchWithFallback = async (bodyObj: any): Promise<any> => {
    let lastError;

    for (const nodeUrl of RPC_NODES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(nodeUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyObj),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();
            if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);

            return data;
        } catch (e) {
            console.warn(`[RPC Warning] Node ${nodeUrl} failed, trying next...`, e);
            lastError = e;
        }
    }

    throw new Error(`All RPC nodes failed. Last error: ${lastError}`);
};