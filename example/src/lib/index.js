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
exports.BotSharding = void 0;
const ethers_1 = require("ethers");
const lodash_1 = require("lodash");
const forta_agent_1 = require("forta-agent");
const utils_1 = require("./utils");
const constants_1 = require("./constants");
const DispatchAbi_json_1 = __importDefault(require("./abi/DispatchAbi.json"));
const ScannerPoolRegistryABI_json_1 = __importDefault(require("./abi/ScannerPoolRegistryABI.json"));
class BotSharding {
    constructor(params) {
        this.botInfo = null;
        this.shardInfo = null;
        const { redundancy = 1, concurrency = 50, polygonProvider = new ethers_1.ethers.providers.JsonRpcBatchProvider('https://polygon-rpc.com'), dispatchContractAddress = constants_1.DISPATCH_CONTRACT_ADDRESS, scannerPoolRegistryAddress = constants_1.SCANNER_POOL_CONTRACT_ADDRESS, isDevelopment = false, } = params || {};
        this.dispatch = new ethers_1.ethers.Contract(dispatchContractAddress, DispatchAbi_json_1.default, polygonProvider);
        this.scannerRegistry = new ethers_1.ethers.Contract(scannerPoolRegistryAddress, ScannerPoolRegistryABI_json_1.default, polygonProvider);
        this.isDevelopment = isDevelopment;
        this.concurrency = concurrency;
        this.redundancy = redundancy;
    }
    getBotInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.botInfo)
                return this.botInfo;
            const token = yield (0, forta_agent_1.fetchJwt)({});
            const { payload } = (0, forta_agent_1.decodeJwt)(token);
            const botId = payload['bot-id'];
            const scanner = payload.sub.toLowerCase();
            this.botInfo = { botId, scanner };
            return this.botInfo;
        });
    }
    getScanners(blockTag = 'latest') {
        return __awaiter(this, void 0, void 0, function* () {
            const botInfo = yield this.getBotInfo();
            const scannerCount = yield this.dispatch.numScannersFor(botInfo.botId, {
                blockTag: blockTag,
            });
            const scanners = [];
            for (const batch of (0, lodash_1.chunk)((0, lodash_1.range)(scannerCount.toNumber()), this.concurrency)) {
                const result = yield Promise.all(batch.map((i) => (0, utils_1.retry)(() => this.dispatch.scannerAt(botInfo.botId, i, { blockTag })))).then((scanners) => scanners.map((v) => ethers_1.ethers.utils.hexZeroPad(v.toHexString(), 20).toLowerCase()));
                scanners.push(...result);
            }
            const chainIds = [];
            for (const batch of (0, lodash_1.chunk)(scanners, this.concurrency)) {
                const result = yield Promise.all(batch.map((scanner) => (0, utils_1.retry)(() => this.scannerRegistry.getScannerState(scanner, { blockTag })))).then((states) => states.map((state) => state.chainId.toNumber()));
                chainIds.push(...result);
            }
            const scannersByChainId = {};
            for (let i = 0; i < scanners.length; i++) {
                const chainId = chainIds[i];
                const scanner = scanners[i];
                scannersByChainId[chainId] = scannersByChainId[chainId] || [];
                scannersByChainId[chainId].push(scanner);
            }
            return scannersByChainId;
        });
    }
    sync(chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isDevelopment) {
                this.shardInfo = { shardIndex: 0, shardCount: 1, scannerCount: 1 };
                return;
            }
            const botInfo = yield this.getBotInfo();
            const scannersByChainId = yield this.getScanners('latest');
            const scanners = scannersByChainId[chainId] || [];
            let shardCount = Math.max(1, scanners.length);
            let shardIndex = Math.max(0, scanners
                .findIndex((scanner) => scanner === botInfo.scanner.toLowerCase()));
            this.shardInfo = {
                shardIndex: Math.floor(shardIndex / this.redundancy),
                shardCount: Math.max(1, Math.ceil(shardCount / this.redundancy)),
                scannerCount: scanners.length,
            };
        });
    }
    getShardIndex() {
        if (!this.shardInfo)
            throw new Error('sync() has not been executed');
        return this.shardInfo.shardIndex;
    }
    getShardCount() {
        if (!this.shardInfo)
            throw new Error('sync() has not been executed');
        return this.shardInfo.shardCount;
    }
    getScannerCount() {
        if (!this.shardInfo)
            throw new Error('sync() has not been executed');
        return this.shardInfo.scannerCount;
    }
    get isSynced() {
        return !!this.shardInfo;
    }
}
exports.BotSharding = BotSharding;
//# sourceMappingURL=index.js.map