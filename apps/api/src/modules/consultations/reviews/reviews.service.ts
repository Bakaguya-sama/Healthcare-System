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
import { ConsultationSessionStatus } from '../entities/consultation.entity';
import { ConsultationsService } from '../consultations.service';
import { UsersService } from '../../users/public-api';
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from '../../../common/pagination';

const REVIEW_READ_PROJECTION =
  '_id patientId doctorId consultationId rating comment helpfulCount flagged createdAt updatedAt';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly consultations: ConsultationsService,
    private readonly users: UsersService,
  ) {}

  private async getDoctorProfileByUserId(doctorUserId: string) {
    if (!Types.ObjectId.isValid(doctorUserId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    const doctor = await this.users.requireDoctorProfile(doctorUserId);
    return doctor.doctorProfile!;
  }

  private async applyRatingDelta(
    doctorUserId: string,
    ratingDelta: number,
    reviewCountDelta: number,
  ) {
    return this.users.applyDoctorRatingDelta(
      doctorUserId,
      ratingDelta,
      reviewCountDelta,
    );
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
    const consultationId = dto.consultationId;
    if (!Types.ObjectId.isValid(consultationId)) {
      throw new BadRequestException('A valid consultation ID is required');
    }

    await this.users.requireDoctorProfile(dto.doctorId);

    const consultation = await this.consultations.findForReview(
      consultationId,
      patientId,
      dto.doctorId,
    );

    if (!consultation) {
      throw new NotFoundException(
        'Consultation not found or not owned by patient',
      );
    }

    if (
      consultation.sessionStatus &&
      consultation.sessionStatus !== ConsultationSessionStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'A review can only be created after consultation completion',
      );
    }

    // const existingReview = await this.reviewModel.findOne({
    //   patientId: new Types.ObjectId(patientId),
    //   doctorId: doctorProfileId,
    // });

    // if (existingReview) {
    //   throw new BadRequestException('You have already reviewed this doctor');
    // }

    const review = new this.reviewModel({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
      consultationId: new Types.ObjectId(consultationId),
      rating: dto.rating,
      comment: dto.comment,
    });
    try {
      await review.save();
    } catch (error: any) {
      if (error?.code === 11000)
        throw new BadRequestException(
          'This consultation has already been reviewed',
        );
      throw error;
    }
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

    const requestedConsultationId = query.consultationId;
    if (requestedConsultationId) {
      if (!Types.ObjectId.isValid(requestedConsultationId)) {
        throw new BadRequestException('Invalid consultation ID');
      }
      filter.consultationId = new Types.ObjectId(requestedConsultationId);
    }

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
      _id: query.sortOrder || -1,
    };

    // Execute query
    const [data, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .select(REVIEW_READ_PROJECTION)
        .populate('patientId', 'fullName email avatarUrl')
        .populate('doctorId', 'fullName email specialty avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
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
    const reviewFilter: Record<string, unknown> = {
      doctorId: new Types.ObjectId(doctorId),
    };
    if (query?.cursor) {
      try {
        const cursor = decodeCursor(query.cursor);
        reviewFilter.$or = [
          { createdAt: { $lt: new Date(cursor.sortValue) } },
          {
            createdAt: new Date(cursor.sortValue),
            _id: { $lt: new Types.ObjectId(cursor.id) },
          },
        ];
      } catch (error) {
        if (error instanceof InvalidCursorError)
          throw new BadRequestException('Invalid review cursor');
        throw error;
      }
    }

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(reviewFilter)
        .select(REVIEW_READ_PROJECTION)
        .populate('patientId', 'fullName avatarUrl')
        .sort({ createdAt: -1, _id: -1 })
        .skip(query?.cursor ? 0 : skip)
        .limit(query?.cursor ? limitNum + 1 : limitNum)
        .lean()
        .exec(),
      this.reviewModel.countDocuments({
        doctorId: new Types.ObjectId(doctorId),
      }),
    ]);
    const hasNextPage = Boolean(query?.cursor && reviews.length > limitNum);
    const data = hasNextPage ? reviews.slice(0, limitNum) : reviews;
    const last = data.at(-1) as
      | { createdAt?: Date; _id?: Types.ObjectId }
      | undefined;

    return {
      statusCode: 200,
      message: 'Doctor reviews retrieved successfully',
      data,
      nextCursor:
        hasNextPage && last?.createdAt && last?._id
          ? encodeCursor({
              sortValue: last.createdAt.toISOString(),
              id: String(last._id),
            })
          : null,
      hasNextPage,
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

  async getDoctorProfileReviewSummary(doctorId: string) {
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }
    const doctorObjectId = new Types.ObjectId(doctorId);
    const [reviews, ratingGroups] = await Promise.all([
      this.reviewModel
        .find({ doctorId: doctorObjectId })
        .select('_id patientId rating comment createdAt')
        .sort({ createdAt: -1, _id: -1 })
        .lean<
          {
            _id: Types.ObjectId;
            patientId: Types.ObjectId;
            rating: number;
            comment: string;
            createdAt?: Date;
          }[]
        >(),
      this.reviewModel.aggregate<{ _id: number; count: number }>([
        { $match: { doctorId: doctorObjectId } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $project: { _id: 1, count: 1 } },
      ]),
    ]);
    const reviewerIds = Array.from(
      new Set(reviews.map((review) => review.patientId.toString())),
    );
    const reviewers = await this.users.findDisplayUsersByIds(reviewerIds);
    const names = new Map(
      reviewers.map((reviewer) => [reviewer._id.toString(), reviewer.fullName]),
    );
    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const group of ratingGroups) {
      if (ratingDistribution[group._id] != null) {
        ratingDistribution[group._id] = group.count;
      }
    }
    return {
      reviews: reviews.map((review) => ({
        id: review._id.toString(),
        reviewer_name: names.get(review.patientId.toString()) ?? 'Unknown user',
        rating: review.rating,
        comment: review.comment,
        created_at: review.createdAt
          ? new Date(review.createdAt).toISOString()
          : new Date().toISOString(),
      })),
      ratingDistribution,
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
      .select(REVIEW_READ_PROJECTION)
      .populate('patientId', 'fullName email avatarUrl')
      .populate('doctorId', 'fullName email specialty avatarUrl')
      .lean()
      .exec();

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return {
      statusCode: 200,
      message: 'Review retrieved successfully',
      data: review,
    };
  }

  async findByConsultationId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    const consultation = await this.consultations.findDocument(id);

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    const review = await this.reviewModel
      .findOne({
        consultationId: new Types.ObjectId(id),
      })
      .select(REVIEW_READ_PROJECTION)
      .populate('patientId', 'fullName email avatarUrl')
      .populate('doctorId', 'fullName email specialty avatarUrl')
      .lean()
      .exec();

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

    if (!review.helpfulBy?.some((value) => value.toString() === userId)) {
      review.helpfulBy = [
        ...(review.helpfulBy ?? []),
        new Types.ObjectId(userId),
      ];
      review.helpfulCount = review.helpfulBy.length;
      await review.save();
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

    review.helpfulBy = (review.helpfulBy ?? []).filter(
      (value) => value.toString() !== userId,
    );
    review.helpfulCount = review.helpfulBy.length;
    await review.save();
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

    review.flagged = true;
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
    const topDoctors = await this.users.findTopDoctors(limit);

    return {
      statusCode: 200,
      message: 'Top doctors retrieved successfully',
      data: topDoctors.map((doctor) => ({
        doctorId: doctor._id,
        doctorName: doctor.fullName,
        specialty: doctor.doctorProfile?.specialty,
        avatarUrl: doctor.avatarUrl,
        averageRating: doctor.doctorProfile?.averageRating ?? 0,
        totalReviews: doctor.doctorProfile?.reviewCount ?? 0,
      })),
    };
  }
}
