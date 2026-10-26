import { MongoClient } from 'mongodb';
import { loadDatabaseEnvironment } from './load-database-environment';

function redactHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb\+srv:/, 'https:')).host;
  } catch {
    return 'unparseable-uri';
  }
}

async function main() {
  loadDatabaseEnvironment();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const startedAt = Date.now();
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
  });
  try {
    await client.connect();
    await client.db().command({ ping: 1 });
    console.log(
      JSON.stringify({
        status: 'ok',
        host: redactHost(uri),
        latencyMs: Date.now() - startedAt,
      }),
    );
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://[redacted]') : 'unknown error';
  console.error(JSON.stringify({ status: 'failed', message }));
  process.exitCode = 1;
});
