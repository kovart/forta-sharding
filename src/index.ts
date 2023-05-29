import { BigNumber, ethers } from 'ethers';
import { chunk, range } from 'lodash';
import { decodeJwt, fetchJwt } from 'forta-agent';
import { retry } from './utils';
import { DISPATCH_CONTRACT_ADDRESS, SCANNER_POOL_CONTRACT_ADDRESS } from './constants';
import DispatchAbi from './abi/DispatchAbi.json';
import ScannerPoolRegistryABI from './abi/ScannerPoolRegistryABI.json';

type BotInfo = {
  botId: string;
  scanner: string;
};

type ShardInfo = {
  shardCount: number;
  shardIndex: number;
  scannerCount: number;
};

class BotSharding {
  private dispatch: ethers.Contract;
  private scannerRegistry: ethers.Contract;
  private concurrency: number;
  private redundancy: number;
  private isDevelopment: boolean;

  private botInfo: BotInfo | null = null;
  private shardInfo: ShardInfo | null = null;

  constructor(params?: {
    redundancy?: number;
    concurrency?: number;
    polygonProvider?: ethers.providers.JsonRpcBatchProvider;
    dispatchContractAddress?: string;
    scannerPoolRegistryAddress?: string;
    isDevelopment?: boolean;
  }) {
    const {
      redundancy = 1,
      concurrency = 50,
      polygonProvider = new ethers.providers.JsonRpcBatchProvider('https://polygon-rpc.com'),
      dispatchContractAddress = DISPATCH_CONTRACT_ADDRESS,
      scannerPoolRegistryAddress = SCANNER_POOL_CONTRACT_ADDRESS,
      isDevelopment = false,
    } = params || {};

    this.dispatch = new ethers.Contract(dispatchContractAddress, DispatchAbi, polygonProvider);
    this.scannerRegistry = new ethers.Contract(
      scannerPoolRegistryAddress,
      ScannerPoolRegistryABI,
      polygonProvider,
    );

    this.isDevelopment = isDevelopment;
    this.concurrency = concurrency;
    this.redundancy = redundancy;
  }

  private async getBotInfo(): Promise<BotInfo> {
    if (this.botInfo) return this.botInfo;

    const token = await fetchJwt({});
    const { payload } = decodeJwt(token);
    const botId = payload['bot-id'];
    const scanner = payload.sub.toLowerCase();

    this.botInfo = { botId, scanner };

    return this.botInfo;
  }

  private async getScanners(blockTag: number | string = 'latest') {
    const botInfo = await this.getBotInfo();

    const scannerCount = await this.dispatch.numScannersFor(botInfo.botId, {
      blockTag: blockTag,
    });

    const scanners: string[] = [];
    for (const batch of chunk(range(scannerCount.toNumber()), this.concurrency)) {
      const result: string[] = await Promise.all(
        batch.map(
          (i) =>
            retry(() =>
              this.dispatch.scannerAt(botInfo.botId, i, { blockTag }),
            ) as Promise<BigNumber>,
        ),
      ).then((scanners) =>
        scanners.map((v) => ethers.utils.hexZeroPad(v.toHexString(), 20).toLowerCase()),
      );
      scanners.push(...result);
    }

    const chainIds: number[] = [];
    for (const batch of chunk(scanners, this.concurrency)) {
      const result: number[] = await Promise.all(
        batch.map(
          (scanner) =>
            retry(() => this.scannerRegistry.getScannerState(scanner, { blockTag })) as Promise<{
              chainId: BigNumber;
            }>,
        ),
      ).then((states) => states.map((state) => state.chainId.toNumber()));
      chainIds.push(...result);
    }

    const scannersByChainId: { [chainId: number]: string[] } = {};
    for (let i = 0; i < scanners.length; i++) {
      const chainId = chainIds[i];
      const scanner = scanners[i];

      scannersByChainId[chainId] = scannersByChainId[chainId] || [];
      scannersByChainId[chainId].push(scanner);
    }

    return scannersByChainId;
  }

  public async sync(chainId: number) {
    if (this.isDevelopment) {
      this.shardInfo = { shardIndex: 0, shardCount: 1, scannerCount: 1 };
      return;
    }

    const botInfo = await this.getBotInfo();
    const scannersByChainId = await this.getScanners('latest');

    const scanners = scannersByChainId[chainId] || [];

    let shardCount = Math.max(1, scanners.length);
    let shardIndex = Math.max(
      0,
      scanners
        .findIndex((scanner) => scanner === botInfo.scanner.toLowerCase()),
    );

    this.shardInfo = {
      shardIndex: Math.floor(shardIndex / this.redundancy),
      shardCount: Math.max(1, Math.ceil(shardCount / this.redundancy)),
      scannerCount: scanners.length,
    };
  }

  public getShardIndex() {
    if (!this.shardInfo) throw new Error('sync() has not been executed');

    return this.shardInfo.shardIndex;
  }

  public getShardCount() {
    if (!this.shardInfo) throw new Error('sync() has not been executed');

    return this.shardInfo.shardCount;
  }

  public getScannerCount() {
    if (!this.shardInfo) throw new Error('sync() has not been executed');

    return this.shardInfo.scannerCount;
  }

  public get isSynced(): boolean {
    return !!this.shardInfo;
  }
}

export { BotSharding };
