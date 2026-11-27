import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { GoogleMobileOAuthService } from '../../application/services/google-mobile-oauth.service';
import { renderMobileDeepLinkBridgeHtml } from '../../../../common/http/mobile-deep-link-bridge';
import { RegisterPatientDto } from '../dto/register-patient.dto';
import { RegisterDoctorDto } from '../dto/register-doctor.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { RevokeSessionDto } from '../dto/revoke-session.dto';
import { ExchangeOAuthTicketDto } from '../dto/exchange-oauth-ticket.dto';
import { BeginGoogleMobileOAuthDto } from '../dto/begin-google-mobile-oauth.dto';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { GooglePrincipal } from '../../application/ports/oauth-mobile-handoff.port';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { RequestEmailVerificationDto } from '../dto/request-email-verification.dto';
import { RestoreDoctorReapplicationDto } from '../dto/restore-doctor-reapplication.dto';
import { GoogleOAuthEnabledGuard } from '../guards/google-oauth-enabled.guard';
import { GoogleOAuthError } from '../../application/errors/google-oauth.error';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly googleMobileOAuth: GoogleMobileOAuthService,
  ) {}

  @Get('oauth/google')
  @UseGuards(GoogleOAuthEnabledGuard, AuthGuard('google'))
  startGooglePatientAuthentication() {
    return;
  }

  @Post('oauth/google/mobile/attempt')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Begin Google mobile sign-in with an app verifier challenge' })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      required: ['attemptId', 'authorizationPath', 'expiresInSeconds'],
      properties: {
        attemptId: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
        authorizationPath: { type: 'string', example: '/api/v1/auth/oauth/google?attemptId=…' },
        expiresInSeconds: { type: 'integer', example: 300 },
      },
    },
  })
  async beginGoogleMobileOAuth(@Body() dto: BeginGoogleMobileOAuthDto) {
    try {
      const { attemptId } = await this.googleMobileOAuth.beginAttempt(dto.challenge);
      return {
        attemptId,
        authorizationPath: `${this.googleAuthorizePath()}?attemptId=${encodeURIComponent(attemptId)}`,
        expiresInSeconds: 300,
      };
    } catch (error) {
      this.mapGoogleOAuthError(error);
    }
  }

  @Get('oauth/google/callback')
  @UseGuards(GoogleOAuthEnabledGuard, AuthGuard('google'))
  async completeGooglePatientAuthentication(
    @Req() req: Request & { user?: GooglePrincipal },
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (this.config.get<boolean>('GOOGLE_OAUTH_ENABLED') !== true || !req.user)
      throw new NotFoundException('OAuth provider is unavailable');
    if (res) this.setPrivateOAuthResponseHeaders(res);

    const mobileRedirect = this.config
      .get<string>('GOOGLE_OAUTH_MOBILE_REDIRECT_URL')
      ?.trim();
    const acceptHeader = req.headers?.accept ?? '';
    const attemptId = (req as Request & { oauthAttemptId?: string }).oauthAttemptId;
    if (attemptId && (!res || !mobileRedirect || !acceptHeader.includes('text/html')))
      throw new ForbiddenException('Google mobile handoff is unavailable');
    const wantsHtml = Boolean(res && mobileRedirect && attemptId);

    if (!wantsHtml) {
      if (res) this.setPrivateOAuthResponseHeaders(res);
      return this.auth.completeGooglePatientAuthentication(
        req.user,
        this.meta(req),
      );
    }

    try {
      const ticket = await this.googleMobileOAuth.storeCallback(
        attemptId!,
        { ...req.user, emailVerified: req.user.emailVerified === true },
      );
      const targetUrl = this.mobileHandoffUrl(mobileRedirect!, 'ticket', ticket);
      res!.setHeader('Cache-Control', 'no-store');
      res!.setHeader('Pragma', 'no-cache');
      res!.setHeader('Referrer-Policy', 'no-referrer');
      res!.setHeader('X-Content-Type-Options', 'nosniff');
      res!.setHeader('Content-Type', 'text/html; charset=utf-8');
      return renderMobileDeepLinkBridgeHtml({
        targetUrl,
        title: 'Đăng nhập Google thành công / Google Sign-In Complete',
        subtitle:
          'Đang quay lại ứng dụng Healthcare... / Returning to Healthcare app...',
        buttonLabel: 'Mở ứng dụng Healthcare / Open Healthcare App',
        hint: 'Nếu trình duyệt không tự chuyển, hãy chuyển lại về ứng dụng Healthcare — phiên đăng nhập sẽ tự hoàn tất. / If the browser does not switch automatically, switch back to the Healthcare app to complete sign-in.',
      });
    } catch (error) {
      const errorCode =
        error instanceof ConflictException
          ? 'local_account_exists'
          : error instanceof ForbiddenException
            ? 'account_ineligible'
            : 'oauth_failed';
      const targetUrl = this.mobileHandoffUrl(mobileRedirect!, 'error', errorCode);
      const isConflict = errorCode === 'local_account_exists';
      res!.setHeader('Cache-Control', 'no-store');
      res!.setHeader('Pragma', 'no-cache');
      res!.setHeader('Referrer-Policy', 'no-referrer');
      res!.setHeader('Content-Type', 'text/html; charset=utf-8');
      return renderMobileDeepLinkBridgeHtml({
        targetUrl,
        title: isConflict
          ? 'Email đã có tài khoản mật khẩu / Password Account Already Exists'
          : 'Không thể đăng nhập bằng Google / Google Sign-In Unavailable',
        subtitle: isConflict
          ? 'Email Google vừa chọn đã đăng ký bằng mật khẩu. Hãy chọn tài khoản Google khác hoặc quay lại ứng dụng để đăng nhập bằng mật khẩu. / This Google email is registered with a password. Choose another Google account or return to the app to sign in with password.'
          : 'Đang chuyển về ứng dụng Healthcare... / Returning to Healthcare app...',
        buttonLabel: 'Quay lại ứng dụng / Return to App',
        secondaryLabel:
          'Chọn tài khoản Google khác / Choose Another Google Account',
        hint: 'Nếu nút Quay lại không tự chuyển app trên bản dev, hãy nhấn nút chuyển ứng dụng về Healthcare. / If Return to App does not switch on dev build, use the app switcher to return to Healthcare.',
      });
    }
  }

  @Post('oauth/google/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Exchange a one-time Google OAuth handoff ticket for a Patient session',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['accessToken', 'refreshToken', 'user'],
      properties: {
        accessToken: { type: 'string', description: 'Session access token; never place it in a URL or log.' },
        refreshToken: { type: 'string', description: 'Session refresh token; never place it in a URL or log.' },
        user: {
          type: 'object',
          required: ['id', 'role', 'emailVerified'],
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              emailVerified: { type: 'boolean' },
              fullName: { type: 'string' },
              role: { type: 'string', example: 'patient' },
              avatarUrl: { type: 'string' },
              hasPassword: { type: 'boolean' },
              authProvider: { type: 'string', enum: ['local', 'google'] },
            },
          },
        },
      },
    })
  async exchangeGoogleOAuthTicket(
    @Body() dto: ExchangeOAuthTicketDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.setPrivateOAuthResponseHeaders(res);
    try {
      return await this.googleMobileOAuth.exchange(
        dto.attemptId,
        dto.ticket,
        dto.verifier,
        this.meta(req),
      );
    } catch (error) {
      this.mapGoogleOAuthError(error);
    }
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
  login(@Body() dto: LoginDto, @Req() req?: Request) {
    return this.auth.login(dto, this.meta(req));
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

  private meta(req?: Request) {
    return { userAgent: req?.get?.('user-agent') };
  }

  private googleAuthorizePath() {
    const prefix = this.config
      .getOrThrow<string>('API_PREFIX')
      .replace(/^\/+|\/+$/g, '');
    const version = this.config.getOrThrow<string>('API_VERSION');
    return `/${prefix}/v${version}/auth/oauth/google`;
  }

  private mobileHandoffUrl(base: string, key: 'ticket' | 'error', value: string) {
    const target = new URL(base);
    target.searchParams.set(key, value);
    return target.toString();
  }

  private mapGoogleOAuthError(error: unknown): never {
    if (error instanceof GoogleOAuthError) {
      if (error.code === 'GOOGLE_OAUTH_INVALID_CHALLENGE')
        throw new BadRequestException('Invalid Google OAuth mobile challenge');
      if (error.code === 'GOOGLE_OAUTH_UNAVAILABLE')
        throw new ServiceUnavailableException('Google OAuth is temporarily unavailable');
      throw new UnauthorizedException('Google OAuth handoff is invalid or expired');
    }
    throw error;
  }

  private setPrivateOAuthResponseHeaders(res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}
