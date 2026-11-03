import { MongoClient, type Db } from 'mongodb';
import { loadDatabaseEnvironment } from '../load-database-environment';

export async function withDatabase(
  task: (db: Db) => Promise<void>,
): Promise<void> {
  loadDatabaseEnvironment();
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
