import { Finding, HandleTransaction, TransactionEvent } from 'forta-agent';
import { BotSharding } from './lib';

const sharding = new BotSharding({
  redundancy: 2,
  isDevelopment: process.env.NODE_ENV === 'development',
});

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = [];

  if (!sharding.isSynced || txEvent.blockNumber % 100 === 0) {
    const t0 = performance.now();
    await sharding.sync(txEvent.network);
    console.log(`Sync performed in ${performance.now() - t0}`);
    console.log(`Shard count: ${sharding.getShardCount()}. Shard index: ${sharding.getShardIndex()}. Scanner count: ${sharding.getScannerCount()}`)
  }

  if (txEvent.blockNumber % sharding.getShardCount() !== sharding.getShardIndex()) return findings;

  // bot logic is placed here

  return findings;
};

export default {
  handleTransaction,
};
