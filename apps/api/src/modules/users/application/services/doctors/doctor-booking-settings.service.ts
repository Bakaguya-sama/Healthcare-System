import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { UserRole } from '../../../../../core/domain/user.enums';
import { OutboxService } from '../../../../../infrastructure/outbox/outbox.service';
import { AuditLog } from '../../../../platform-audit/public-api';
import { type DoctorBookingSettings } from '../../../domain/entities/doctors/doctor-profile.schema';
import {
  User,
  type UserDocument,
} from '../../../domain/entities/users/user.schema';
import {
  DoctorBookingSettingsPolicy,
  type DoctorBookingSettingsInput,
} from '../../../domain/value-objects/doctor-booking-settings.policy';

type ActorKind = 'doctor' | 'admin';

@Injectable()
export class DoctorBookingSettingsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    private readonly outbox: OutboxService,
  ) {}

  async getForDoctor(doctorId: string) {
    const doctor = await this.requireDoctor(doctorId);
    if (!doctor.doctorProfile?.bookingSettings) {
      throw new NotFoundException('Doctor booking settings are not configured');
    }
    return this.response(doctor.doctorProfile.bookingSettings);
  }

  /** Used by the consultation bounded context to take a booking snapshot. */
  async getActiveScheduledPolicy(
    doctorId: string,
  ): Promise<DoctorBookingSettings> {
    const doctor = await this.requireDoctor(doctorId);
    const settings = doctor.doctorProfile?.bookingSettings;
    if (!settings) {
      throw new NotFoundException('Doctor booking settings are not configured');
    }
    try {
      DoctorBookingSettingsPolicy.validate(settings);
    } catch {
      throw new BadRequestException('Doctor booking settings are invalid');
    }
    return settings;
  }

  async updateByDoctor(doctorId: string, input: DoctorBookingSettingsInput) {
    return this.save(doctorId, doctorId, 'doctor', input);
  }

  async overrideByAdmin(
    adminId: string,
    doctorId: string,
    input: DoctorBookingSettingsInput,
    reason: string,
  ) {
    if (!reason.trim())
      throw new BadRequestException('Override reason is required');
    return this.save(doctorId, adminId, 'admin', input, reason.trim());
  }

  private async save(
    doctorId: string,
    actorId: string,
    actorKind: ActorKind,
    input: DoctorBookingSettingsInput,
    overrideReason?: string,
  ) {
    try {
      DoctorBookingSettingsPolicy.validate(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid booking settings',
      );
    }
    const now = new Date();
    return this.connection.transaction(async (session) => {
      const doctor = await this.users
        .findOne({
          _id: doctorId,
          role: UserRole.DOCTOR,
          doctorProfile: { $exists: true },
        })
        .session(session);
      if (!doctor?.doctorProfile)
        throw new NotFoundException('Doctor profile not found');
      const settings: DoctorBookingSettings = {
        ...input,
        effectiveFrom: now,
        updatedAt: now,
        updatedBy: actorId,
        ...(overrideReason ? { overrideReason } : {}),
      };
      doctor.doctorProfile.bookingSettings = settings;
      doctor.markModified('doctorProfile');
      await doctor.save({ session });
      await this.audits.create(
        [
          {
            domain: 'consultation',
            entityType: 'DoctorBookingSettings',
            entityId: doctor._id,
            action:
              actorKind === 'admin'
                ? 'booking_settings_overridden'
                : 'booking_settings_updated',
            userId: new Types.ObjectId(actorId),
            ...(overrideReason ? { reason: overrideReason } : {}),
            metadata: { bookingPolicy: settings.bookingPolicy },
          },
        ],
        { session },
      );
      await this.outbox.enqueue(
        {
          eventType: 'consultation.doctor-booking-settings.changed.v1',
          aggregateType: 'DoctorBookingSettings',
          aggregateId: doctor._id,
          idempotencyKey: `doctor-booking-settings:${String(doctor._id)}:${now.getTime()}`,
          payload: {
            eventVersion: 1,
            doctorId: String(doctor._id),
            changedBy: actorId,
            actorKind,
            effectiveFrom: now.toISOString(),
          },
        },
        session,
      );
      return this.response(settings);
    });
  }

  private async requireDoctor(doctorId: string) {
    if (!Types.ObjectId.isValid(doctorId))
      throw new BadRequestException('Invalid doctor ID');
    const doctor = await this.users
      .findOne({
        _id: doctorId,
        role: UserRole.DOCTOR,
        doctorProfile: { $exists: true },
      })
      .lean();
    if (!doctor?.doctorProfile)
      throw new NotFoundException('Doctor profile not found');
    return doctor;
  }

  private response(settings: DoctorBookingSettings) {
    return {
      statusCode: 200,
      data: {
        bookingPolicy: settings.bookingPolicy,
        bufferMinutes: settings.bufferMinutes,
        minNoticeMinutes: settings.minNoticeMinutes,
        cancellationDeadlineMinutes: settings.cancellationDeadlineMinutes,
        checkInEarlyMinutes: settings.checkInEarlyMinutes,
        noShowAfterMinutes: settings.noShowAfterMinutes,
        effectiveFrom: settings.effectiveFrom,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      },
    };
  }
}
