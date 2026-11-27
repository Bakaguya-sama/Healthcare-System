import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
} from '../../../users/domain/entities/users/user.schema';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../core/domain/user.enums';
import {
  AuthSession,
  AuthSessionDocument,
} from '../../domain/entities/auth-session.schema';
import {
  AuthEvent,
  AuthEventDocument,
  AuthEventType,
} from '../../domain/entities/auth-event.schema';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import { RegisterPatientDto } from '../../presentation/dto/register-patient.dto';
import { RegisterDoctorDto } from '../../presentation/dto/register-doctor.dto';
import { LoginDto } from '../../presentation/dto/login.dto';
import { mayReceiveFullAccess } from '../../domain/policies/account-access.policy';
import { CloudinaryService } from '../../../../infrastructure/files/cloudinary.service';
import { GOOGLE_PATIENT_ACCOUNT_REPOSITORY } from '../ports/google-patient-account.repository.port';
import type {
  GooglePatientAccount,
  GooglePatientAccountRepositoryPort,
} from '../ports/google-patient-account.repository.port';
import { ConfigService } from '@nestjs/config';
import type { GooglePrincipal } from '../ports/oauth-mobile-handoff.port';
import { OtpService } from './otp.service';
import { normalizeGoogleAccountEmail } from '../../domain/policies/google-account-email.policy';

