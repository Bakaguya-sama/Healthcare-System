import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserEntity, UserDocument, DoctorVerificationStatus, AccountStatus, LockRecord } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import {
  ViolationReport,
  ViolationReportDocument,
  ViolationType,
  ViolationStatus,
} from './entities/violation-report.entity';
import { Session, SessionDocument } from '../sessions/entities/session.entity';
import { VerifyDoctorDto } from './dto/verify-doctor.dto';
import { RejectDoctorDto } from './dto/reject-doctor.dto';
import { LockAccountDto } from './dto/lock-account.dto';
import {
  CreateViolationDto,
  QueryViolationDto,
  AddViolationNoteDto,
  ResolveViolationDto,
} from './dto/violation.dto';
import { QuerySessionAdminDto } from './dto/query-session-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(UserEntity.name) private userModel: Model<UserDocument>,
    @InjectModel(ViolationReport.name)
    private violationReportModel: Model<ViolationReportDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  // ============================================
  // DOCTOR VERIFICATION MANAGEMENT
  // ============================================

  /**
   * 👨‍⚕️ GET /admin/doctors/pending
   * Admin xem danh sách bác sĩ chờ duyệt
   */
  async getPendingDoctors() {
    return this.userModel
      .find({
        role: UserRole.DOCTOR,
        doctorVerificationStatus: DoctorVerificationStatus.PENDING,
      })
      .select('-password -refreshToken')
      .sort({ createdAt: -1 });
  }

  /**
   * ✅ POST /admin/doctors/:id/verify
   * Admin duyệt tài khoản bác sĩ
   */
  async verifyDoctor(
    doctorId: string,
    adminId: string,
    dto: VerifyDoctorDto,
  ) {
    // Kiểm tra người duyệt là admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can verify doctors');
    }

    // Kiểm tra bác sĩ tồn tại
    const doctor = await this.userModel.findById(doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.doctorVerificationStatus !== DoctorVerificationStatus.PENDING) {
      throw new BadRequestException('Doctor is not in pending status');
    }

    // Cập nhật trạng thái
    doctor.doctorVerificationStatus = DoctorVerificationStatus.APPROVED;
    doctor.verifiedBy = new Types.ObjectId(adminId);
    doctor.verifiedAt = new Date();
    doctor.verificationNotes = dto.verificationNotes;

    const updated = await doctor.save();
    return updated.toObject({ versionKey: false });
  }

  /**
   * ❌ POST /admin/doctors/:id/reject
   * Admin từ chối tài khoản bác sĩ
   */
  async rejectDoctor(
    doctorId: string,
    adminId: string,
    dto: RejectDoctorDto,
  ) {
    // Kiểm tra người duyệt là admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can reject doctors');
    }

    // Kiểm tra bác sĩ tồn tại
    const doctor = await this.userModel.findById(doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.doctorVerificationStatus !== DoctorVerificationStatus.PENDING) {
      throw new BadRequestException('Doctor is not in pending status');
    }

    // Cập nhật trạng thái
    doctor.doctorVerificationStatus = DoctorVerificationStatus.REJECTED;
    doctor.verifiedBy = new Types.ObjectId(adminId);
    doctor.verifiedAt = new Date();
    doctor.verificationNotes = dto.reason;

    const updated = await doctor.save();
    return updated.toObject({ versionKey: false });
  }

  // ============================================
  // ACCOUNT LOCK/UNLOCK MANAGEMENT
  // ============================================

  /**
   * 🔒 POST /admin/users/:id/lock
   * Admin khóa tài khoản vi phạm
   */
  async lockAccount(userId: string, adminId: string, dto: LockAccountDto) {
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

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new BadRequestException('Account is already banned');
    }

    // Thêm vào lock history
    const lockRecord: LockRecord = {
      lockedAt: new Date(),
      lockedBy: new Types.ObjectId(adminId),
      reason: dto.reason,
    };

    user.lockHistory.push(lockRecord);
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

    if (user.accountStatus !== AccountStatus.BANNED) {
      throw new BadRequestException('Account is not banned');
    }

    // Cập nhật lock history - lần khóa gần nhất
    if (user.lockHistory.length > 0) {
      user.lockHistory[user.lockHistory.length - 1].unlockedAt = new Date();
      user.lockHistory[user.lockHistory.length - 1].unlockedBy = new Types.ObjectId(adminId);
    }

    user.accountStatus = AccountStatus.ACTIVE;

    const updated = await user.save();
    return updated.toObject({ versionKey: false });
  }

  /**
   * 📋 GET /admin/users/:id/lock-history
   * Xem lịch sử khóa tài khoản
   */
  async getLockHistory(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user._id,
      name: user.name,
      accountStatus: user.accountStatus,
      lockHistory: user.lockHistory,
    };
  }

  // ============================================
  // VIOLATION MANAGEMENT
  // ============================================

  /**
   * 📝 POST /admin/violations
   * Admin/Hệ thống tạo báo cáo vi phạm
   */
  async createViolation(
    dto: CreateViolationDto,
    reporterId?: string,
  ) {
    // Kiểm tra người bị báo cáo tồn tại
    const reportedUser = await this.userModel.findById(dto.reportedUserId);
    if (!reportedUser) {
      throw new NotFoundException('Reported user not found');
    }

    // Tạo violation report mới
    const violation = new this.violationReportModel({
      reporterId: reporterId ? new Types.ObjectId(reporterId) : undefined,
      reportedUserId: new Types.ObjectId(dto.reportedUserId),
      type: dto.type,
      reason: dto.reason,
      evidence: dto.evidence,
      notes: [],
    });

    return (await violation.save()).toObject({ versionKey: false });
  }

  /**
   * 📊 GET /admin/violations
   * Xem danh sách violations (filter + pagination)
   */
  async getViolations(query: QueryViolationDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.type) {
      filter.type = query.type;
    }

    // Build sort
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: any = {};
    sort[query.sortBy || 'createdAt'] = sortOrder;

    const [data, total] = await Promise.all([
      this.violationReportModel
        .find(filter)
        .populate('reporterId', 'name email')
        .populate('reportedUserId', 'name email role')
        .populate('resolvedBy', 'name email')
        .populate('notes.addedBy', 'name email')
        .sort(sort)
        .limit(limit)
        .skip(skip),
      this.violationReportModel.countDocuments(filter),
    ]);

    return {
      data: data.map((v) => v.toObject({ versionKey: false })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 🔍 GET /admin/violations/:id
   * Xem chi tiết vi phạm
   */
  async getViolationById(id: string) {
    const violation = await this.violationReportModel
      .findById(id)
      .populate('reporterId', 'name email')
      .populate('reportedUserId', 'name email role phone')
      .populate('resolvedBy', 'name email')
      .populate('notes.addedBy', 'name email');

    if (!violation) {
      throw new NotFoundException('Violation report not found');
    }

    return violation.toObject({ versionKey: false });
  }

  /**
   * 📝 POST /admin/violations/:id/note
   * Admin thêm ghi chú cho vi phạm
   */
  async addViolationNote(
    violationId: string,
    adminId: string,
    dto: AddViolationNoteDto,
  ) {
    // Kiểm tra admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can add notes');
    }

    // Kiểm tra violation tồn tại
    const violation = await this.violationReportModel.findById(violationId);
    if (!violation) {
      throw new NotFoundException('Violation report not found');
    }

    // Thêm ghi chú
    violation.notes.push({
      note: dto.note,
      addedBy: new Types.ObjectId(adminId),
      addedAt: new Date(),
    });

    const updated = await violation.save();
    return updated.toObject({ versionKey: false });
  }

  /**
   * ✅ PATCH /admin/violations/:id/resolve
   * Admin xác nhận xử lý violation
   */
  async resolveViolation(
    violationId: string,
    adminId: string,
    dto: ResolveViolationDto,
  ) {
    // Kiểm tra admin
    const admin = await this.userModel.findById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can resolve violations');
    }

    // Kiểm tra violation tồn tại
    const violation = await this.violationReportModel.findById(violationId);
    if (!violation) {
      throw new NotFoundException('Violation report not found');
    }

    if (violation.status !== ViolationStatus.PENDING) {
      throw new BadRequestException('Violation is not in pending status');
    }

    // Cập nhật violation
    violation.status = ViolationStatus.RESOLVED;
    violation.resolution = dto.resolution;
    violation.resolvedAt = new Date();
    violation.resolvedBy = new Types.ObjectId(adminId);

    const updated = await violation.save();
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

    // Build filter
    const filter: any = {};
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
    const sort: any = {};
    sort[query.sortBy || 'createdAt'] = sortOrder;

    const [data, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .populate('patientId', 'name email phone')
        .populate('doctorId', 'name email specialization')
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
      .populate('patientId', 'name email phone dateOfBirth')
      .populate('doctorId', 'name email specialization licenseNumber');

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
      pendingViolations,
      bannedAccounts,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ role: UserRole.DOCTOR }),
      this.userModel.countDocuments({
        role: UserRole.DOCTOR,
        doctorVerificationStatus: DoctorVerificationStatus.PENDING,
      }),
      this.sessionModel.countDocuments(),
      this.violationReportModel.countDocuments({
        status: ViolationStatus.PENDING,
      }),
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
      violations: {
        pending: pendingViolations,
      },
      security: {
        bannedAccounts,
      },
    };
  }
}
