"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mockFetchJwt = jest.fn();
const mockDecodeJwt = jest.fn();
jest.mock('forta-agent', () => (Object.assign(Object.assign({}, jest.requireActual('forta-agent')), { fetchJwt: mockFetchJwt, decodeJwt: mockDecodeJwt })));
const forta_agent_1 = require("forta-agent");
const test_1 = require("forta-agent-tools/lib/test");
const ethers_1 = require("ethers");
const forta_agent_tools_1 = require("forta-agent-tools");
const DispatchAbi_json_1 = __importDefault(require("./abi/DispatchAbi.json"));
const ScannerPoolRegistryABI_json_1 = __importDefault(require("./abi/ScannerPoolRegistryABI.json"));
const index_1 = require("./index");
describe('BotSharding', () => {
    const dispatchContractAddress = (0, forta_agent_tools_1.createAddress)('0x12345');
    const scannerPoolRegistryAddress = (0, forta_agent_tools_1.createAddress)('0x54321');
    const chainId = forta_agent_1.Network.GOERLI;
    const botInfo = {
        botId: '0x80ed808b586aeebe9cdd4088ea4dea0a8e322909c0e4493c993e060e89c09ed1',
        scanner: '0x558b1a17770a9e9eec78fa57b64dfa2a732b6e9c',
    };
    const mockProvider = new test_1.MockEthersProvider();
    let sharding;
    beforeEach(() => {
        mockProvider.clear();
        mockFetchJwt.mockReset();
        mockDecodeJwt.mockReset();
        sharding = new index_1.BotSharding({
            dispatchContractAddress: dispatchContractAddress,
            scannerPoolRegistryAddress: scannerPoolRegistryAddress,
            polygonProvider: mockProvider,
        });
    });
    function mockBotInfo(params) {
        mockDecodeJwt.mockReturnValue({
            payload: {
                'bot-id': params.botId,
                sub: params.scanner,
            },
        });
    }
    function mockScanners(botId, chainId, scanners) {
        const dispatchIface = new ethers_1.ethers.utils.Interface(DispatchAbi_json_1.default);
        const scannerRegistryIface = new ethers_1.ethers.utils.Interface(ScannerPoolRegistryABI_json_1.default);
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
            mockProvider.addCallTo(scannerPoolRegistryAddress, 'latest', scannerRegistryIface, 'getScannerState', {
                inputs: [scanner],
                outputs: [false, (0, forta_agent_tools_1.createAddress)('0xdead'), chainId, '', false, false],
            });
        }
    }
    it('should return shardCount = 1 and shardIndex = 0 if there are no scanners attached to the bot', () => __awaiter(void 0, void 0, void 0, function* () {
        mockBotInfo(botInfo);
        mockScanners(botInfo.botId, chainId, []);
        yield sharding.sync(chainId);
        expect(sharding.getShardCount()).toStrictEqual(1);
        expect(sharding.getShardIndex()).toStrictEqual(0);
    }));
    it('should return shardCount = 1 and shardIndex = 0 if it is development environment', () => __awaiter(void 0, void 0, void 0, function* () {
        sharding = new index_1.BotSharding({
            isDevelopment: true,
            dispatchContractAddress: dispatchContractAddress,
            scannerPoolRegistryAddress: scannerPoolRegistryAddress,
            polygonProvider: mockProvider,
        });
        mockBotInfo(botInfo);
        mockScanners(botInfo.botId, chainId, [(0, forta_agent_tools_1.createAddress)('0x999')]);
        yield sharding.sync(chainId);
        expect(mockFetchJwt).not.toBeCalled();
        expect(mockDecodeJwt).not.toBeCalled();
        expect(sharding.getShardCount()).toStrictEqual(1);
        expect(sharding.getShardIndex()).toStrictEqual(0);
    }));
    it('should return proper shardIndex and shardCount values', () => __awaiter(void 0, void 0, void 0, function* () {
        const botInfo = {
            botId: '0x80ed808b586aeebe9cdd4088ea4dea0a8e322909c0e4493c993e060e89c09ed1',
            scanner: (0, forta_agent_tools_1.createAddress)('0x555'),
        };
        mockBotInfo(botInfo);
        mockScanners(botInfo.botId, chainId, [botInfo.scanner]);
        yield sharding.sync(chainId);
        expect(sharding.getShardCount()).toStrictEqual(1);
        expect(sharding.getShardIndex()).toStrictEqual(0);
        mockProvider.clear();
        // ------
        mockScanners(botInfo.botId, chainId, [
            (0, forta_agent_tools_1.createAddress)('0x100'),
            botInfo.scanner,
            (0, forta_agent_tools_1.createAddress)('0x101'),
        ]);
        yield sharding.sync(chainId);
        expect(sharding.getShardCount()).toStrictEqual(3);
        expect(sharding.getShardIndex()).toStrictEqual(1);
    }));
    it('should return proper shardIndex and shardCount values with enabled redundancy', () => __awaiter(void 0, void 0, void 0, function* () {
        sharding = new index_1.BotSharding({
            redundancy: 3,
            dispatchContractAddress: dispatchContractAddress,
            scannerPoolRegistryAddress: scannerPoolRegistryAddress,
            polygonProvider: mockProvider,
        });
        mockBotInfo(botInfo);
        // 2 scanners
        // ---------------
        mockScanners(botInfo.botId, chainId, [
            (0, forta_agent_tools_1.createAddress)('0x111'),
            botInfo.scanner,
        ]);
        yield sharding.sync(chainId);
        expect(sharding.getShardCount()).toStrictEqual(1);
        expect(sharding.getShardIndex()).toStrictEqual(0);
        mockProvider.clear();
        // 3 scanners
        // ---------------
        mockScanners(botInfo.botId, chainId, [
            (0, forta_agent_tools_1.createAddress)('0x111'),
            (0, forta_agent_tools_1.createAddress)('0x222'),
            botInfo.scanner,
        ]);
        yield sharding.sync(chainId);
        expect(sharding.getShardCount()).toStrictEqual(1);
        expect(sharding.getShardIndex()).toStrictEqual(0);
        mockProvider.clear();
        // 4 scanners
        // ---------------
        mockScanners(botInfo.botId, chainId, [
            (0, forta_agent_tools_1.createAddress)('0x111'),
            (0, forta_agent_tools_1.createAddress)('0x222'),
            (0, forta_agent_tools_1.createAddress)('0x333'),
            botInfo.scanner,
        ]);
        yield sharding.sync(chainId);
        expect(sharding.getShardCount()).toStrictEqual(2);
        expect(sharding.getShardIndex()).toStrictEqual(1);
        mockProvider.clear();
        // 6 scanners
        // ---------------
        mockScanners(botInfo.botId, chainId, [
            (0, forta_agent_tools_1.createAddress)('0x111'),
            (0, forta_agent_tools_1.createAddress)('0x222'),
            (0, forta_agent_tools_1.createAddress)('0x333'),
            (0, forta_agent_tools_1.createAddress)('0x444'),
            (0, forta_agent_tools_1.createAddress)('0x555'),
            botInfo.scanner,
        ]);
        yield sharding.sync(chainId);
        expect(sharding.getShardCount()).toStrictEqual(2);
        expect(sharding.getShardIndex()).toStrictEqual(1);
    }));
});
//# sourceMappingURL=index.spec.js.map