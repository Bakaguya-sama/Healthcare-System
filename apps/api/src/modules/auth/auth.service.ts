import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './entities/user.schema';
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
    private configService: ConfigService,
    private nodemailerService: NodemailerService,
    private cloudinaryService: CloudinaryService,
  ) {}

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
      existingUser.password = hashedPassword;
      existingUser.fullName = dto.fullName;
      existingUser.phoneNumber = dto.phoneNumber;
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
      password: hashedPassword,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      role: dto.role,
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
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    if (user.accountStatus === 'banned') {
      throw new UnauthorizedException('Account is banned');
    }

    return this.generateTokensResponse(user);
  }

  /**
   * 🔄 LÀM MỚI ACCESS TOKEN
   */
  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Access denied');

    // RefreshToken validation removed - not in template
    return this.generateTokensResponse(user);
  }

  /**
   * 🚪 ĐĂNG XUẤT
   */
  async logout(userId: string) {
    // Logout logic simplified - refreshToken removed from schema
    return { message: 'Logged out successfully' };
  }

  /**
   * 🔐 ĐỔI MẬT KHẨU
   */
  async changePassword(dto: ChangePasswordDto) {
    const user: UserDocument | null = await this.userModel
      .findOne({ email: dto.email })
      .exec();
    if (!user) throw new NotFoundException('Email not found');

    if (user.otpCode !== dto.otpCode) {
      throw new BadRequestException('Invalid OTP');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      otpCode: null,
      otpExpiresAt: null,
    });

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

    // Tạo OTP ngẫu nhiên
    const otpCode = Math.random().toString().slice(2, 8);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // Lưu OTP vào database
    await this.userModel.findByIdAndUpdate(user._id, {
      otpCode,
      otpExpiresAt,
    });

    await this.nodemailerService.sendOtpEmail(dto.email, otpCode);

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

    // Kiểm tra OTP
    if (user.otpCode !== dto.otpCode) {
      throw new BadRequestException('Invalid OTP');
    }

    // Kiểm tra hạn OTP
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }

    return { message: 'OTP verified successfully' };
  }

  /**
   * 🔑 LẤY THÔNG TIN USER TỪ TOKEN
   */
  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password -refreshToken -otpCode');

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
  private async generateTokensResponse(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '30m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Hash refresh token trước khi lưu
    const hashedRefresh = await bcrypt.hash(refreshToken, 12);
    await this.userModel.findByIdAndUpdate(user._id, {
      refreshToken: hashedRefresh,
    });

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
}
