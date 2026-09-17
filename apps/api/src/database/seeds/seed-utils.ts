import { MongoClient, type Db } from 'mongodb';

export async function withDatabase(
  task: (db: Db) => Promise<void>,
): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required to seed the database');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    await task(client.db());
  } finally {
    await client.close();
  }
}
