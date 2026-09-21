import { Injectable } from '@nestjs/common';
import { ReviewsService } from '../consultations/reviews/reviews.service';
import { ViolationsService } from '../moderation/violations/violations.service';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class UserProfileQueryService {
  constructor(
    private readonly users: UsersService,
    private readonly reviews: ReviewsService,
    private readonly violations: ViolationsService,
  ) {}

  async findById(userId: string) {
    const profile = await this.users.findProfileBaseById(userId);
    profile.reports = await this.violations.getProfileReports(userId);

    if (profile.role === UserRole.DOCTOR) {
      const reviewSummary =
        await this.reviews.getDoctorProfileReviewSummary(userId);
      profile.doctor_reviews = reviewSummary.reviews;
      if (profile.doctor_review_metrics) {
        profile.doctor_review_metrics.rating_distribution =
          reviewSummary.ratingDistribution;
      }
    }

    return profile;
  }
}
