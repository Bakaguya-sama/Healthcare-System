import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { RegisterPatientDto } from '../dto/register-patient.dto';
import { RegisterDoctorDto } from '../dto/register-doctor.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { RevokeSessionDto } from '../dto/revoke-session.dto';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { GooglePrincipal } from '../../infrastructure/strategies/google.strategy';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { RequestEmailVerificationDto } from '../dto/request-email-verification.dto';
import { RestoreDoctorReapplicationDto } from '../dto/restore-doctor-reapplication.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  startGooglePatientAuthentication() {
    return;
  }

  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  completeGooglePatientAuthentication(
    @Req() req: Request & { user?: GooglePrincipal },
  ) {
    if (this.config.get<boolean>('GOOGLE_OAUTH_ENABLED') !== true || !req.user)
      throw new NotFoundException('OAuth provider is unavailable');
    return this.auth.completeGooglePatientAuthentication(
      req.user,
      this.meta(req),
    );
  }

  @Post('register/patient')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a patient account pending email verification',
  })
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.auth.registerPatient(dto);
  }

  @Post('register/doctor')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Register a doctor account pending email verification and approval',
  })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'newFilesToUpload', maxCount: 10 }]),
  )
  registerDoctor(
    @Body() dto: RegisterDoctorDto,
    @UploadedFiles() files: { newFilesToUpload?: Express.Multer.File[] },
  ) {
    return this.auth.registerDoctor(dto, files?.newFilesToUpload);
  }

  @Post('doctor-reapplication/restore')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Restore a rejected Doctor application after local credential verification',
  })
  restoreDoctorReapplication(@Body() dto: RestoreDoctorReapplicationDto) {
    return this.auth.restoreDoctorReapplication(dto.email, dto.password);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.email, dto.otpCode);
  }

  @Post('request-email-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Queue an email-verification OTP for a pending account',
  })
  requestEmailVerification(@Body() dto: RequestEmailVerificationDto) {
    return this.auth.requestEmailVerification(dto.email);
  }

  /** @deprecated Use request-email-verification. Kept temporarily for unpinned clients. */
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  resend(@Body() dto: RequestEmailVerificationDto) {
    return this.auth.requestEmailVerification(dto.email);
  }

  @Post('password-recovery')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  passwordRecovery(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.otpCode, dto.newPassword);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh') @Throttle({ default: { limit: 10, ttl: 60_000 } }) refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    return this.auth.refreshToken(dto.refreshToken, this.meta(req));
  }

  @Get('sessions') @UseGuards(JwtAuthGuard) @ApiBearerAuth() sessions(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sid') sid?: string,
  ) {
    return this.auth.listSessions(userId, sid);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser('sub') userId: string, @CurrentUser('sid') sid?: string) {
    return sid
      ? this.auth.revokeCurrentSession(userId, sid)
      : this.auth.revokeAllSessions(
          userId,
          'legacy_access_token_without_session',
        );
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentUser('sub') userId: string) {
    return this.auth.revokeAllSessions(userId);
  }

  @Post('sessions/revoke') @UseGuards(JwtAuthGuard) @ApiBearerAuth() revoke(
    @CurrentUser('sub') userId: string,
    @Body() dto: RevokeSessionDto,
  ) {
    return this.auth.revokeSession(userId, dto.sessionId);
  }

  @Get('me') @UseGuards(JwtAuthGuard) @ApiBearerAuth() me(
    @CurrentUser('sub') userId: string,
  ) {
    return this.auth.getProfile(userId);
  }

  private meta(req: Request) {
    return { userAgent: req.get('user-agent') };
  }
}
