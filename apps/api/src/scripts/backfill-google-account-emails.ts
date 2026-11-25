import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GoogleAccountEmailBackfillService } from '../modules/authentication/application/services/google-account-email-backfill.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const service = app.get(GoogleAccountEmailBackfillService);
    if (process.argv.includes('--verify')) {
      console.log(JSON.stringify(await service.verifyConsistency()));
      return;
    }
    const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
    const afterArg = process.argv.find((arg) => arg.startsWith('--after='));
    const result = await service.execute({
      apply: process.argv.includes('--apply'),
      limit: limitArg ? Number(limitArg.slice('--limit='.length)) : 100,
      after: afterArg?.slice('--after='.length),
    });
    console.log(JSON.stringify(result));
  } finally {
    await app.close();
  }
}

void main().catch(() => {
  console.error('Google account email maintenance command failed. No data values were logged.');
  process.exitCode = 1;
});
