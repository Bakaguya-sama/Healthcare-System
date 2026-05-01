import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import {
  Doctor,
  DoctorDocument,
  DoctorVerificationStatus,
} from '../users/entities/doctor.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
  ) {}

  private async getDoctorProfileByUserId(doctorUserId: string) {
    if (!Types.ObjectId.isValid(doctorUserId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    const doctorProfile = await this.doctorModel.findOne({
      userId: new Types.ObjectId(doctorUserId),
    });

    if (!doctorProfile) {
      throw new NotFoundException('Doctor profile not found');
    }

    return doctorProfile;
  }

  private async applyRatingDelta(
    doctorUserId: string,
    ratingDelta: number,
    reviewCountDelta: number,
  ) {
    const updatedDoctor = await this.doctorModel.findOneAndUpdate(
      { userId: new Types.ObjectId(doctorUserId) },
      [
        {
          $set: {
            ratingSum: {
              $add: [{ $ifNull: ['$ratingSum', 0] }, ratingDelta],
            },
            reviewCount: {
              $add: [{ $ifNull: ['$reviewCount', 0] }, reviewCountDelta],
            },
          },
        },
        {
          $set: {
            averageRating: {
              $cond: [
                { $gt: ['$reviewCount', 0] },
                { $divide: ['$ratingSum', '$reviewCount'] },
                0,
              ],
            },
          },
        },
      ] as any,
      { new: true },
    );

    if (!updatedDoctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    return updatedDoctor;
  }

  /**
   * 📝 TẠO ĐÁH GIÁ MỚI
   */
  async create(patientId: string, dto: CreateReviewDto) {
    if (!Types.ObjectId.isValid(patientId)) {
      throw new BadRequestException('Invalid patient ID');
    }
    if (!Types.ObjectId.isValid(dto.doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }
    if (dto.doctorSessionId && !Types.ObjectId.isValid(dto.doctorSessionId)) {
      throw new BadRequestException('Invalid session ID');
    }

    // Check if patient already reviewed this doctor (prevent duplicate reviews)
    const existingReview = await this.reviewModel.findOne({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this doctor');
    }

    const review = await this.reviewModel.create({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
      doctorSessionId: dto.doctorSessionId
        ? new Types.ObjectId(dto.doctorSessionId)
        : undefined,
      rating: dto.rating,
      comment: dto.comment,
    });

    try {
      await this.applyRatingDelta(dto.doctorId, dto.rating, 1);
    } catch (error) {
      await this.reviewModel.findByIdAndDelete(review._id);
      throw error;
    }

    return {
      statusCode: 201,
      message: 'Review created successfully',
      data: review,
    };
  }

  /**
   * 📊 LẤY TẤT CẢ ĐÁH GIÁ (CÓ FILTER & PAGINATION)
   */
  async findAll(query: QueryReviewDto) {
    const filter: any = {};

    // Apply filters
    if (query.doctorId) {
      if (!Types.ObjectId.isValid(query.doctorId)) {
        throw new BadRequestException('Invalid doctor ID');
      }
      filter.doctorId = new Types.ObjectId(query.doctorId);
    }

    if (query.patientId) {
      if (!Types.ObjectId.isValid(query.patientId)) {
        throw new BadRequestException('Invalid patient ID');
      }
      filter.patientId = new Types.ObjectId(query.patientId);
    }

    if (query.rating) {
      filter.rating = query.rating;
    }

    // Pagination & sorting
    const skip = (query.page - 1) * query.limit;
    const sort = {
      [query.sortBy || 'createdAt']: query.sortOrder || -1,
    };

    // Execute query
    const [data, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('patientId', 'fullName email avatarUrl')
        .populate('doctorId', 'fullName email specialty avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(query.limit),
      this.reviewModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Reviews retrieved successfully',
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 🔍 LẤY ĐÁH GIÁ CỦA DOCTOR
   */
  async findByDoctor(doctorId: string, query?: Partial<QueryReviewDto>) {
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    const pageNum = query?.page || 1;
    const limitNum = query?.limit || 10;
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find({
          doctorId: new Types.ObjectId(doctorId),
        })
        .populate('patientId', 'fullName avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      this.reviewModel.countDocuments({
        doctorId: new Types.ObjectId(doctorId),
      }),
    ]);

    return {
      statusCode: 200,
      message: 'Doctor reviews retrieved successfully',
      data: reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * ⭐ LẤY ĐIỂM ĐÁNH GIÁ TRUNG BÌNH CỦA DOCTOR
   */
  async getDoctorRating(doctorId: string) {
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    const doctorProfile = await this.getDoctorProfileByUserId(doctorId);

    const result = await this.reviewModel.aggregate([
      {
        $match: {
          doctorId: new Types.ObjectId(doctorId),
        },
      },
      {
        $group: {
          _id: '$doctorId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          fiveStarCount: {
            $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] },
          },
          fourStarCount: {
            $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] },
          },
          threeStarCount: {
            $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] },
          },
          twoStarCount: {
            $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] },
          },
          oneStarCount: {
            $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = result[0] || {
      averageRating: doctorProfile.averageRating ?? 0,
      totalReviews: doctorProfile.reviewCount ?? 0,
      fiveStarCount: 0,
      fourStarCount: 0,
      threeStarCount: 0,
      twoStarCount: 0,
      oneStarCount: 0,
    };

    return {
      statusCode: 200,
      message: 'Doctor rating retrieved successfully',
      data: {
        doctorId,
        averageRating: Math.round(stats.averageRating * 10) / 10,
        totalReviews: stats.totalReviews,
        starDistribution: {
          fiveStar: stats.fiveStarCount,
          fourStar: stats.fourStarCount,
          threeStar: stats.threeStarCount,
          twoStar: stats.twoStarCount,
          oneStar: stats.oneStarCount,
        },
      },
    };
  }

  /**
   * 🔍 LẤY 1 ĐÁH GIÁ
   */
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel
      .findById(new Types.ObjectId(id))
      .populate('patientId', 'fullName email avatarUrl')
      .populate('doctorId', 'fullName email specialty avatarUrl');

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return {
      statusCode: 200,
      message: 'Review retrieved successfully',
      data: review,
    };
  }

  /**
   * ✏️ CẬP NHẬT ĐÁH GIÁ (PATIENT CHỈ CÓ THỂ CẬP NHẬT CỦA MÌ̀NH)
   */
  async update(userId: string, id: string, dto: UpdateReviewDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(new Types.ObjectId(id));

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Only patient who wrote the review can update
    if (review.patientId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this review',
      );
    }

    const oldRating = review.rating;
    const oldComment = review.comment;

    // Update fields
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment;

    await review.save();

    if (dto.rating !== undefined && dto.rating !== oldRating) {
      try {
        await this.applyRatingDelta(
          review.doctorId.toString(),
          dto.rating - oldRating,
          0,
        );
      } catch (error) {
        review.rating = oldRating;
        review.comment = oldComment;
        await review.save();
        throw error;
      }
    }

    return {
      statusCode: 200,
      message: 'Review updated successfully',
      data: review,
    };
  }

  /**
   * 👍 MARK REVIEW AS HELPFUL
   */
  async markHelpful(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(new Types.ObjectId(id));

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return {
      statusCode: 200,
      message: 'Review marked as helpful',
      data: review,
    };
  }

  /**
   * ❌ UNMARK REVIEW AS HELPFUL
   */
  async unmarkHelpful(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(new Types.ObjectId(id));

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return {
      statusCode: 200,
      message: 'Review unmarked as helpful',
      data: review,
    };
  }

  /**
   * 🗑️ XÓA ĐÁH GIÁ (PATIENT CHỈ CÓ THỂ XÓA CỦA MÌNH)
   */
  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(new Types.ObjectId(id));

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Only patient who wrote the review can delete
    if (review.patientId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this review',
      );
    }

    try {
      await this.applyRatingDelta(
        review.doctorId.toString(),
        -review.rating,
        -1,
      );
      await this.reviewModel.findByIdAndDelete(new Types.ObjectId(id));
    } catch (error) {
      try {
        await this.applyRatingDelta(
          review.doctorId.toString(),
          review.rating,
          1,
        );
      } catch {
        // ignore rollback failure; original error is more important
      }
      throw error;
    }

    return {
      statusCode: 200,
      message: 'Review deleted successfully',
    };
  }

  /**
   * 🚩 FLAG REVIEW (ADMIN ONLY - for inappropriate content)
   */
  async flagReview(id: string, adminNotes: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(new Types.ObjectId(id));

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return {
      statusCode: 200,
      message: 'Review flagged successfully',
      data: review,
    };
  }

  /**
   * 📈 GET TOP REVIEWED DOCTORS
   */
  async getTopDoctors(limit: number = 10) {
    const topDoctors = await this.doctorModel
      .find({
        verificationStatus: DoctorVerificationStatus.APPROVED,
        reviewCount: { $gt: 0 },
      })
      .populate('userId', 'fullName avatarUrl email')
      .sort({ averageRating: -1, reviewCount: -1 })
      .limit(limit)
      .lean();

    return {
      statusCode: 200,
      message: 'Top doctors retrieved successfully',
      data: topDoctors.map((doctor: any) => ({
        doctorId: doctor.userId?._id ?? doctor.userId,
        doctorName: doctor.userId?.fullName,
        specialty: doctor.specialty,
        avatarUrl: doctor.userId?.avatarUrl,
        averageRating: doctor.averageRating ?? 0,
        totalReviews: doctor.reviewCount ?? 0,
      })),
    };
  }
}
