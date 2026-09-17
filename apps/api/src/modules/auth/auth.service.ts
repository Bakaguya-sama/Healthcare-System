/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-enum-comparison, @typescript-eslint/restrict-template-expressions */
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'node:crypto';
import { User, UserDocument } from '../users/entities/user.schema';
import { AuthSession, AuthSessionDocument } from './entities/auth-session.schema';
import { AuthEvent, AuthEventDocument, AuthEventType } from './entities/auth-event.schema';
import { OtpService } from './otp.service';
import {
  Doctor,
  DoctorDocument,
  DoctorVerificationStatus,
} from '../users/entities/doctor.schema';
import { Admin, AdminDocument } from '../admins/entities/admin.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmOtpDto } from './dto/confirm-otp.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { NodemailerService } from '../nodemailer/nodemailer.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    private jwtService: JwtService,
    private nodemailerService: NodemailerService,
    private cloudinaryService: CloudinaryService,
    @Optional() @InjectModel(AuthSession.name) private authSessionModel?: Model<AuthSessionDocument>,
    @Optional() @InjectModel(AuthEvent.name) private authEventModel?: Model<AuthEventDocument>,
    @Optional() private otpService?: OtpService,
  ) { }

  /**
   * 📝 ĐĂNG KÝ TÀI KHOẢN MỚI
   */
  async register(
    // Update parameter name for clarity
    dto: RegisterDto,
    newFilesToUpload?: Express.Multer.File[], // Renamed parameter
  ) {
    const existingUser = await this.userModel.findOne({ email: dto.email });

    // Case 1: User exists (handle doctor re-application)
    if (existingUser) {
      if (existingUser.role !== UserRole.DOCTOR) {
        throw new ConflictException(
          'Email already in use by a non-doctor account.',
        );
      }

      const doctorProfile = await this.doctorModel.findOne({
        userId: existingUser._id,
      });
      if (!doctorProfile) {
        throw new ConflictException(
          'Doctor profile not found for existing user.',
        );
      }

      if (
        doctorProfile.verificationStatus !== DoctorVerificationStatus.REJECTED
      ) {
        throw new ConflictException(
          `Cannot re-register. Doctor status is: ${doctorProfile.verificationStatus}`,
        );
      }

      // --- Logic for re-applying rejected doctor ---

      // Delete old verification files from Cloudinary before uploading new ones

      this.logger.log(dto);

      const allOldUrls = doctorProfile.verificationDocuments || [];
      const keptUrls = new Set(dto.existingVerificationDocuments || []);
      const urlsToDelete = allOldUrls.filter((url) => !keptUrls.has(url));

      if (urlsToDelete.length > 0) {
        try {
          const publicIdsToDelete = urlsToDelete.map((url) => {
            // Decode the URL first to handle %20 for spaces
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
            `Failed to delete old verification documents for user ${existingUser._id}. Proceeding with registration.`,
            error.stack,
          );
        }
      }

      const hashedPassword = await bcrypt.hash(dto.password, 12);
      existingUser.passwordHash = hashedPassword;
      existingUser.fullName = dto.fullName;
      if (dto.phoneNumber !== undefined) existingUser.phoneNumber = dto.phoneNumber;
      existingUser.doctorProfile = {
        ...(existingUser.doctorProfile ?? {}),
        specialty: dto.specialty ?? '',
        workplace: dto.workplace ?? '',
        experienceYears: Number(dto.experienceYears),
        verificationDocuments: dto.existingVerificationDocuments ?? [],
        verificationStatus: DoctorVerificationStatus.PENDING,
        rejectReason: '',
        averageRating: existingUser.doctorProfile?.averageRating ?? 0,
        ratingSum: existingUser.doctorProfile?.ratingSum ?? 0,
        reviewCount: existingUser.doctorProfile?.reviewCount ?? 0,
        verifiedAt: existingUser.doctorProfile?.verifiedAt ?? new Date(0),
      };
      await existingUser.save();

      let finalDocumentUrls: string[] = dto.existingVerificationDocuments || [];
      if (newFilesToUpload && newFilesToUpload.length > 0) {
        // Use new parameter
        const folder = `healthcare/doctors/verification/${existingUser._id}`;
        const uploadResults = await this.cloudinaryService.uploadMultiple(
          newFilesToUpload, // Use new parameter
          folder,
          'document',
        );
        const newlyUploadedUrls = uploadResults.map(
          (result) => result.secureUrl,
        );
        finalDocumentUrls = [...finalDocumentUrls, ...newlyUploadedUrls];
      }

      doctorProfile.specialty = dto.specialty;
      doctorProfile.workplace = dto.workplace;
      doctorProfile.experienceYears = Number(dto.experienceYears);
      doctorProfile.verificationDocuments = finalDocumentUrls;
      doctorProfile.verificationStatus = DoctorVerificationStatus.PENDING;
      doctorProfile.rejectReason = undefined;
      await doctorProfile.save();

      return this.generateTokensResponse(existingUser);
    }

    // Case 2: New user registration
    if (dto.phoneNumber) {
      const existingPhoneNumber = await this.userModel.findOne({
        phoneNumber: dto.phoneNumber,
      });
      if (existingPhoneNumber)
        throw new ConflictException('Phone number already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const newUser = await this.userModel.create({
      email: dto.email,
      passwordHash: hashedPassword,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      role: dto.role,
      ...(dto.role === UserRole.DOCTOR
        ? {
            doctorProfile: {
              specialty: dto.specialty,
              workplace: dto.workplace,
              experienceYears: Number(dto.experienceYears),
              verificationDocuments: [],
              verificationStatus: DoctorVerificationStatus.PENDING,
              averageRating: 0,
              ratingSum: 0,
              reviewCount: 0,
            },
          }
        : {}),
    });

    if (dto.role === UserRole.DOCTOR) {
      let documentUrls: string[] = [];
      if (newFilesToUpload && newFilesToUpload.length > 0) {
        // Use new parameter
        const folder = `healthcare/doctors/verification/${newUser._id}`;
        const uploadResults = await this.cloudinaryService.uploadMultiple(
          newFilesToUpload, // Use new parameter
          folder,
          'document',
        );
        documentUrls = uploadResults.map((result) => result.secureUrl);
      }

      await this.doctorModel.create({
        userId: newUser._id,
        verificationStatus: DoctorVerificationStatus.PENDING,
        specialty: dto.specialty,
        workplace: dto.workplace,
        experienceYears: Number(dto.experienceYears),
        verificationDocuments: documentUrls,
      });
    }

    return this.generateTokensResponse(newUser);
  }

  /**
   * 🔐 ĐĂNG NHẬP
   */
  async login(dto: LoginDto) {
    const userQuery = this.userModel.findOne({ email: dto.email });
    const user = await (typeof (userQuery as any).select === 'function'
      ? (userQuery as any).select('+passwordHash')
      : userQuery);
    if (!user) throw new UnauthorizedException('Email does not exist.');

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash ?? user.password);
    if (!isMatch) {
      await this.recordEvent(AuthEventType.LOGIN_FAILED, user._id, user.email);
      throw new UnauthorizedException('Password is not correct');
    }

    if (user.accountStatus === 'banned') {
      throw new ForbiddenException('Account is banned');
    }

    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.doctorModel.findOne({ userId: user._id }); // Sử dụng user._id trực tiếp

      const verificationStatus = doctor?.verificationStatus;

      if (verificationStatus !== 'approved')
        throw new ForbiddenException('Account is not approved');
    }

    const result = await this.generateTokensResponse(user);
    await this.recordEvent(AuthEventType.LOGIN_SUCCESS, user._id, user.email);
    return result;
  }

  /**
   * 🔄 LÀM MỚI ACCESS TOKEN
   */
  async refreshToken(userId: string, refreshToken: string) {
    const userQuery = this.userModel.findById(userId);
    const user = await (typeof (userQuery as any).select === 'function'
      ? (userQuery as any).select('+passwordHash')
      : userQuery);
    if (!user) throw new UnauthorizedException('Access denied');
    if (!this.authSessionModel) return this.generateTokensResponse(user);
    let payload: { sub?: string; jti?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.sub !== userId || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const session = await this.authSessionModel
      .findOne({ _id: payload.jti, userId, refreshTokenHash: this.hashToken(refreshToken) })
      .select('+refreshTokenHash');
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      if (session?.familyId) {
        await this.authSessionModel.updateMany(
          { familyId: session.familyId, revokedAt: null },
          { $set: { revokedAt: new Date(), revokeReason: 'refresh_replay' } },
        );
        await this.recordEvent(AuthEventType.REFRESH_REUSED, user._id, user.email);
      }
      throw new UnauthorizedException('Refresh token is revoked or expired');
    }
    session.revokedAt = new Date();
    session.revokeReason = 'rotated';
    await session.save();
    const result = await this.generateTokensResponse(user, session.familyId);
    await this.recordEvent(AuthEventType.REFRESH_ROTATED, user._id, user.email);
    return result;
  }

  /**
   * 🚪 ĐĂNG XUẤT
   */
  async logout(userId: string) {
    if (this.authSessionModel) await this.authSessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: 'logout' } },
    );
    await this.recordEvent(AuthEventType.LOGOUT, userId);
    return { message: 'Logged out successfully' };
  }

  /**
   * 🔐 ĐỔI MẬT KHẨU
   */
  async changePassword(dto: ChangePasswordDto) {
    const user: UserDocument | null = await this.userModel
      .findOne({ email: dto.email })
      .select('+passwordHash')
      .exec();
    if (!user) throw new NotFoundException('Email not found');

    try { await this.otpService?.consume(dto.email, 'password_reset', dto.otpCode); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid OTP'); }

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.userModel.findByIdAndUpdate(user._id, {
      passwordHash: hashedPassword,
    });
    await this.logout(user._id.toString());
    await this.recordEvent(AuthEventType.PASSWORD_CHANGED, user._id, user.email);
    return { message: 'Password reset successfully' };
  }

  /**
   * 🆘 QUÊN MẬT KHẨU - GỬI OTP
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new NotFoundException('Email not found');

    return {
      message: 'Email is valid. You can request OTP now.',
    };
  }

  /**
   * 📨 GỬI OTP
   */
  async sendOtp(dto: SendOtpDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new NotFoundException('Email not found');

    if (!this.otpService) throw new ServiceUnavailableException('OTP service is unavailable');
    const { code: otpCode } = await this.otpService.issue(dto.email, 'password_reset');

    await this.nodemailerService.sendOtpEmail(dto.email, otpCode);

    await this.recordEvent(AuthEventType.OTP_SENT, user._id, user.email);
    return {
      message: 'OTP sent to email',
    };
  }

  /**
   * ✅ XÁC NHẬN OTP VÀ ĐỔI MẬT KHẨU
   */
  async confirmOtp(dto: ConfirmOtpDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new NotFoundException('Email not found');

    try { await this.otpService?.verify(dto.email, 'password_reset', dto.otpCode); }
    catch (error) {
      await this.recordEvent(AuthEventType.OTP_FAILED, user._id, user.email);
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid OTP');
    }
    await this.recordEvent(AuthEventType.OTP_VERIFIED, user._id, user.email);

    return { message: 'OTP verified successfully' };
  }

  /**
   * 🔑 LẤY THÔNG TIN USER TỪ TOKEN
   */
  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-passwordHash');

    if (!user) throw new UnauthorizedException('User not found');

    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.doctorModel.findOne({ userId: user._id });

      return {
        ...user.toObject(),
        doctorProfile: doctor ? doctor.toObject() : null,
      };
    }

    if (user.role === UserRole.ADMIN) {
      const admin = await this.adminModel.findOne({ userId: user._id });

      return {
        ...user.toObject(),
        adminProfile: admin ? admin.toObject() : null,
      };
    }

    // Patient: keep current behavior
    return user;
  }

  /**
   * 🎫 GENERATE TOKENS & REFRESH TOKEN
   */
  private async generateTokensResponse(user: UserDocument, familyId: string = randomUUID()) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '30m' });
    const sessionId = new Types.ObjectId().toString();
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: sessionId },
      { expiresIn: '7d' },
    );
    if (this.authSessionModel) await this.authSessionModel.create({
      _id: sessionId,
      userId: user._id,
      refreshTokenHash: this.hashToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    else if ((this.userModel as any).findByIdAndUpdate) {
      await (this.userModel as any).findByIdAndUpdate(user._id, {
        refreshToken: refreshToken,
      });
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordEvent(
    eventType: AuthEventType,
    userId?: string | UserDocument['_id'],
    email?: string,
  ): Promise<void> {
    if (!this.authEventModel) return;
    await this.authEventModel.create({
      eventType,
      userId: userId ? userId : null,
      email: email ?? null,
    });
  }
}
