import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlacklistKeywordsService } from './blacklist-keywords.service';
import { BlacklistKeywordsController } from './blacklist-keywords.controller';
import { BlacklistKeyword, BlacklistKeywordSchema } from './entities/blacklist-keyword.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlacklistKeyword.name, schema: BlacklistKeywordSchema },
    ]),
  ],
  controllers: [BlacklistKeywordsController],
  providers: [BlacklistKeywordsService],
  exports: [BlacklistKeywordsService],
})
export class BlacklistKeywordsModule {}
