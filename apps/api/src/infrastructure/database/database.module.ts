import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SchemaVersionGuard } from './schema-version.guard';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        autoIndex: config.getOrThrow<boolean>('DB_AUTO_INDEX'),
        autoCreate: config.getOrThrow<boolean>('DB_AUTO_CREATE'),
        serverSelectionTimeoutMS: config.getOrThrow<number>(
          'MONGO_SERVER_SELECTION_TIMEOUT_MS',
        ),
      }),
    }),
  ],
  providers: [SchemaVersionGuard],
  exports: [MongooseModule],
})
export class DatabaseModule {}
