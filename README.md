# Forta Custom Sharding

## Description

Helper library for effortless implementation of custom sharding logic in Forta bots.

### Usage
An example project of how to use the library can be found [here](./example).

First of all, you need to specify the number of scanners you need to run.
This should be done through the `package.json` configuration by specifying `shards: 1` and `target: NUM_SCANNERS`:

```json
  "chainSettings": {
    "default": {
      "shards": 1,
      "target": 6
    }
  }
```

To specify the number of duplicate scanners, you need to specify the `redundancy` property when initializing `BotSharding`.
For example, with 6 scanners, specifying `redundancy` as 2 would create 3 shards.

```ts
const sharding = new BotSharding({
  redundancy: 2,
  isDevelopment: process.env.NODE_ENV !== 'production',
});
```

The following example shows how sharding can be implemented using the library:

```ts
const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = [];

  if (!sharding.isSynced || txEvent.blockNumber % 100 === 0) {
    await sharding.sync(txEvent.network);
  }
  
  // Non-sharded logic...

  if (txEvent.blockNumber % sharding.getShardCount() !== sharding.getShardIndex()) return findings;

  // Sharded logic...
};
```
