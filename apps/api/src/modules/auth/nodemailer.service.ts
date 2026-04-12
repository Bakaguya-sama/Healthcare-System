import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NodemailerService implements OnModuleInit {
  private readonly logger = new Logger(NodemailerService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>(
      'SMTP_HOST',
      'smtp.gmail.com',
    );
    const smtpPort = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const smtpSecure =
      this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const smtpUser = this.configService.get<string>('SMTP_USER', '');
    const smtpPass = this.configService.get<string>('SMTP_PASS', '');

    this.fromEmail = this.configService.get<string>('SMTP_FROM', smtpUser);

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP transporter is ready');
    } catch (error) {
      this.logger.warn(`SMTP verify failed: ${String(error)}`);
    }
  }

  async sendOtpEmail(toEmail: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Healthcare OTP Verification',
        text: `Your OTP code is: ${otp}. It will expire in 10 minutes.`,
        html: `<p>Your OTP code is: <b>${otp}</b></p><p>It will expire in 10 minutes.</p>`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${toEmail}: ${String(error)}`,
      );
      throw new InternalServerErrorException('Failed to send OTP email');
    }
  }
}
