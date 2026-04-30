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
        text: `Your OTP code is: ${otp}. It will expire in 5 minutes.`,
        html: `<p>Your OTP code is: <b>${otp}</b></p><p>It will expire in 5 minutes.</p>`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${toEmail}: ${String(error)}`,
      );
      throw new InternalServerErrorException('Failed to send OTP email');
    }
  }

  async sendRejectEmail(toEmail: string, reason: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Update on Your Healthcare Platform Registration',
        text: `Thank you for your interest in joining our platform. After careful review of your application, we regret to inform you that we are unable to approve your registration at this time.\n\nReason: ${reason}\n\nIf you have any questions or wish to provide additional documentation, please contact our support team.`,
        html: `
          <p>Dear Doctor,</p>
          <p>Thank you for your interest in joining our platform.</p>
          <p>After careful review of your application, we regret to inform you that we are unable to approve your registration at this time.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>If you have any questions or wish to provide additional documentation, please contact our support team.</p>
          <br>
          <p>Best regards,<br>Healthcare Platform Team</p>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send reject email to ${toEmail}: ${String(error)}`,
      );
      throw new InternalServerErrorException('Failed to send reject email');
    }
  }

  async sendApproveEmail(toEmail: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Welcome to Healthcare: Registration Approved',
        text: `Congratulations! We are pleased to inform you that your registration as a Doctor on the Healthcare platform has been successfully approved.\n\nYou can now log in to your account and begin exploring our services. Welcome aboard!`,
        html: `
          <p>Dear Doctor,</p>
          <p>Congratulations!</p>
          <p>We are pleased to inform you that your registration as a Doctor on the Healthcare platform has been successfully approved.</p>
          <p>You can now log in to your account and begin exploring our services. <strong>Welcome aboard!</strong></p>
          <br>
          <p>Best regards,<br>Healthcare Platform Team</p>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send approve email to ${toEmail}: ${String(error)}`,
      );
      throw new InternalServerErrorException('Failed to send approve email');
    }
  }

  async sendBanEmail(toEmail: string, banReason: string | null): Promise<void> {
    // Xử lý chuỗi lý do để tránh hiển thị "null" nếu không có lý do
    const textReason = banReason
      ? `\n\nReason for suspension: ${banReason}`
      : '';
    const htmlReason = banReason
      ? `<p><strong>Reason for suspension:</strong> ${banReason}</p>`
      : '';

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Important Notice: Account Suspension',
        text: `This email is to notify you that your account on the Healthcare platform has been suspended following a review of your recent activity.${textReason}\n\nIf you believe this action was taken in error, please contact our support team immediately via this email.`,
        html: `
          <p>Dear User,</p>
          <p>This email is to notify you that your account on the Healthcare platform has been suspended following a review of your recent activity.</p>
          ${htmlReason}
          <p>If you believe this action was taken in error or need further clarification, please contact our support team immediately.</p>
          <br>
          <p>Sincerely,<br>Healthcare Compliance Team</p>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send ban email to ${toEmail}: ${String(error)}`,
      );
      throw new InternalServerErrorException('Failed to send ban email');
    }
  }

  async sendUnbanEmail(toEmail: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Healthcare Account Restored: Access Reactivated',
        text: `We are pleased to inform you that your account on the Healthcare platform has been reactivated following a successful appeal or review. You can now log in and resume using our services immediately.`,
        html: `
          <p>Dear User,</p>
          <p>We are pleased to inform you that your account on the Healthcare platform has been <strong>reactivated</strong> following a successful review.</p>
          <p>You can now log in to your account and resume using our services immediately. We appreciate your patience during this process.</p>
          <p>If you have any further questions, please do not hesitate to contact our support team.</p>
          <br>
          <p>Best regards,<br>Healthcare Compliance Team</p>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send unban email to ${toEmail}: ${String(error)}`,
      );
      throw new InternalServerErrorException('Failed to send unban email');
    }
  }
}
