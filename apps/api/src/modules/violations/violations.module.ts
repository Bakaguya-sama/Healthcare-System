import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Violation, ViolationSchema } from './entities/violation.entity';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Violation.name, schema: ViolationSchema },
    ]),
  ],
  controllers: [ViolationsController],
  providers: [ViolationsService],
  exports: [ViolationsService],
})
export class ViolationsModule {}
