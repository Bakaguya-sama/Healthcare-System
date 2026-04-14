import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
  AccountStatus,
} from '../auth/entities/user.schema';
import {
  Doctor,
  DoctorDocument,
  DoctorVerificationStatus,
} from '../users/entities/doctor.schema';
import { UserRole } from '../users/enums/user-role.enum';
import { Session, SessionDocument } from '../sessions/entities/session.entity';
import { VerifyDoctorDto } from './dto/verify-doctor.dto';
import { RejectDoctorDto } from './dto/reject-doctor.dto';
import { LockAccountDto } from './dto/lock-account.dto';
import { QuerySessionAdminDto } from './dto/query-session-admin.dto';
import {
  Admin,
  AdminDocument,
  AdminRole,
} from '../admins/entities/admin.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
  ) {}

  // ============================================
  // DOCTOR VERIFICATION MANAGEMENT
  // ============================================

  /**
   * 👨‍⚕️ GET /admin/doctors/pending
   * Admin xem danh sách bác sĩ chờ duyệt
   */
  async getPendingDoctors() {
    return this.doctorModel
      .find({
        verificationStatus: DoctorVerificationStatus.PENDING,
      })
      .populate('userId', '-password -refreshToken')
      .sort({ createdAt: -1 });
  }

  /**
   * ✅ POST /admin/doctors/:id/verify
   * Admin duyệt tài khoản bác sĩ
   */
  async verifyDoctor(
    doctorUserId: string,
    adminId: string,
    dto: VerifyDoctorDto,
  ) {
    void dto;
    console.log('🔍 VERIFY DOCTOR - Searching by userId:', doctorUserId);

    // Kiểm tra người duyệt là admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can verify doctors');
    }

    // Kiểm tra bác sĩ tồn tại (tìm bằng userId, không phải _id)
    const doctor = await this.doctorModel.findOne({
      userId: new Types.ObjectId(doctorUserId),
    });

    console.log(
      '📋 DOCTOR FOUND:',
      doctor ? `Yes (${doctor._id.toString()})` : 'NO',
    );

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
      throw new BadRequestException('Doctor is not in pending status');
    }

    // Cập nhật trạng thái
    doctor.verificationStatus = DoctorVerificationStatus.APPROVED;
    doctor.verifiedAt = new Date();
    doctor.rejectReason = undefined;

    const updated = await doctor.save();
    console.log('✅ DOCTOR VERIFIED:', updated._id);
    return (await updated.populate('userId')).toObject({ versionKey: false });
  }

  /**
   * ❌ POST /admin/doctors/:id/reject
   * Admin từ chối tài khoản bác sĩ
   */
  async rejectDoctor(
    doctorUserId: string,
    adminId: string,
    dto: RejectDoctorDto,
  ) {
    // Kiểm tra người duyệt là admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can reject doctors');
    }

    // Kiểm tra bác sĩ tồn tại (tìm bằng userId, không phải _id)
    const doctor = await this.doctorModel.findOne({
      userId: new Types.ObjectId(doctorUserId),
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
      throw new BadRequestException('Doctor is not in pending status');
    }

    // Cập nhật trạng thái
    doctor.verificationStatus = DoctorVerificationStatus.REJECTED;
    doctor.verifiedAt = new Date();
    doctor.rejectReason = dto.reason;

    const updated = await doctor.save();
    return (await updated.populate('userId')).toObject({ versionKey: false });
  }

  // ============================================
  // ACCOUNT LOCK/UNLOCK MANAGEMENT
  // ============================================

  /**
   * 🔒 POST /admin/users/:id/lock
   * Admin khóa tài khoản vi phạm
   */
  async lockAccount(userId: string, adminId: string, dto: LockAccountDto) {
    void dto;
    // Kiểm tra người khóa là admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can lock accounts');
    }

    // Kiểm tra user tồn tại
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(adminId),
    });

    if (
      !currentAdmin ||
      !currentAdmin.adminRole ||
      currentAdmin.adminRole === AdminRole.AI_ADMIN
    ) {
      throw new BadRequestException(
        'Only super admins or user admins can ban.',
      );
    }

    if (userId === adminId) {
      throw new BadRequestException('Cannot modify your account.');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new BadRequestException('Account is already banned');
    }

    user.accountStatus = AccountStatus.BANNED;

    const updated = await user.save();
    return updated.toObject({ versionKey: false });
  }

  /**
   * 🔓 POST /admin/users/:id/unlock
   * Admin mở khóa tài khoản
   */
  async unlockAccount(userId: string, adminId: string) {
    // Kiểm tra người mở khóa là admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can unlock accounts');
    }

    // Kiểm tra user tồn tại
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(adminId),
    });

    if (
      !currentAdmin ||
      !currentAdmin.adminRole ||
      currentAdmin.adminRole === AdminRole.AI_ADMIN
    ) {
      throw new BadRequestException(
        'Only super admins or user admins can unlock.',
      );
    }

    if (userId === adminId) {
      throw new BadRequestException('Cannot modify your account.');
    }

    if (user.accountStatus !== AccountStatus.BANNED) {
      throw new BadRequestException('Account is not banned');
    }

    user.accountStatus = AccountStatus.ACTIVE;

    const updated = await user.save();
    return updated.toObject({ versionKey: false });
  }

  // ============================================
  // SESSIONS ADMIN VIEW
  // ============================================

  /**
   * 📊 GET /admin/sessions
   * Admin xem tất cả sessions (filter + pagination)
   */
  async getAllSessions(query: QuerySessionAdminDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    type SessionFilter = {
      doctorId?: Types.ObjectId;
      patientId?: Types.ObjectId;
      status?: string;
    };

    // Build filter
    const filter: SessionFilter = {};
    if (query.doctorId) {
      filter.doctorId = new Types.ObjectId(query.doctorId);
    }
    if (query.patientId) {
      filter.patientId = new Types.ObjectId(query.patientId);
    }
    if (query.status) {
      filter.status = query.status;
    }

    // Build sort
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = {};
    sort[query.sortBy || 'createdAt'] = sortOrder;

    const [data, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .populate('patientId', 'fullName email phoneNumber')
        .populate('doctorId', 'fullName email specialty')
        .sort(sort)
        .limit(limit)
        .skip(skip),
      this.sessionModel.countDocuments(filter),
    ]);

    return {
      data: data.map((s) => s.toObject({ versionKey: false })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 🔍 GET /admin/sessions/:id
   * Admin xem chi tiết 1 session
   */
  async getSessionById(id: string) {
    const session = await this.sessionModel
      .findById(id)
      .populate('patientId', 'fullName email phoneNumber')
      .populate('doctorId', 'fullName email specialty licenseNumber');

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session.toObject({ versionKey: false });
  }

  /**
   * 📈 GET /admin/dashboard/stats
   * Lấy thống kê hệ thống
   */
  async getDashboardStats() {
    const [
      totalUsers,
      totalDoctors,
      pendingDoctors,
      totalSessions,
      bannedAccounts,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.doctorModel.countDocuments(),
      this.doctorModel.countDocuments({
        verificationStatus: DoctorVerificationStatus.PENDING,
      }),
      this.sessionModel.countDocuments(),
      this.userModel.countDocuments({
        accountStatus: AccountStatus.BANNED,
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        doctors: totalDoctors,
        pendingDoctors,
      },
      sessions: {
        total: totalSessions,
      },
      security: {
        bannedAccounts,
      },
    };
  }
}
