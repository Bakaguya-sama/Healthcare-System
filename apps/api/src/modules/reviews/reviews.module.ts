import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Review, ReviewSchema } from './entities/review.entity';
import { Doctor, DoctorSchema } from '../users/entities/doctor.schema';
import { Consultation, ConsultationSchema } from '../sessions/entities/consultation.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Doctor.name, schema: DoctorSchema },
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
    UsersModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
