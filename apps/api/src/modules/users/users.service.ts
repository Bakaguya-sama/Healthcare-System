import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/entities/user.schema';
import {
  Doctor,
  DoctorDocument,
  DoctorVerificationStatus,
} from './entities/doctor.schema';
import { Patient, PatientDocument } from '../patients/entities/patient.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UserRole } from './enums/user-role.enum';
import { AccountStatus } from './entities/user.entity';
import { Admin, AdminDocument } from '../admins/entities/admin.entity';
import { Review, ReviewDocument } from '../reviews/entities/review.entity';
import { DoctorPrefillData } from './dto/doctor-prefill.dto'; // Import the new DTO
import {
  Violation,
  ViolationStatus,
} from '../violations/entities/violation.entity';

type ProfileReport = {
  id: string;
  reason: string;
  date: string;
  resolved: boolean;
};

type DoctorReview = {
  id: string;
  reviewer_name: string;
  reviewer_avatar_initials?: string;
  rating: number;
  comment: string;
  created_at: string;
};

type DoctorReviewMetrics = {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<number, number>;
};

type UserProfileResponse = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  gender: string;
  account_status: 'active' | 'banned';
  created_at: string;
  address_display: string;
  role: 'admin' | 'patient' | 'doctor';
  avatar_url?: string;
  reports?: ProfileReport[];
  doctor_reviews?: DoctorReview[];
  doctor_review_metrics?: DoctorReviewMetrics;
  role_specific?: {
    specialty?: string;
    workplace?: string;
    experience_years?: number;
    verified_at?: string;
    verification_status?: 'pending' | 'approved' | 'rejected';
    reject_reason?: string;
    admin_role?: 'super_admin' | 'user_admin' | 'ai_admin';
  };
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
    @InjectModel(Patient.name) private patientModel: Model<PatientDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Violation.name) private violationModel: Model<Violation>,
  ) {}

  private formatAddress(address?: {
    street?: string;
    ward?: string;
    district?: string;
    city?: string;
    country?: string;
  }) {
    if (!address) {
      return '-';
    }

    const parts = [
      address.street,
      address.ward,
      address.district,
      address.city,
      address.country,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : '-';
  }

  private normalizeDoctorUserIds(
    doctors: Array<{ userId?: Types.ObjectId | string | null }>,
  ): Types.ObjectId[] {
    const uniqueIds = new Set<string>();

    for (const doctor of doctors) {
      if (!doctor?.userId) {
        continue;
      }

      const idAsString = doctor.userId.toString();
      if (!Types.ObjectId.isValid(idAsString)) {
        continue;
      }

      uniqueIds.add(idAsString);
    }

    return Array.from(uniqueIds, (id) => new Types.ObjectId(id));
  }

  async findAll() {
    const approvedDoctors = await this.doctorModel
      .find({ verificationStatus: DoctorVerificationStatus.APPROVED })
      .select('userId specialty -_id')
      .lean<
        {
          userId?: Types.ObjectId | string | null;
          specialty?: string;
        }[]
      >();

    const approvedDoctorUserIds = this.normalizeDoctorUserIds(approvedDoctors);
    const specialtyByDoctorUserId = new Map<string, string | undefined>(
      approvedDoctors
        .filter((doctor) => doctor.userId)
        .map((doctor) => [doctor.userId!.toString(), doctor.specialty]),
    );

    const users = await this.userModel
      .find({
        $or: [
          { role: { $ne: UserRole.DOCTOR } },
          {
            role: UserRole.DOCTOR,
            _id: { $in: approvedDoctorUserIds },
          },
        ],
      })
      .select('-password -refreshToken');

    return users.map((user) => {
      const userObject = user.toObject();

      if (userObject.role !== UserRole.DOCTOR) {
        return userObject;
      }

      return {
        ...userObject,
        specialty: specialtyByDoctorUserId.get(userObject._id.toString()),
      };
    });
  }

  async findDoctors() {
    const approvedDoctors = await this.doctorModel
      .find({ verificationStatus: DoctorVerificationStatus.APPROVED })
      .select('userId specialty -_id')
      .lean<
        {
          userId?: Types.ObjectId | string | null;
          specialty?: string;
        }[]
      >();

    const approvedDoctorUserIds = this.normalizeDoctorUserIds(approvedDoctors);
    const specialtyByDoctorUserId = new Map<string, string | undefined>(
      approvedDoctors
        .filter((doctor) => doctor.userId)
        .map((doctor) => [doctor.userId!.toString(), doctor.specialty]),
    );

    if (approvedDoctorUserIds.length === 0) {
      return [];
    }

    const doctorUsers = await this.userModel
      .find({
        role: UserRole.DOCTOR,
        accountStatus: AccountStatus.ACTIVE,
        _id: { $in: approvedDoctorUserIds },
      })
      .select('-password -refreshToken');

    return doctorUsers.map((doctorUser) => ({
      ...doctorUser.toObject(),
      specialty: specialtyByDoctorUserId.get(doctorUser._id.toString()),
    }));
  }

  async findDoctorByEmail(email: string): Promise<DoctorPrefillData> {
    const user = await this.userModel.findOne({ email: email });

    if (!user) {
      throw new NotFoundException('User not found with this email.');
    }

    if (user.role !== UserRole.DOCTOR) {
      throw new NotFoundException('User is not a doctor.');
    }

    const doctorProfile = await this.doctorModel.findOne({ userId: user._id });

    if (!doctorProfile) {
      throw new NotFoundException('Doctor profile not found for this user.');
    }

    return {
      email: user.email,
      phoneNumber: user.phoneNumber ?? '', // Ensure phoneNumber is a string
      fullName: user.fullName,
      specialty: doctorProfile.specialty,
      workplace: doctorProfile.workplace,
      experienceYears: doctorProfile.experienceYears,
      verificationDocuments: doctorProfile.verificationDocuments,
      verificationStatus: doctorProfile.verificationStatus,
      rejectReason: doctorProfile.rejectReason,
    };
  }

  async findById(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findProfileById(id: string): Promise<UserProfileResponse> {
    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const createdAtValue =
      'createdAt' in user
        ? (user as unknown as { createdAt?: Date }).createdAt
        : undefined;

    const profile: UserProfileResponse = {
      id: user._id.toString(),
      full_name: user.fullName,
      email: user.email,
      phone_number: user.phoneNumber ?? '',
      gender: user.gender ?? '',
      account_status: user.accountStatus,
      created_at: createdAtValue?.toISOString() ?? new Date().toISOString(),
      address_display: this.formatAddress(user.address),
      role: user.role,
      avatar_url: user.avatarUrl,
    };

    const userObjectId = new Types.ObjectId(user._id.toString());

    const reportedViolations = await this.violationModel
      .find({ reportedUserId: userObjectId })
      .sort({ createdAt: -1 })
      .lean<
        {
          _id: Types.ObjectId;
          reportType: string;
          status: ViolationStatus;
          createdAt?: Date;
        }[]
      >();

    profile.reports = reportedViolations.map((violation) => ({
      id: violation._id.toString(),
      reason: violation.reportType,
      date: violation.createdAt
        ? new Date(violation.createdAt).toISOString()
        : new Date().toISOString(),
      resolved: violation.status === ViolationStatus.RESOLVED,
    }));

    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.doctorModel
        .findOne({ userId: userObjectId })
        .lean<DoctorDocument>();

      if (doctor) {
        profile.role_specific = {
          specialty: doctor.specialty,
          workplace: doctor.workplace,
          experience_years: doctor.experienceYears,
          verified_at: doctor.verifiedAt
            ? new Date(doctor.verifiedAt).toISOString()
            : undefined,
          verification_status: doctor.verificationStatus,
          reject_reason: doctor.rejectReason,
        };
      }

      const doctorReviews = await this.reviewModel
        .find({ doctorId: userObjectId })
        .sort({ createdAt: -1 })
        .lean<
          {
            _id: Types.ObjectId;
            patientId: Types.ObjectId;
            rating: number;
            comment: string;
            createdAt?: Date;
          }[]
        >();

      const reviewerIds = Array.from(
        new Set(doctorReviews.map((review) => review.patientId.toString())),
      ).map((reviewerId) => new Types.ObjectId(reviewerId));

      const reviewers = reviewerIds.length
        ? await this.userModel
            .find({ _id: { $in: reviewerIds } })
            .select('fullName avatarUrl')
            .lean<
              { _id: Types.ObjectId; fullName: string; avatarUrl?: string }[]
            >()
        : [];

      const reviewerNameMap = new Map(
        reviewers.map((reviewer) => [
          reviewer._id.toString(),
          reviewer.fullName,
        ]),
      );

      profile.doctor_reviews = doctorReviews.map((review) => ({
        id: review._id.toString(),
        reviewer_name:
          reviewerNameMap.get(review.patientId.toString()) ?? 'Unknown user',
        rating: review.rating,
        comment: review.comment,
        created_at: review.createdAt
          ? new Date(review.createdAt).toISOString()
          : new Date().toISOString(),
      }));

      const ratingDistribution: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      let totalRating = 0;
      for (const review of doctorReviews) {
        totalRating += review.rating;
        if (ratingDistribution[review.rating] != null) {
          ratingDistribution[review.rating] += 1;
        }
      }

      profile.doctor_review_metrics = {
        average_rating:
          doctorReviews.length > 0
            ? Math.round((totalRating / doctorReviews.length) * 10) / 10
            : 0,
        total_reviews: doctorReviews.length,
        rating_distribution: ratingDistribution,
      };
    }

    if (user.role === UserRole.ADMIN) {
      const admin = await this.adminModel
        .findOne({ userId: userObjectId })
        .lean<AdminDocument>();

      if (admin) {
        profile.role_specific = {
          ...(profile.role_specific ?? {}),
          admin_role: admin.adminRole,
        };
      }
    }

    return profile;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existingUser = await this.userModel.findById(id);
    if (!existingUser) throw new NotFoundException('User not found');

    const {
      specialty,
      workplace,
      verificationDocuments,
      experienceYears,
      averageRating,
      ...userUpdatePayload
    } = dto;
    void averageRating;

    if (existingUser.role === UserRole.DOCTOR) {
      const doctorUpdatePayload: {
        specialty?: string;
        workplace?: string;
        verificationDocuments?: string[];
        experienceYears?: number;
      } = {};

      if (specialty !== undefined) {
        doctorUpdatePayload.specialty = specialty;
      }

      if (workplace !== undefined) {
        doctorUpdatePayload.workplace = workplace;
      }

      if (verificationDocuments !== undefined) {
        doctorUpdatePayload.verificationDocuments = verificationDocuments;
      }

      if (experienceYears !== undefined) {
        doctorUpdatePayload.experienceYears = experienceYears;
      }

      if (Object.keys(doctorUpdatePayload).length > 0) {
        await this.doctorModel.findOneAndUpdate(
          { userId: new Types.ObjectId(id) },
          doctorUpdatePayload,
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
      }
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, userUpdatePayload, { new: true })
      .select('-password -refreshToken');

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async deactivate(id: string) {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { accountStatus: AccountStatus.BANNED },
        { new: true },
      )
      .select('-password -refreshToken');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * 👤 POST /users/profile
   * Bệnh nhân tạo profile
   */
  async createPatientProfile(userId: string, dto: CreatePatientProfileDto) {
    // Kiểm tra user tồn tại và là patient
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.PATIENT) {
      throw new ConflictException('User is not a patient');
    }

    // Kiểm tra patient profile chưa tồn tại
    const existing = await this.patientModel.findOne({ userId });
    if (existing) {
      throw new ConflictException('Patient profile already exists');
    }

    // Tạo patient profile
    const patient = await this.patientModel.create({
      userId: new Types.ObjectId(userId),
      ...dto,
    });

    return patient.toObject({ versionKey: false });
  }

  /**
   * 👤 GET /users/profile
   * Xem patient profile của mình
   */
  async getPatientProfile(userId: string) {
    const patient = await this.patientModel
      .findOne({ userId })
      .populate('userId', 'fullName email phoneNumber avatarUrl');

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return patient.toObject({ versionKey: false });
  }

  /**
   * 👤 PATCH /users/profile
   * Cập nhật patient profile
   */
  async updatePatientProfile(userId: string, dto: CreatePatientProfileDto) {
    const patient = await this.patientModel.findOneAndUpdate({ userId }, dto, {
      new: true,
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return patient.toObject({ versionKey: false });
  }

  /**
   * 👤 DELETE /users/profile
   * Xóa patient profile
   */
  async deletePatientProfile(userId: string): Promise<void> {
    const result = await this.patientModel.deleteOne({ userId });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Patient profile not found');
    }
  }
}
