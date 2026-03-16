import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmOtpDto } from './dto/confirm-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 📝 POST /auth/register
   * Đăng ký tài khoản mới
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * 🔐 POST /auth/login
   * Đăng nhập với email & password
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * 🔄 POST /auth/refresh
   * Làm mới access token bằng refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.userId, dto.refreshToken);
  }

  /**
   * 🚪 POST /auth/logout
   * Đăng xuất (yêu cầu JWT)
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất' })
  async logout(@CurrentUser('sub') userId: string) {
    return this.authService.logout(userId);
  }

  /**
   * 👤 GET /auth/me
   * Lấy thông tin profile hiện tại
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin profile' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  /**
   * 🔐 POST /auth/change-password
   * Đổi mật khẩu (yêu cầu JWT & mật khẩu cũ)
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  /**
   * 🆘 POST /auth/forgot-password
   * Quên mật khẩu - gửi OTP qua email
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP để đặt lại mật khẩu' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * ✅ POST /auth/confirm-otp
   * Xác nhận OTP và đặt lại mật khẩu
   */
  @Post('confirm-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận OTP và đặt lại mật khẩu' })
  async confirmOtp(@Body() dto: ConfirmOtpDto) {
    return this.authService.confirmOtp(dto);
  }
}
