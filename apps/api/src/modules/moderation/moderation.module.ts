import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlacklistKeywordsController } from './keywords/blacklist-keywords.controller';
import { BlacklistKeywordsService } from './keywords/blacklist-keywords.service';
import {
  BlacklistKeyword,
  BlacklistKeywordSchema,
} from './keywords/entities/blacklist-keyword.entity';
import { ViolationsController } from './violations/violations.controller';
import { ViolationsService } from './violations/violations.service';
import {
  Violation,
  ViolationSchema,
} from './violations/entities/violation.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlacklistKeyword.name, schema: BlacklistKeywordSchema },
      { name: Violation.name, schema: ViolationSchema },
    ]),
  ],
  controllers: [BlacklistKeywordsController, ViolationsController],
  providers: [BlacklistKeywordsService, ViolationsService],
  exports: [BlacklistKeywordsService, ViolationsService],
})
export class ModerationModule {}
