const mockFetchJwt = jest.fn();
const mockDecodeJwt = jest.fn();

jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  fetchJwt: mockFetchJwt,
  decodeJwt: mockDecodeJwt,
}));

import { Network } from 'forta-agent';

import { MockEthersProvider } from 'forta-agent-tools/lib/test';
import { ethers } from 'ethers';
import { createAddress } from 'forta-agent-tools';
import DispatchAbi from './abi/DispatchAbi.json';
import ScannerPoolRegistryABI from './abi/ScannerPoolRegistryABI.json';
import { BotSharding } from './index';

describe('BotSharding', () => {
  const dispatchContractAddress = createAddress('0x12345');
  const scannerPoolRegistryAddress = createAddress('0x54321');
  const chainId = Network.GOERLI;
  const botInfo = {
    botId: '0x80ed808b586aeebe9cdd4088ea4dea0a8e322909c0e4493c993e060e89c09ed1',
    scanner: '0x558b1a17770a9e9eec78fa57b64dfa2a732b6e9c',
  };

  const mockProvider = new MockEthersProvider();

  let sharding: BotSharding;

  beforeEach(() => {
    mockProvider.clear();
    mockFetchJwt.mockReset();
    mockDecodeJwt.mockReset();
    sharding = new BotSharding({
      dispatchContractAddress: dispatchContractAddress,
      scannerPoolRegistryAddress: scannerPoolRegistryAddress,
      polygonProvider: mockProvider as unknown as ethers.providers.JsonRpcBatchProvider,
    });
  });

  function mockBotInfo(params: { botId: string; scanner: string }) {
    mockDecodeJwt.mockReturnValue({
      payload: {
        'bot-id': params.botId,
        sub: params.scanner,
      },
    });
  }

  function mockScanners(botId: string, chainId: number, scanners: string[]) {
    const dispatchIface = new ethers.utils.Interface(DispatchAbi);
    const scannerRegistryIface = new ethers.utils.Interface(ScannerPoolRegistryABI);
    mockProvider.addCallTo(dispatchContractAddress, 'latest', dispatchIface, 'numScannersFor', {
      inputs: [botId],
      outputs: [scanners.length],
    });
    for (let i = 0; i < scanners.length; i++) {
      mockProvider.addCallTo(dispatchContractAddress, 'latest', dispatchIface, 'scannerAt', {
        inputs: [botId, i],
        outputs: [scanners[i]],
      });
    }
    for (const scanner of scanners) {
      mockProvider.addCallTo(
        scannerPoolRegistryAddress,
        'latest',
        scannerRegistryIface,
        'getScannerState',
        {
          inputs: [scanner],
          outputs: [false, createAddress('0xdead'), chainId, '', false, false],
        },
      );
    }
  }

  it('should return shardCount = 1 and shardIndex = 0 if there are no scanners attached to the bot', async () => {
    mockBotInfo(botInfo);
    mockScanners(botInfo.botId, chainId, []);

    await sharding.sync(chainId);

    expect(sharding.getShardCount()).toStrictEqual(1);
    expect(sharding.getShardIndex()).toStrictEqual(0);
  });

  it('should return shardCount = 1 and shardIndex = 0 if it is development environment', async () => {
    sharding = new BotSharding({
      isDevelopment: true,
      dispatchContractAddress: dispatchContractAddress,
      scannerPoolRegistryAddress: scannerPoolRegistryAddress,
      polygonProvider: mockProvider as unknown as ethers.providers.JsonRpcBatchProvider,
    });

    mockBotInfo(botInfo);
    mockScanners(botInfo.botId, chainId, [createAddress('0x999')]);

    await sharding.sync(chainId);

    expect(mockFetchJwt).not.toBeCalled();
    expect(mockDecodeJwt).not.toBeCalled();
    expect(sharding.getShardCount()).toStrictEqual(1);
    expect(sharding.getShardIndex()).toStrictEqual(0);
  });

  it('should return proper shardIndex and shardCount values', async () => {
    const botInfo = {
      botId: '0x80ed808b586aeebe9cdd4088ea4dea0a8e322909c0e4493c993e060e89c09ed1',
      scanner: createAddress('0x555'),
    };

    mockBotInfo(botInfo);
    mockScanners(botInfo.botId, chainId, [botInfo.scanner]);

    await sharding.sync(chainId);

    expect(sharding.getShardCount()).toStrictEqual(1);
    expect(sharding.getShardIndex()).toStrictEqual(0);

    mockProvider.clear();

    // ------

    mockScanners(botInfo.botId, chainId, [
      createAddress('0x100'),
      botInfo.scanner,
      createAddress('0x101'),
    ]);

    await sharding.sync(chainId);

    expect(sharding.getShardCount()).toStrictEqual(3);
    expect(sharding.getShardIndex()).toStrictEqual(1);
  });

  it('should return proper shardIndex and shardCount values with enabled redundancy', async () => {
    sharding = new BotSharding({
      redundancy: 3,
      dispatchContractAddress: dispatchContractAddress,
      scannerPoolRegistryAddress: scannerPoolRegistryAddress,
      polygonProvider: mockProvider as unknown as ethers.providers.JsonRpcBatchProvider,
    });

    mockBotInfo(botInfo);

    // 2 scanners
    // ---------------


    mockScanners(botInfo.botId, chainId, [
      createAddress('0x111'),
      botInfo.scanner,
    ]);

    await sharding.sync(chainId);

    expect(sharding.getShardCount()).toStrictEqual(1);
    expect(sharding.getShardIndex()).toStrictEqual(0);

    mockProvider.clear();

    // 3 scanners
    // ---------------

    mockScanners(botInfo.botId, chainId, [
      createAddress('0x111'),
      createAddress('0x222'),
      botInfo.scanner,
    ]);

    await sharding.sync(chainId);

    expect(sharding.getShardCount()).toStrictEqual(1);
    expect(sharding.getShardIndex()).toStrictEqual(0);

    mockProvider.clear();

    // 4 scanners
    // ---------------

    mockScanners(botInfo.botId, chainId, [
      createAddress('0x111'),
      createAddress('0x222'),
      createAddress('0x333'),
      botInfo.scanner,
    ]);

    await sharding.sync(chainId);

    expect(sharding.getShardCount()).toStrictEqual(2);
    expect(sharding.getShardIndex()).toStrictEqual(1);

    mockProvider.clear();

    // 6 scanners
    // ---------------

    mockScanners(botInfo.botId, chainId, [
      createAddress('0x111'),
      createAddress('0x222'),
      createAddress('0x333'),
      createAddress('0x444'),
      createAddress('0x555'),
      botInfo.scanner,
    ]);

    await sharding.sync(chainId);

    expect(sharding.getShardCount()).toStrictEqual(2);
    expect(sharding.getShardIndex()).toStrictEqual(1);
  });
});
