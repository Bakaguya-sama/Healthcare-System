import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AccountStatus,
  AdminRole,
  DoctorVerificationStatus,
  UserRole,
} from '../../core/domain/user.enums';
import { toLiteralCaseInsensitiveRegex } from '../../common/query/search-pattern';
import type { DoctorApplicationQuery } from './application/doctor-application.query';
import { User, UserDocument } from './entities/user.schema';
import { UsersCacheService } from './users-cache.service';

const ADMIN_USER_PROJECTION =
  '_id fullName email gender dateOfBirth phoneNumber avatarUrl address role accountStatus doctorProfile adminProfile banReason createdAt updatedAt';

@Injectable()
export class UserAdministrationService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly cache: UsersCacheService,
  ) {}

  private async requireAdmin(adminId: string) {
    const admin = await this.users
      .findById(adminId)
      .select('_id role adminProfile')
      .exec();
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can perform this action');
    }
    return admin;
  }

  async listDoctorApplications(query: DoctorApplicationQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const filter: Record<string, unknown> = {
      role: UserRole.DOCTOR,
      doctorProfile: { $exists: true },
    };
    if (query.status) {
      filter['doctorProfile.verificationStatus'] = query.status;
    }
    if (query.search?.trim()) {
      const regex = toLiteralCaseInsensitiveRegex(query.search.trim());
      filter.$or = [{ fullName: regex }, { email: regex }];
    }

    const summaryFilter: Record<string, any> = {
      role: UserRole.DOCTOR,
      ...(filter.$or ? { $or: filter.$or } : {}),
    };
    const [users, total, pending, approved, rejected] = await Promise.all([
      this.users
        .find(filter)
        .select(ADMIN_USER_PROJECTION)
        .sort({ createdAt: sortOrder, _id: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.users.countDocuments(filter),
      this.users.countDocuments({
        ...summaryFilter,
        'doctorProfile.verificationStatus': DoctorVerificationStatus.PENDING,
      }),
      this.users.countDocuments({
        ...summaryFilter,
        'doctorProfile.verificationStatus': DoctorVerificationStatus.APPROVED,
      }),
      this.users.countDocuments({
        ...summaryFilter,
        'doctorProfile.verificationStatus': DoctorVerificationStatus.REJECTED,
      }),
    ]);

    return {
      data: users.map((user) => ({
        ...user.doctorProfile,
        userId: user,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      summary: {
        total: pending + approved + rejected,
        pending,
        approved,
        rejected,
      },
    };
  }

  async setDoctorVerification(
    doctorUserId: string,
    adminId: string,
    status: DoctorVerificationStatus,
    rejectReason?: string,
  ) {
    await this.requireAdmin(adminId);
    if (!Types.ObjectId.isValid(doctorUserId)) {
      throw new NotFoundException('Doctor not found');
    }
    const doctor = await this.users.findOne({
      _id: new Types.ObjectId(doctorUserId),
      role: UserRole.DOCTOR,
      doctorProfile: { $exists: true },
    });
    if (!doctor?.doctorProfile) {
      throw new NotFoundException('Doctor not found');
    }
    if (doctor.doctorProfile.verificationStatus === status) {
      throw new BadRequestException(
        status === DoctorVerificationStatus.APPROVED
          ? 'Doctor is already approved!'
          : 'Doctor is already rejected!',
      );
    }
    doctor.doctorProfile.verificationStatus = status;
    doctor.doctorProfile.verifiedAt = new Date();
    doctor.doctorProfile.rejectReason = rejectReason ?? '';
    await doctor.save();
    await this.cache.invalidateDoctorDirectory();
    const profile =
      (
        doctor.doctorProfile as unknown as {
          toObject?: () => Record<string, unknown>;
        }
      ).toObject?.() ?? doctor.doctorProfile;
    return {
      ...profile,
      userId: doctor.toObject({ versionKey: false }),
    };
  }

  async setAccountStatus(
    userId: string,
    adminId: string,
    status: AccountStatus,
    reason = '',
  ) {
    const admin = await this.requireAdmin(adminId);
    if (
      !admin.adminProfile?.adminRole ||
      admin.adminProfile.adminRole === AdminRole.AI_MANAGER
    ) {
      throw new BadRequestException(
        'Only super admins or user managers can update account status.',
      );
    }
    if (userId === adminId) {
      throw new BadRequestException('Cannot modify your account.');
    }
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.accountStatus === status) {
      throw new BadRequestException(
        status === AccountStatus.BANNED
          ? 'Account is already banned'
          : 'Account is not banned',
      );
    }
    user.accountStatus = status;
    user.banReason = status === AccountStatus.BANNED ? reason : '';
    await user.save();
    if (user.role === UserRole.DOCTOR) {
      await this.cache.invalidateDoctorDirectory();
    }
    return user;
  }

  async getAccountStats() {
    const [totalUsers, totalDoctors, pendingDoctors, bannedAccounts] =
      await Promise.all([
        this.users.countDocuments(),
        this.users.countDocuments({ role: UserRole.DOCTOR }),
        this.users.countDocuments({
          role: UserRole.DOCTOR,
          'doctorProfile.verificationStatus': DoctorVerificationStatus.PENDING,
        }),
        this.users.countDocuments({ accountStatus: AccountStatus.BANNED }),
      ]);
    return { totalUsers, totalDoctors, pendingDoctors, bannedAccounts };
  }
}
