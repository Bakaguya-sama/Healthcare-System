import { createConnection } from 'node:net';
import { MongoClient } from 'mongodb';

const mongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://localhost:27018/healthcare_rf1_test?replicaSet=rs0&directConnection=true';
const redisHost = process.env.TEST_REDIS_HOST ?? '127.0.0.1';
const redisPort = Number(process.env.TEST_REDIS_PORT ?? 16379);

describe('local test infrastructure', () => {
  let mongoClient: MongoClient;

  beforeAll(async () => {
    mongoClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5_000,
    });
    await mongoClient.connect();
  });

  afterAll(async () => {
    await mongoClient.close();
  });

  it('connects to a writable MongoDB replica-set primary', async () => {
    const hello = await mongoClient.db('admin').command({ hello: 1 });

    expect(hello.setName).toBe('rs0');
    expect(hello.isWritablePrimary).toBe(true);
  });

  it('receives PONG from Redis', async () => {
    const response = await new Promise<string>((resolve, reject) => {
      const socket = createConnection({ host: redisHost, port: redisPort });
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Redis PING timed out'));
      }, 5_000);

      socket.setEncoding('utf8');
      socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      socket.once('connect', () => socket.write('*1\r\n$4\r\nPING\r\n'));
      socket.once('data', (data: string) => {
        clearTimeout(timeout);
        socket.end();
        resolve(data);
      });
    });

    expect(response).toBe('+PONG\r\n');
  });
});
