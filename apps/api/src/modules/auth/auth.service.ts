import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './entities/user.schema';
import { Doctor, DoctorDocument, DoctorVerificationStatus } from '../users/entities/doctor.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmOtpDto } from './dto/confirm-otp.dto';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 📝 ĐĂNG KÝ TÀI KHOẢN MỚI
   */
  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      role: dto.role,
      gender: dto.gender,
      phoneNumber: dto.phoneNumber,
      address: dto.address,
    });

    // Nếu là bác sĩ, tạo Doctor document
    if (dto.role === UserRole.DOCTOR) {
      await this.doctorModel.create({
        userId: user._id,
        verificationStatus: DoctorVerificationStatus.PENDING,
      });
    }

    return this.generateTokensResponse(user);
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
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch)
      throw new BadRequestException('Old password is incorrect');

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * 🆘 QUÊN MẬT KHẨU - GỬI OTP
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new BadRequestException('Email not found');

    // Tạo OTP ngẫu nhiên
    const otpCode = Math.random().toString().slice(2, 8);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // Lưu OTP vào database
    await this.userModel.findByIdAndUpdate(user._id, {
      otpCode,
      otpExpiresAt,
    });

    // TODO: Gửi OTP qua email (dùng nodemailer hoặc SendGrid)
    console.log(`[DEV] OTP for ${dto.email}: ${otpCode}`);

    return {
      message: 'OTP sent to email',
      // Chỉ cho test: bỏ ở production
      otpCode, // ❌ KHÔNG trả OTP cho client ở production!
    };
  }

  /**
   * ✅ XÁC NHẬN OTP VÀ ĐỔI MẬT KHẨU
   */
  async confirmOtp(dto: ConfirmOtpDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new BadRequestException('Email not found');

    // Kiểm tra OTP
    if (user.otpCode !== dto.otpCode) {
      throw new BadRequestException('Invalid OTP');
    }

    // Kiểm tra hạn OTP
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    // Cập nhật mật khẩu và xóa OTP
    await this.userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      otpCode: null,
      otpExpiresAt: null,
    });

    return { message: 'Password reset successfully' };
  }

  /**
   * 🔑 LẤY THÔNG TIN USER TỪ TOKEN
   */
  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password -refreshToken -otpCode');
    if (!user) throw new UnauthorizedException('User not found');
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
