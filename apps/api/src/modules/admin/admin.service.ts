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
import { QueryDoctorApplicationsDto } from './dto/query-doctor-applications.dto';
import {
  Admin,
  AdminDocument,
  AdminRole,
} from '../admins/entities/admin.entity';
import { NodemailerService } from '../nodemailer/nodemailer.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    private nodemailerService: NodemailerService,
  ) {}

  // ============================================
  // DOCTOR VERIFICATION MANAGEMENT
  // ============================================

  /**
   * 👨‍⚕️ GET /admin/doctors/applications
   * Admin xem danh sách đơn duyệt bác sĩ (pending/approved/rejected)
   */
  async getDoctorApplication(query: QueryDoctorApplicationsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const status = query.status;
    const search = query.search?.trim();

    const filter: {
      verificationStatus?: DoctorVerificationStatus;
      userId?: { $in: Types.ObjectId[] };
    } = {};

    if (status) {
      filter.verificationStatus = status;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      const matchedUsers = await this.userModel
        .find({
          $or: [{ fullName: regex }, { email: regex }],
        })
        .select('_id');

      const userIds = matchedUsers.map((user) => user._id);
      if (userIds.length === 0) {
        return {
          data: [],
          pagination: {
            total: 0,
            page,
            limit,
            pages: 0,
          },
          summary: {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
          },
        };
      }

      filter.userId = { $in: userIds };
    }

    const [data, total, pending, approved, rejected] = await Promise.all([
      this.doctorModel
        .find(filter)
        .populate('userId', '-password -refreshToken')
        .sort({ createdAt: sortOrder })
        .limit(limit)
        .skip(skip),
      this.doctorModel.countDocuments(filter),
      this.doctorModel.countDocuments({
        ...(filter.userId ? { userId: filter.userId } : {}),
        verificationStatus: DoctorVerificationStatus.PENDING,
      }),
      this.doctorModel.countDocuments({
        ...(filter.userId ? { userId: filter.userId } : {}),
        verificationStatus: DoctorVerificationStatus.APPROVED,
      }),
      this.doctorModel.countDocuments({
        ...(filter.userId ? { userId: filter.userId } : {}),
        verificationStatus: DoctorVerificationStatus.REJECTED,
      }),
    ]);

    return {
      data,
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

    if (doctor.verificationStatus === DoctorVerificationStatus.APPROVED) {
      throw new BadRequestException('Doctor is already approved!');
    }

    // Cập nhật trạng thái
    doctor.verificationStatus = DoctorVerificationStatus.APPROVED;
    doctor.verifiedAt = new Date();
    doctor.rejectReason = undefined;

    const updated = await doctor.save();

    // Lấy thông tin user của bác sĩ để gửi email
    const doctorUserDetails = await this.userModel.findById(doctorUserId);
    if (!doctorUserDetails) {
      throw new NotFoundException('User account for this doctor not found.');
    }

    await this.nodemailerService.sendApproveEmail(doctorUserDetails.email);
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

    if (doctor.verificationStatus === DoctorVerificationStatus.REJECTED) {
      throw new BadRequestException('Doctor is already rejected!');
    }

    // Cập nhật trạng thái
    doctor.verificationStatus = DoctorVerificationStatus.REJECTED;
    doctor.verifiedAt = new Date();
    doctor.rejectReason = dto.reason;

    const updated = await doctor.save();

    const doctorUserDetails = await this.userModel.findById(doctorUserId);
    if (!doctorUserDetails) {
      throw new NotFoundException('User account for this doctor not found.');
    }

    await this.nodemailerService.sendRejectEmail(
      doctorUserDetails.email,
      dto.reason,
    );

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
    user.banReason = dto.reason;

    const updated = await user.save();

    await this.nodemailerService.sendBanEmail(user.email, dto.reason);

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
    user.banReason = '';

    const updated = await user.save();

    await this.nodemailerService.sendUnbanEmail(user.email);
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
