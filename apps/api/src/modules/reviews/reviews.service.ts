import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument, ReviewStatus } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
  ) {}

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
    if (dto.sessionId && !Types.ObjectId.isValid(dto.sessionId)) {
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
      sessionId: dto.sessionId ? new Types.ObjectId(dto.sessionId) : undefined,
      rating: dto.rating,
      comment: dto.comment,
      status: ReviewStatus.ACTIVE,
      isVerifiedPurchase: !!dto.sessionId,
    });

    await review.populate('patientId', 'name email avatarUrl');
    await review.populate('doctorId', 'name specialization avatarUrl');

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

    if (query.status) {
      filter.status = query.status;
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
        .populate('patientId', 'name email avatarUrl')
        .populate('doctorId', 'name email specialization avatarUrl')
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
          status: ReviewStatus.ACTIVE,
        })
        .populate('patientId', 'name avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      this.reviewModel.countDocuments({
        doctorId: new Types.ObjectId(doctorId),
        status: ReviewStatus.ACTIVE,
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

    const result = await this.reviewModel.aggregate([
      {
        $match: {
          doctorId: new Types.ObjectId(doctorId),
          status: ReviewStatus.ACTIVE,
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
      averageRating: 0,
      totalReviews: 0,
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
      .populate('patientId', 'name email avatarUrl')
      .populate('doctorId', 'name email specialization avatarUrl');

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

    // Update fields
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment;
    if (dto.status !== undefined) review.status = dto.status;

    await review.save();

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

    const userObjectId = new Types.ObjectId(userId);

    // Check if already marked as helpful
    if (review.helpfulBy.includes(userObjectId)) {
      throw new BadRequestException('You have already marked this as helpful');
    }

    review.helpfulBy.push(userObjectId);
    review.helpfulCount = review.helpfulBy.length;
    await review.save();

    return {
      statusCode: 200,
      message: 'Review marked as helpful',
      data: {
        helpfulCount: review.helpfulCount,
      },
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

    const userObjectId = new Types.ObjectId(userId);

    // Check if marked as helpful
    const index = review.helpfulBy.indexOf(userObjectId);
    if (index === -1) {
      throw new BadRequestException(
        'You have not marked this as helpful yet',
      );
    }

    review.helpfulBy.splice(index, 1);
    review.helpfulCount = review.helpfulBy.length;
    await review.save();

    return {
      statusCode: 200,
      message: 'Review unmarked as helpful',
      data: {
        helpfulCount: review.helpfulCount,
      },
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

    await this.reviewModel.findByIdAndDelete(new Types.ObjectId(id));

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

    review.status = ReviewStatus.FLAGGED;
    review.adminNotes = adminNotes;
    await review.save();

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
    const topDoctors = await this.reviewModel.aggregate([
      {
        $match: { status: ReviewStatus.ACTIVE },
      },
      {
        $group: {
          _id: '$doctorId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $sort: { averageRating: -1, totalReviews: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctorInfo',
        },
      },
      {
        $unwind: '$doctorInfo',
      },
      {
        $project: {
          _id: 0,
          doctorId: '$_id',
          doctorName: '$doctorInfo.name',
          specialization: '$doctorInfo.specialization',
          avatarUrl: '$doctorInfo.avatarUrl',
          averageRating: 1,
          totalReviews: 1,
        },
      },
    ]);

    return {
      statusCode: 200,
      message: 'Top doctors retrieved successfully',
      data: topDoctors,
    };
  }
}
