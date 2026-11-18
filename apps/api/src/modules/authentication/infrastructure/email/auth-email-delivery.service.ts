import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  User,
  UserDocument,
} from '../../../users/domain/entities/users/user.schema';
import { NodemailerService } from '../../../../infrastructure/email/nodemailer.service';
import { OtpService } from '../../application/services/otp.service';

/** Worker-only adapter. Outbox payloads carry user id + purpose, never an OTP or address. */
@Injectable()
export class AuthEmailDeliveryService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly otp: OtpService,
    private readonly mail: NodemailerService,
  ) {}
  async deliverOtp(
    userId: string,
    purpose: 'email_verification' | 'password_reset',
  ) {
    const user = await this.users
      .findById(userId)
      .select('email accountStatus');
    if (!user?.email) return;
    const code = await this.otp.revealForDelivery(user.email, purpose);
    if (!code) return;
    await this.mail.sendOtpEmail(
      user.email,
      code,
      purpose === 'password_reset',
    );
  }
}
