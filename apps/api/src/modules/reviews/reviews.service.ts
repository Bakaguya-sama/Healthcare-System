import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
  ) {}

  async create(patientId: string, dto: CreateReviewDto) {
    return this.reviewModel.create({ ...dto, patientId });
  }

  async findByDoctor(doctorId: string) {
    return this.reviewModel
      .find({ doctorId })
      .populate('patientId', 'name avatarUrl')
      .sort({ createdAt: -1 });
  }

  async getDoctorRating(doctorId: string) {
    const result = await this.reviewModel.aggregate([
      { $match: { doctorId: doctorId } },
      {
        $group: {
          _id: '$doctorId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);
    return (
      (result[0] as
        | { averageRating: number; totalReviews: number }
        | undefined) ?? { averageRating: 0, totalReviews: 0 }
    );
  }
}
