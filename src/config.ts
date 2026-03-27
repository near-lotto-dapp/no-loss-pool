export const NetworkId = import.meta.env.VITE_NETWORK_ID;
export const PoolContractId = import.meta.env.VITE_CONTRACT_ID;
export const ProxyContractId = import.meta.env.VITE_STAKING_PROXY_CONTRACT_ID;

export const RpcUrl = NetworkId === 'mainnet'
    ? 'https://rpc.mainnet.near.org'
    : 'https://rpc.testnet.near.org';