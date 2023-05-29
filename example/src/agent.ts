import {
  Finding,
  HandleTransaction,
  TransactionEvent,
  Initialize,
  getEthersProvider,
} from 'forta-agent';
import { BotSharding } from './lib';

const sharding = new BotSharding({
  redundancy: 2,
  isDevelopment: process.env.NODE_ENV === 'development',
});

const initialize: Initialize = async () => {
  const provider = getEthersProvider();
  const network = await provider.getNetwork();
  await sharding.sync(network.chainId);
  console.log("Initialized")
};

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = [];

  // sync sharding data
  if (txEvent.blockNumber % 1000 === 0) {
    const t0 = performance.now();
    await sharding.sync(txEvent.network);
    console.log(`Sync performed in ${performance.now() - t0}`);
  }

  if (txEvent.blockNumber % sharding.getShardCount() !== sharding.getShardIndex()) return findings;

  // bot logic is placed here

  return findings;
};

export default {
  initialize,
  handleTransaction,
};
