import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  DoctorVerificationStatus,
} from '../../core/domain/user.enums';
import { NodemailerService } from '../../infrastructure/email/nodemailer.service';
import {
  ConsultationsService,
  type QueryConsultationDto,
} from '../consultations/public-api';
import { NotificationsGateway } from '../notifications/public-api';
import { UserAdministrationService } from '../users/public-api';
import { LockAccountDto } from './dto/lock-account.dto';
import { QueryDoctorApplicationsDto } from './dto/query-doctor-applications.dto';
import { RejectDoctorDto } from './dto/reject-doctor.dto';
import { VerifyDoctorDto } from './dto/verify-doctor.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly userAccounts: UserAdministrationService,
    private readonly consultations: ConsultationsService,
    private readonly email: NodemailerService,
    private readonly notifications: NotificationsGateway,
  ) {}

  getDoctorApplication(query: QueryDoctorApplicationsDto) {
    return this.userAccounts.listDoctorApplications(query);
  }

  async verifyDoctor(
    doctorUserId: string,
    adminId: string,
    _dto: VerifyDoctorDto,
  ) {
    const doctor = await this.userAccounts.setDoctorVerification(
      doctorUserId,
      adminId,
      DoctorVerificationStatus.APPROVED,
    );
    await this.email.sendApproveEmail(doctor.userId.email);
    return doctor;
  }

  async rejectDoctor(
    doctorUserId: string,
    adminId: string,
    dto: RejectDoctorDto,
  ) {
    const doctor = await this.userAccounts.setDoctorVerification(
      doctorUserId,
      adminId,
      DoctorVerificationStatus.REJECTED,
      dto.reason,
    );
    await this.email.sendRejectEmail(doctor.userId.email, dto.reason);
    return doctor;
  }

  async lockAccount(userId: string, adminId: string, dto: LockAccountDto) {
    const user = await this.userAccounts.setAccountStatus(
      userId,
      adminId,
      AccountStatus.BANNED,
      dto.reason,
    );
    this.notifications.sendToUser(userId, 'account_banned', null);
    await this.email.sendBanEmail(user.email, dto.reason);
    return user.toObject({ versionKey: false });
  }

  async unlockAccount(userId: string, adminId: string) {
    const user = await this.userAccounts.setAccountStatus(
      userId,
      adminId,
      AccountStatus.ACTIVE,
    );
    await this.email.sendUnbanEmail(user.email);
    return user.toObject({ versionKey: false });
  }

  getAllConsultations(query: QueryConsultationDto) {
    return this.consultations.findAllForAdmin(query);
  }

  getConsultationById(id: string) {
    return this.consultations.findOneForAdmin(id);
  }

  async getDashboardStats() {
    const [accounts, totalConsultations] = await Promise.all([
      this.userAccounts.getAccountStats(),
      this.consultations.countAll(),
    ]);
    return {
      users: {
        total: accounts.totalUsers,
        doctors: accounts.totalDoctors,
        pendingDoctors: accounts.pendingDoctors,
      },
      consultations: { total: totalConsultations },
      security: { bannedAccounts: accounts.bannedAccounts },
    };
  }
}
