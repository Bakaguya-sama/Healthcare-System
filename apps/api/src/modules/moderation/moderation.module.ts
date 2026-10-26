import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlacklistKeywordsController } from './keywords/presentation/controllers/blacklist-keywords.controller';
import { BlacklistKeywordsService } from './keywords/application/services/blacklist-keywords.service';
import {
  BlacklistKeyword,
  BlacklistKeywordSchema,
} from './keywords/domain/entities/blacklist-keyword.entity';
import { ViolationsController } from './violations/presentation/controllers/violations.controller';
import { ViolationsService } from './violations/application/services/violations.service';
import {
  Violation,
  ViolationSchema,
} from './violations/domain/entities/violation.entity';

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
