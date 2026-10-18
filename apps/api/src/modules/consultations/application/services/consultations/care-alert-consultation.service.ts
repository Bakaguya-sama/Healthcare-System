import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { OutboxService } from '../../../../../infrastructure/outbox/outbox.service';
import {
  CONSULTATION_USAGE_PORT,
  type ConsultationUsagePort,
} from '../../../../billing/public-api';
import { AuditLog } from '../../../../platform-audit/public-api';
import {
  Consultation,
  ConsultationDocument,
  ConsultationMode,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';
import type { CareAlertConsultationPort } from '../../ports/care-alert-consultation.port';
import { defaultBookingSettingsSnapshot } from './booking-policy';

@Injectable()
export class CareAlertConsultationService implements CareAlertConsultationPort {
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultations: Model<ConsultationDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    private readonly outbox: OutboxService,
    @Inject(CONSULTATION_USAGE_PORT)
    private readonly usage: ConsultationUsagePort,
  ) {}

  async createFromCareAlert(
    input: Parameters<CareAlertConsultationPort['createFromCareAlert']>[0],
  ) {
    const careAlertId = new Types.ObjectId(input.careAlertId);
    const existing = await this.consultations
      .findOne({ careAlertId })
      .lean()
      .exec();
    if (existing) return { id: String(existing._id), created: false };
    await this.usage.prepare(input.patientId);
    const session = await this.connection.startSession();
    try {
      let consultation!: ConsultationDocument;
      let created = false;
      await session.withTransaction(async () => {
        const duplicate = await this.consultations
          .findOne({ careAlertId })
          .session(session)
          .exec();
        if (duplicate) {
          consultation = duplicate;
          return;
        }
        const scheduled = Boolean(input.scheduledStartAt);
        consultation = new this.consultations({
          careAlertId,
          patientCareProgramId: new Types.ObjectId(input.patientCareProgramId),
          patientId: new Types.ObjectId(input.patientId),
          doctorId: new Types.ObjectId(input.doctorId),
          mode: scheduled
            ? ConsultationMode.SCHEDULED
            : ConsultationMode.ON_DEMAND,
          requestStatus: ConsultationRequestStatus.ACCEPTED,
          sessionStatus: ConsultationSessionStatus.WAITING,
          requestedAt: new Date(),
          respondedAt: new Date(),
          ...(input.scheduledStartAt
            ? {
                bookingSettingsSnapshot: defaultBookingSettingsSnapshot(),
                scheduledStartAt: input.scheduledStartAt,
                scheduledEndAt: new Date(
                  input.scheduledStartAt.getTime() +
                    input.expectedDurationMinutes * 60_000,
                ),
              }
            : {}),
          timezone: input.timezone,
          expectedDurationMinutes: input.expectedDurationMinutes,
          ...(input.followUpNote || input.nextAction
            ? {
                followUp: {
                  note: input.followUpNote,
                  nextAction: input.nextAction,
                  createdBy: input.doctorId,
                  createdAt: new Date(),
                },
              }
            : {}),
        });
        const reservation = await this.usage.reserve({
          consultationId: String(consultation._id),
          patientId: input.patientId,
          session,
        });
        if (reservation.status !== 'reserved')
          throw new Error('Consultation quota is not reserved');
        await consultation.save({ session });
        created = true;
        await this.audits.create(
          [
            {
              domain: 'consultation',
              entityType: 'consultation',
              entityId: consultation._id,
              actorId: consultation.doctorId,
              action: 'consultation_linked_to_care_alert',
              metadata: {
                careAlertId: String(careAlertId),
                patientCareProgramId: input.patientCareProgramId,
              },
            },
          ],
          { session },
        );
        await this.outbox.enqueue(
          {
            eventType: 'care.alert.consultation-linked',
            aggregateType: 'consultation',
            aggregateId: consultation._id,
            idempotencyKey: `care.alert.consultation-linked.${careAlertId}`,
            payload: {
              userId: input.doctorId,
              action: 'care_alert_consultation_linked',
              alertId: String(careAlertId),
              consultationId: String(consultation._id),
            },
          },
          session,
        );
      });
      return { id: String(consultation._id), created };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const duplicate = await this.consultations
          .findOne({ careAlertId })
          .lean()
          .exec();
        if (duplicate) return { id: String(duplicate._id), created: false };
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