type Meta = { userAgent?: string; networkFingerprint?: string };
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(AuthSession.name)
    private readonly sessions: Model<AuthSessionDocument>,
    @InjectModel(AuthEvent.name)
    private readonly events: Model<AuthEventDocument>,
    @Inject(GOOGLE_PATIENT_ACCOUNT_REPOSITORY)
    private readonly googlePatientAccounts: GooglePatientAccountRepositoryPort,
    private readonly jwt: JwtService,
    private readonly outbox: OutboxService,
    private readonly files: CloudinaryService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
  ) {}

  registerPatient(dto: RegisterPatientDto) {
    return this.registerLocal(dto, UserRole.PATIENT);
  }

  async registerDoctor(
    dto: RegisterDoctorDto,
    uploads: Express.Multer.File[] = [],
  ) {
    const email = dto.email.toLowerCase();
    const existing = await this.users
      .findOne({ email })
      .select('+passwordHash');
    if (existing) return this.reapplyRejectedDoctor(existing, dto, uploads);
    const response = await this.registerLocal(dto, UserRole.DOCTOR, dto);
    if (uploads.length) {
      const created = await this.users.findOne({ email });
      if (created)
        await this.users.updateOne(
          { _id: created._id },
          {
            $set: {
              'doctorProfile.verificationDocuments':
                await this.uploadDoctorDocuments(
                  created._id.toString(),
                  uploads,
                ),
            },
          },
        );
    }
    return response;
  }

  async restoreDoctorReapplication(email: string, password: string) {
    const existing = await this.users
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash');
    if (
      !existing ||
      existing.role !== UserRole.DOCTOR ||
      existing.accountStatus === AccountStatus.BANNED ||
      existing.doctorProfile?.verificationStatus !==
        DoctorVerificationStatus.REJECTED ||
      !existing.passwordHash ||
      !(await bcrypt.compare(password, existing.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid re-application credentials');
    }
    const documents = existing.doctorProfile.verificationDocuments ?? [];
    return {
      fullName: existing.fullName,
      phoneNumber: existing.phoneNumber ?? null,
      specialty: existing.doctorProfile.specialty,
      workplace: existing.doctorProfile.workplace,
      experienceYears: existing.doctorProfile.experienceYears,
      verificationDocuments: documents.map((_, index) => ({
        id: `existing-document-${index + 1}`,
        label: `Verification document ${index + 1}`,
      })),
      verificationDocumentCount: documents.length,
    };
  }

  private async reapplyRejectedDoctor(
    existing: UserDocument,
    dto: RegisterDoctorDto,
    uploads: Express.Multer.File[],
  ) {
    if (
      existing.role !== UserRole.DOCTOR ||
      existing.accountStatus === AccountStatus.BANNED ||
      existing.doctorProfile?.verificationStatus !==
        DoctorVerificationStatus.REJECTED
    )
      throw new ConflictException('Email already in use');
    if (
      !existing.passwordHash ||
      !(await bcrypt.compare(dto.password, existing.passwordHash))
    )
      throw new UnauthorizedException('Invalid re-application credentials');
    const previous = existing.doctorProfile.verificationDocuments ?? [];
    const uploaded = await this.uploadDoctorDocuments(
      existing._id.toString(),
      uploads,
    );
    existing.fullName = dto.fullName;
    if (dto.phoneNumber !== undefined) existing.phoneNumber = dto.phoneNumber;
    const needsEmailVerification =
      existing.accountStatus === AccountStatus.PENDING_VERIFICATION;
    existing.doctorProfile = {
      ...existing.doctorProfile,
      specialty: dto.specialty,
      workplace: dto.workplace,
      experienceYears: dto.experienceYears,
      // Existing documents remain server-owned; client cannot inject or select URLs.
      verificationDocuments: [...previous, ...uploaded],
      verificationStatus: DoctorVerificationStatus.PENDING,
      rejectReason: '',
    };
    await existing.save();
    await this.record(
      AuthEventType.DOCTOR_REAPPLICATION_SUBMITTED,
      existing._id,
      {
        transition: 'doctor_reapplication',
      },
    );
    if (needsEmailVerification) {
      await this.issueOtp(existing, 'email_verification');
      await this.record(AuthEventType.OTP_SENT, existing._id, {
        purpose: 'email_verification',
        transition: 'doctor_reapplication',
      });
    }
    return {
      status: existing.accountStatus,
      message: needsEmailVerification
        ? 'Doctor re-application submitted; verification email queued'
        : 'Doctor re-application submitted for Admin approval',
    };
  }

  private async uploadDoctorDocuments(
    userId: string,
    uploads: Express.Multer.File[],
  ) {
    if (!uploads.length) return [];
    const results = await this.files.uploadMultiple(
      uploads,
      `healthcare/doctors/verification/${userId}`,
      'document',
    );
    return results.map((result) => result.secureUrl);
  }

  private async registerLocal(
    dto: RegisterPatientDto | RegisterDoctorDto,
    role: UserRole.PATIENT | UserRole.DOCTOR,
    doctor?: RegisterDoctorDto,
  ) {
    const email = dto.email.toLowerCase();
    if (await this.users.exists({ email }))
      throw new ConflictException('Email already in use');
    if (
      dto.phoneNumber &&
      (await this.users.exists({ phoneNumber: dto.phoneNumber }))
    )
      throw new ConflictException('Phone number already in use');

    const user = await this.users.create({
      email,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role,
      accountStatus: AccountStatus.PENDING_VERIFICATION,
      ...(role === UserRole.DOCTOR
        ? {
            doctorProfile: {
              specialty: doctor!.specialty,
              workplace: doctor!.workplace,
              experienceYears: doctor!.experienceYears,
              verificationDocuments: [],
              verificationStatus: DoctorVerificationStatus.PENDING,
              averageRating: 0,
              ratingSum: 0,
              reviewCount: 0,
            },
          }
        : {}),
    });
    await this.issueOtp(user, 'email_verification');
    await this.record(AuthEventType.OTP_SENT, user._id, {
      purpose: 'email_verification',
    });
    return {
      status: AccountStatus.PENDING_VERIFICATION,
      message: 'Verification email queued',
    };
  }

  async requestEmailVerification(email: string) {
    const user = await this.users.findOne({ email: email.toLowerCase() });
    const canVerifyPendingAccount =
      user?.accountStatus === AccountStatus.PENDING_VERIFICATION;
    const canVerifyActiveEmail =
      user?.accountStatus === AccountStatus.ACTIVE && !user.emailVerifiedAt;
    if (user && (canVerifyPendingAccount || canVerifyActiveEmail)) {
      await this.issueOtp(user, 'email_verification');
      await this.record(AuthEventType.OTP_SENT, user._id, {
        purpose: 'email_verification',
        transition: canVerifyPendingAccount
          ? 'verification_requested'
          : 'active_email_verification_requested',
      });
    }
    return { message: 'If eligible, a verification email has been queued' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.users
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash');
    if (user?.passwordHash) {
      await this.issueOtp(user, 'password_reset');
      await this.record(AuthEventType.OTP_SENT, user._id, {
        purpose: 'password_reset',
      });
    }
    return {
      message: 'If the account is eligible, a recovery email has been queued',
    };
  }

  async resetPassword(email: string, otpCode: string, newPassword: string) {
    const user = await this.users.findOne({ email: email.toLowerCase() });
    if (!user)
      throw new BadRequestException('Invalid or expired recovery code');
    try {
      await this.otp.consume(user.email!, 'password_reset', otpCode);
    } catch {
      throw new BadRequestException('Invalid or expired recovery code');
    }
    await this.users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await bcrypt.hash(newPassword, 12) } },
    );
    await this.revokeAllSessions(user._id.toString(), 'password_reset');
    await this.record(AuthEventType.PASSWORD_CHANGED, user._id, {
      transition: 'password_reset',
    });
    return { message: 'Password reset successfully' };
  }

  private async issueOtp(
    user: UserDocument,
    purpose: 'email_verification' | 'password_reset',
  ) {
    if (!user.email) return;
    await this.otp.issue(user.email, purpose);
    await this.outbox.enqueue({
      eventType: 'auth.otp-delivery.requested.v1',
      aggregateType: 'User',
      aggregateId: user._id,
      payload: { userId: user._id.toString(), purpose },
      idempotencyKey: `auth.otp-delivery.${purpose}.${user._id.toString()}.${randomUUID()}`,
    });
  }

  async verifyEmail(email: string, otpCode: string) {
    const user = await this.users.findOne({ email: email.toLowerCase() });
    if (!user)
      throw new BadRequestException('Invalid or expired verification code');
    try {
      await this.otp.consume(user.email!, 'email_verification', otpCode);
    } catch {
      throw new BadRequestException('Invalid or expired verification code');
    }
    const canActivate =
      user.accountStatus === AccountStatus.PENDING_VERIFICATION;
    const canVerifyActiveEmail =
      user.accountStatus === AccountStatus.ACTIVE && !user.emailVerifiedAt;
    if (!canActivate && !canVerifyActiveEmail)
      throw new BadRequestException('Invalid or expired verification code');
    const result = await this.users.updateOne(
      {
        _id: user._id,
        accountStatus: user.accountStatus,
        ...(canVerifyActiveEmail ? { emailVerifiedAt: null } : {}),
      },
      {
        $set: {
          ...(canActivate ? { accountStatus: AccountStatus.ACTIVE } : {}),
          emailVerifiedAt: new Date(),
        },
      },
    );
    if (result.matchedCount !== 1)
      throw new BadRequestException('Invalid or expired verification code');
    await this.record(AuthEventType.OTP_VERIFIED, user._id, {
      purpose: 'email_verification',
    });
    return { message: 'Email verified' };
  }

  async login(dto: LoginDto, meta: Meta = {}) {
    const user = await this.users
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash');
    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      if (user) await this.record(AuthEventType.LOGIN_FAILED, user._id);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (
      !mayReceiveFullAccess({
        accountStatus: user.accountStatus,
        role: user.role,
        doctorVerificationStatus: user.doctorProfile?.verificationStatus,
      })
    )
      throw new ForbiddenException(
        user.accountStatus === AccountStatus.PENDING_VERIFICATION
          ? 'Email verification is required'
          : 'Account is not eligible for access',
      );
    const result = await this.issueSession(user, meta);
    await this.record(AuthEventType.LOGIN_SUCCESS, user._id);
    return result;
  }

  /**
   * Completes the only supported Google flow: a Patient OAuth-only account.
   * A Google email is never an account-merge key. A local account and an OAuth
   * account deliberately remain separate login methods.
   */
  async completeGooglePatientAuthentication(
    principal: GooglePrincipal,
    meta: Meta = {},
  ) {
    if (this.config.get<boolean>('GOOGLE_OAUTH_ENABLED') !== true)
      throw new NotFoundException('OAuth provider is unavailable');
    let account = await this.googlePatientAccounts.findByProviderSubject(
      principal.provider,
      principal.providerAccountId,
    );
    if (!account) {
      if (this.config.get<boolean>('GOOGLE_OAUTH_ALLOW_SIGNUP') !== true)
        throw new ForbiddenException(
          'Google sign-in is not available for a new account',
        );
      const normalizedEmail = normalizeGoogleAccountEmail(principal.email);
      if (principal.email?.trim() && !normalizedEmail)
        throw new ConflictException('Google account email is invalid');
      const owner = normalizedEmail
        ? await this.googlePatientAccounts.findEmailOwner(normalizedEmail)
        : null;
      if (owner) this.rejectGoogleEmailCollision(owner);

      const created = await this.googlePatientAccounts.createPatientAccount({
        provider: principal.provider,
        providerAccountId: principal.providerAccountId,
        email: normalizedEmail ?? undefined,
        emailVerified:
          Boolean(normalizedEmail) && principal.emailVerified === true,
        fullName: principal.displayName || 'Google user',
      });
      if (created.kind === 'created' || created.kind === 'existing_subject')
        account = created.account;
      else this.rejectGoogleEmailCollision(created.kind);
    }
    // A legacy identity must not silently preserve Google login for a local,
    // Doctor, or administrative account after the independent-login policy.
    if (account.role !== UserRole.PATIENT || account.hasPassword)
      throw new ForbiddenException(
        'This account uses password sign-in. Please use the password sign-in option.',
      );
    if (!mayReceiveFullAccess(account))
      throw new ForbiddenException('Account is not eligible for access');
    const result = await this.issueSession(account, meta);
    await this.record(AuthEventType.LOGIN_SUCCESS, account.id, {
      provider: 'google',
    });
    return result;
  }

  private rejectGoogleEmailCollision(
    owner:
      | 'password_account'
      | 'google_account'
      | 'other_account'
      | 'dangling_identity'
      | 'conflict',
  ): never {
    if (owner === 'password_account')
      throw new ConflictException({
        code: 'AUTH_GOOGLE_LOCAL_ACCOUNT_EXISTS',
        message:
          'This email already has a password account. Sign in with your email and password instead.',
      });
    if (owner === 'google_account')
      throw new ConflictException({
        code: 'AUTH_GOOGLE_IDENTITY_EXISTS',
        message:
          'This email is already connected to a different Google account. Sign in with that Google account or contact support.',
      });
    throw new ConflictException({
      code: 'AUTH_GOOGLE_ACCOUNT_CONFLICT',
      message:
        'This Google account cannot be used. Sign in with the existing method or contact support.',
    });
  }

  async refreshToken(refreshToken: string, meta: Meta = {}) {
    let p: { sub?: string; jti?: string };
    try {
      p = this.jwt.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      !p.sub ||
      !p.jti ||
      !Types.ObjectId.isValid(p.sub) ||
      !Types.ObjectId.isValid(p.jti)
    )
      throw new UnauthorizedException('Invalid refresh token');
    const userObjectId = new Types.ObjectId(p.sub);
    const sessionObjectId = new Types.ObjectId(p.jti);
    const session = await this.sessions
      .findOne({ _id: sessionObjectId, userId: userObjectId })
      .select('+refreshTokenHash');
    if (
      !session ||
      session.refreshTokenHash !== this.hash(refreshToken) ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      if (session)
        await this.sessions.updateMany(
          { familyId: session.familyId, revokedAt: null },
          { $set: { revokedAt: new Date(), revokeReason: 'refresh_replay' } },
        );
      await this.record(AuthEventType.REFRESH_REUSED, userObjectId);
      throw new UnauthorizedException('Refresh token is invalid');
    }
    const user = await this.users.findById(userObjectId).select('+passwordHash');
    if (
      !user ||
      !mayReceiveFullAccess({
        accountStatus: user.accountStatus,
        role: user.role,
        doctorVerificationStatus: user.doctorProfile?.verificationStatus,
      })
    )
      throw new UnauthorizedException('Access denied');
    const nextSessionId = new Types.ObjectId();
    const rotated = await this.sessions.updateOne(
      { _id: session._id, revokedAt: null },
      {
        $set: {
          revokedAt: new Date(),
          revokeReason: 'rotated',
          replacedBySessionId: nextSessionId,
          lastActiveAt: new Date(),
        },
      },
    );
    if (rotated.modifiedCount !== 1) {
      await this.sessions.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokeReason: 'refresh_replay' } },
      );
      await this.record(AuthEventType.REFRESH_REUSED, userObjectId);
      throw new UnauthorizedException('Refresh token is invalid');
    }
    const result = await this.issueSession(
      user,
      meta,
      session.familyId,
      nextSessionId,
    );
    await this.record(AuthEventType.REFRESH_ROTATED, user._id);
    return result;
  }

  async listSessions(userId: string, currentSessionId?: string) {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.sessions
      .find({
        userId: new Types.ObjectId(userId),
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastActiveAt: -1 })
      .lean();
    return rows.map((s) => ({
      id: s._id.toString(),
      deviceLabel: s.deviceLabel ?? 'Unknown device',
      issuedAt: s.issuedAt,
      lastActiveAt: s.lastActiveAt,
      revokedAt: s.revokedAt ?? null,
      current: s._id.toString() === currentSessionId,
    }));
  }

  async revokeCurrentSession(userId: string, sessionId: string) {
    return this.revokeSession(userId, sessionId, 'logout');
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    reason = 'owner_revoke',
  ) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(sessionId))
      throw new NotFoundException('Session not found');
    const userObjectId = new Types.ObjectId(userId);
    const r = await this.sessions.updateOne(
      {
        _id: new Types.ObjectId(sessionId),
        userId: userObjectId,
        revokedAt: null,
      },
      { $set: { revokedAt: new Date(), revokeReason: reason } },
    );
    if (!r.matchedCount) throw new NotFoundException('Session not found');
    await this.record(AuthEventType.LOGOUT, userObjectId, { reason });
    return { message: 'Session revoked' };
  }

  async revokeAllSessions(userId: string, reason = 'logout_all') {
    if (!Types.ObjectId.isValid(userId))
      return { message: 'All sessions revoked' };
    const userObjectId = new Types.ObjectId(userId);
    await this.sessions.updateMany(
      { userId: userObjectId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: reason } },
    );
    await this.record(AuthEventType.LOGOUT_ALL, userObjectId, { reason });
    return { message: 'All sessions revoked' };
  }

  async getProfile(userId: string) {
    const user = await this.users
      .findById(userId)
      .select('+passwordHash')
      .lean();
    if (!user) throw new UnauthorizedException('User not found');
    const { passwordHash, ...safeUser } = user;
    const hasPassword = Boolean(passwordHash);
    const authProvider: 'local' | 'google' = hasPassword ? 'local' : 'google';
    return {
      ...safeUser,
      hasPassword,
      authProvider,
    };
  }

  private async issueSession(
    user: UserDocument | GooglePatientAccount,
    meta: Meta,
    familyId: string = randomUUID(),
    sessionObjectId: Types.ObjectId = new Types.ObjectId(),
  ) {
    const isMongooseUser = '_id' in user;
    const userId = isMongooseUser ? user._id.toString() : user.id;
    const emailVerified = isMongooseUser
      ? Boolean(user.emailVerifiedAt)
      : user.emailVerified;
    const hasPassword = isMongooseUser
      ? Boolean(user.passwordHash)
      : user.hasPassword;
    const authProvider: 'local' | 'google' = hasPassword ? 'local' : 'google';
    const sid = sessionObjectId.toString(),
      payload = { sub: userId, role: user.role, sid };
    const accessToken = this.jwt.sign(payload, { expiresIn: '30m' });
    const refreshToken = this.jwt.sign(
      { ...payload, jti: sid },
      { expiresIn: '7d' },
    );
    const now = new Date();
    await this.sessions.create({
      _id: sessionObjectId,
      userId: new Types.ObjectId(userId),
      familyId,
      refreshTokenHash: this.hash(refreshToken),
      expiresAt: new Date(now.getTime() + 604800000),
      issuedAt: now,
      lastActiveAt: now,
      userAgent: this.safeUA(meta.userAgent),
      deviceLabel: this.safeUA(meta.userAgent),
      networkFingerprint: meta.networkFingerprint,
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: user.email,
        emailVerified,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        hasPassword,
        authProvider,
      },
    };
  }

  private safeUA(value?: string) {
    return value?.slice(0, 160) || null;
  }

  private hash(v: string) {
    return createHash('sha256').update(v).digest('hex');
  }

  private async record(
    eventType: AuthEventType,
    userId?: string | Types.ObjectId,
    metadata?: Record<string, unknown>,
  ) {
    const normalizedUserId =
      typeof userId === 'string' && Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : (userId ?? null);
    await this.events.create({
      eventType,
      userId: normalizedUserId,
      metadata: metadata ?? null,
    });
  }
}
