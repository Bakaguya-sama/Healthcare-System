import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './entities/user.schema';
import { Doctor, DoctorDocument } from './entities/doctor.schema';
import { Patient, PatientDocument } from '../patients/entities/patient.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import {
  UserRole,
  DoctorVerificationStatus,
  AccountStatus,
} from '../../core/domain/user.enums';
import { Admin, AdminDocument } from '../admins/entities/admin.entity';
import { Review, ReviewDocument } from '../reviews/entities/review.entity';
import { DoctorPrefillData } from './dto/doctor-prefill.dto'; // Import the new DTO
import {
  Violation,
  ViolationStatus,
} from '../violations/entities/violation.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersCacheService } from './users-cache.service';
import { QueryUsersDto } from './dto/query-users.dto';

const USER_PUBLIC_READ_PROJECTION =
  '_id fullName email gender dateOfBirth role phoneNumber avatarUrl accountStatus isOnline address banReason createdAt updatedAt';
// Legacy array endpoints remain bounded until their canonical paginated adapters are introduced.
const DIRECTORY_RESULT_HARD_CAP = 100;

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
  date_of_birth: string;
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
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
    @InjectModel(Patient.name) private patientModel: Model<PatientDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Violation.name) private violationModel: Model<Violation>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersCache: UsersCacheService,
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

  async findAll() {
    const users = await this.userModel
      .find({
        $or: [
          { role: { $ne: UserRole.DOCTOR } },
          {
            role: UserRole.DOCTOR,
            accountStatus: AccountStatus.ACTIVE,
            'doctorProfile.verificationStatus': DoctorVerificationStatus.APPROVED,
          },
        ],
      })
      .select(`${USER_PUBLIC_READ_PROJECTION} doctorProfile.specialty`)
      .sort({ _id: 1 })
      .limit(DIRECTORY_RESULT_HARD_CAP)
      .lean();
    return users.map((user) =>
      user.role === UserRole.DOCTOR
        ? { ...user, specialty: user.doctorProfile?.specialty }
        : user,
    );
  }

  async findAllPaged(query: QueryUsersDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.accountStatus) filter.accountStatus = query.accountStatus;
    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [{ fullName: pattern }, { email: pattern }, { phoneNumber: pattern }];
    }
    const sort = query.sortOrder === 1 ? { _id: 1 as const } : { _id: -1 as const };
    const [items, total] = await Promise.all([
      this.userModel.find(filter).select(USER_PUBLIC_READ_PROJECTION).sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.userModel.countDocuments(filter),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async findDoctors() {
    return this.usersCache.getDoctorDirectory(() =>
      this.loadDoctorDirectory(),
    );
  }

  private async loadDoctorDirectory() {
    return this.userModel
      .find({
        role: UserRole.DOCTOR,
        accountStatus: AccountStatus.ACTIVE,
        'doctorProfile.verificationStatus': DoctorVerificationStatus.APPROVED,
      })
      .select(`${USER_PUBLIC_READ_PROJECTION} doctorProfile`)
      .sort({ _id: 1 })
      .limit(DIRECTORY_RESULT_HARD_CAP)
      .lean();
  }

  async findDoctorByEmail(email: string): Promise<DoctorPrefillData> {
    const user = await this.userModel
      .findOne({ email: email })
      .select('_id fullName email phoneNumber role doctorProfile')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found with this email.');
    }

    if (user.role !== UserRole.DOCTOR) {
      throw new NotFoundException('User is not a doctor.');
    }

    const doctorProfile = user.doctorProfile ?? await this.doctorModel
      .findOne({ userId: user._id })
      .select('specialty workplace experienceYears verificationDocuments verificationStatus rejectReason')
      .lean();

    if (!doctorProfile) {
      throw new NotFoundException('Doctor profile not found for this user.');
    }

    return {
      email: user.email,
      phoneNumber: user.phoneNumber ?? '',
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
      .select(`${USER_PUBLIC_READ_PROJECTION} doctorProfile`)
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.DOCTOR) {
      if (user.doctorProfile) return user;
      const doctorProfile = await this.doctorModel
        .findOne({ userId: new Types.ObjectId(id) })
        .select('-_id -userId -__v')
        .lean<DoctorDocument>();

      if (doctorProfile) {
        return { ...user, ...doctorProfile };
      }
    }

    if (user.role === UserRole.ADMIN) {
      const adminProfile = await this.adminModel
        .findOne({ userId: new Types.ObjectId(id) })
        .select('-_id -userId -__v')
        .lean<AdminDocument>();

      if (adminProfile) {
        return { ...user, ...adminProfile };
      }
    }
    return user;
  }

  async findProfileById(id: string): Promise<UserProfileResponse> {
    const user = await this.userModel
      .findById(id)
      .select(`${USER_PUBLIC_READ_PROJECTION} doctorProfile`)
      .lean();

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
      date_of_birth: user.dateOfBirth?.toISOString() || '',
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
      .select('_id reportType status createdAt')
      .sort({ createdAt: -1, _id: -1 })
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
      const [doctor, doctorReviews, ratingGroups] = await Promise.all([
        Promise.resolve(user.doctorProfile ?? null),
        this.reviewModel
          .find({ doctorId: userObjectId })
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
          { $match: { doctorId: userObjectId } },
          { $group: { _id: '$rating', count: { $sum: 1 } } },
          { $project: { _id: 1, count: 1 } },
        ]),
      ]);

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

      for (const group of ratingGroups) {
        if (ratingDistribution[group._id] != null) {
          ratingDistribution[group._id] = group.count;
        }
      }

      profile.doctor_review_metrics = {
        average_rating: doctor?.averageRating ?? 0,
        total_reviews: doctor?.reviewCount ?? 0,
        rating_distribution: ratingDistribution,
      };
    }

    if (user.role === UserRole.ADMIN) {
      const admin = await this.adminModel
        .findOne({ userId: userObjectId })
        .select('_id userId adminRole createdAt updatedAt')
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

  async update(
    id: string,
    dto: UpdateUserDto,
    newFilesToUpload?: Express.Multer.File[],
  ) {
    const existingUser = await this.userModel.findById(id);
    if (!existingUser) throw new NotFoundException('User not found');

    const {
      specialty,
      workplace,
      existingVerificationDocuments,
      experienceYears,
      averageRating,
      ...userUpdatePayload
    } = dto;
    const canonicalUserUpdate: Record<string, unknown> = { ...userUpdatePayload };
    void averageRating;

    if (String(existingUser.role) === UserRole.DOCTOR) {
      const doctorProfile = existingUser.doctorProfile;
      if (!doctorProfile) {
        throw new ConflictException(
          'Doctor profile not found for existing user.',
        );
      }

      const doctorUpdatePayload = { ...doctorProfile };

      if (specialty !== undefined) {
        doctorUpdatePayload.specialty = specialty;
      }

      if (workplace !== undefined) {
        doctorUpdatePayload.workplace = workplace;
      }

      if (experienceYears !== undefined) {
        doctorUpdatePayload.experienceYears = experienceYears;
      }

      // Verification documents
      const allOldUrls = doctorProfile.verificationDocuments || [];
      const keptUrls = new Set(existingVerificationDocuments || []);
      const urlsToDelete = allOldUrls.filter((url) => !keptUrls.has(url));

      if (urlsToDelete.length > 0) {
        try {
          const publicIdsToDelete = urlsToDelete.map((url) => {
            const decodedUrl = decodeURIComponent(url);
            const urlParts = decodedUrl.split('/');
            const pathWithExtension = urlParts
              .slice(urlParts.indexOf('upload') + 2)
              .join('/');
            return pathWithExtension;
          });
          for (const path of publicIdsToDelete) {
            await this.cloudinaryService.deleteFile(path, 'document');
          }
        } catch (error) {
          this.logger.warn(
            `Failed to delete old verification documents for user ${id}. Proceeding with registration.`,
            error.stack,
          );
        }
      }

      let finalDocumentUrls: string[] = existingVerificationDocuments || [];
      if (newFilesToUpload && newFilesToUpload.length > 0) {
        const folder = `healthcare/doctors/verification/${id}`;
        const uploadResults = await this.cloudinaryService.uploadMultiple(
          newFilesToUpload,
          folder,
          'document',
        );
        const newlyUploadedUrls = uploadResults.map(
          (result) => result.secureUrl,
        );
        finalDocumentUrls = [...finalDocumentUrls, ...newlyUploadedUrls];
      }

      doctorUpdatePayload.verificationDocuments = finalDocumentUrls;

      canonicalUserUpdate.doctorProfile = doctorUpdatePayload;
      await this.usersCache.invalidateDoctorDirectory();
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, canonicalUserUpdate, { new: true })
      .select('-passwordHash');

    if (!user) throw new NotFoundException('User not found');

    if (existingUser.role === UserRole.DOCTOR) {
      await this.usersCache.invalidateDoctorDirectory();
    }

    return user;
  }

  async deactivate(id: string) {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { accountStatus: AccountStatus.BANNED },
        { new: true },
      )
      .select('-passwordHash');
    if (!user) throw new NotFoundException('User not found');
    if (String(user.role) === UserRole.DOCTOR) {
      await this.usersCache.invalidateDoctorDirectory();
    }
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
