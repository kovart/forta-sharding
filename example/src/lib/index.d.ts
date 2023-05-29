import { ethers } from 'ethers';
declare class BotSharding {
    private dispatch;
    private scannerRegistry;
    private concurrency;
    private redundancy;
    private isDevelopment;
    private botInfo;
    private shardInfo;
    constructor(params?: {
        redundancy?: number;
        concurrency?: number;
        polygonProvider?: ethers.providers.JsonRpcBatchProvider;
        dispatchContractAddress?: string;
        scannerPoolRegistryAddress?: string;
        isDevelopment?: boolean;
    });
    private getBotInfo;
    private getScanners;
    sync(chainId: number): Promise<void>;
    getShardIndex(): number;
    getShardCount(): number;
}
export { BotSharding };
//# sourceMappingURL=index.d.ts.map