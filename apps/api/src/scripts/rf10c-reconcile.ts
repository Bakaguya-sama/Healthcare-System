import { MongoClient } from 'mongodb';
import {
  assertRf10cReady,
  reconcileRf10c,
} from '../database/migrations/rf10c-reconciliation';

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri)
    throw new Error('MONGODB_URI is required for RF-10C reconciliation');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const report = await reconcileRf10c(client.db());
    console.log(JSON.stringify(report, null, 2));
    assertRf10cReady(report);
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
