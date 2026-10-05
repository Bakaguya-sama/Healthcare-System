import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import { AuditLog } from '../../../platform-audit/public-api';
import {
  CareAlert,
  CareAlertDocument,
  CareAlertStatus,
} from '../../domain/entities/care-alert.entity';
import {
  HealthEvaluation,
  HealthEvaluationDocument,
  HealthEvaluationSeverity,
} from '../../domain/entities/health-evaluation.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
} from '../../domain/entities/patient-care-program.entity';
import type { CareActor } from './care-program-rule.service';

@Injectable()
export class CareAlertService {
  constructor(
    @InjectModel(CareAlert.name)
    private readonly alerts: Model<CareAlertDocument>,
    @InjectModel(HealthEvaluation.name)
    private readonly evaluations: Model<HealthEvaluationDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    private readonly outbox: OutboxService,
  ) {}

  async createForEvaluation(evaluation: HealthEvaluationDocument) {
    if (evaluation.severity === HealthEvaluationSeverity.NORMAL) return null;
    const enrollment = await this.enrollments
      .findById(evaluation.patientCareProgramId)
      .exec();
    if (!enrollment) return null;
    const windowStart = String(
      (evaluation.timeRange as Record<string, unknown>).startAt,
    );
    const uniqueKey = `${enrollment.id}:${evaluation.careRuleId}:${windowStart}`;
    const session = await this.connection.startSession();
    try {
      let alert!: CareAlertDocument;
      await session.withTransaction(async () => {
        const existing = await this.alerts
          .findOne({ uniqueKey })
          .session(session)
          .exec();
        if (existing) {
          alert = existing;
          return;
        }
        alert = new this.alerts({
          patientCareProgramId: enrollment._id,
          evaluationId: evaluation._id,
          patientId: enrollment.patientId,
          assignedDoctorId: enrollment.doctorId,
          severity: evaluation.severity,
          reasonCodes: evaluation.reasonCodes,
          uniqueKey,
          detectedAt: evaluation.evaluatedAt,
          revision: 1,
        });
        await alert.save({ session });
        await this.audits.create(
          [
            {
              domain: 'care',
              entityType: 'careAlert',
              entityId: alert._id,
              action: 'care_alert_opened',
              toStatus: alert.status,
              metadata: {
                severity: alert.severity,
                reasonCodes: alert.reasonCodes,
              },
            },
          ],
          { session },
        );
        await this.outbox.enqueue(
          {
            eventType: 'care.alert.opened',
            aggregateType: 'careAlert',
            aggregateId: alert._id,
            idempotencyKey: `care.alert.opened.${alert._id}`,
            payload: {
              alertId: String(alert._id),
              patientId: String(alert.patientId),
              severity: alert.severity,
              safetyTemplate:
                alert.severity === HealthEvaluationSeverity.URGENT
                  ? 'urgent-care-alert-v1'
                  : 'attention-care-alert-v1',
            },
          },
          session,
        );
      });
      return alert;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.alerts.findOne({ uniqueKey }).exec();
        if (existing) return existing;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async transition(
    actor: CareActor,
    alertId: string,
    action: 'acknowledge' | 'resolve' | 'dismiss',
    expectedRevision: number,
    reason?: string,
  ) {
    if (!Types.ObjectId.isValid(alertId))
      throw new HttpException(
        { code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' },
        HttpStatus.NOT_FOUND,
      );
    const alert = await this.alerts.findById(alertId).lean().exec();
    if (!alert)
      throw new HttpException(
        { code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' },
        HttpStatus.NOT_FOUND,
      );
    if (String(alert.assignedDoctorId) !== actor.id)
      throw new HttpException(
        { code: 'CARE_FORBIDDEN', message: 'Alert action is forbidden' },
        HttpStatus.FORBIDDEN,
      );
    if (
      alert.status === CareAlertStatus.RESOLVED ||
      alert.status === CareAlertStatus.DISMISSED
    )
      throw new HttpException(
        { code: 'CARE_ALERT_TERMINAL', message: 'Alert is terminal' },
        HttpStatus.CONFLICT,
      );
    if (alert.revision !== expectedRevision)
      throw new HttpException(
        { code: 'CARE_ALERT_REVISION_CONFLICT', message: 'Alert was changed by another request' },
        HttpStatus.CONFLICT,
      );
    const fromStatus = alert.status;
    const now = new Date();
    const actorId = new Types.ObjectId(actor.id);
    if (action === 'acknowledge' && alert.status !== CareAlertStatus.OPEN)
      throw new HttpException(
        { code: 'CARE_ALERT_TRANSITION_INVALID', message: 'Alert is not open' },
        HttpStatus.CONFLICT,
      );
    const update = action === 'acknowledge'
      ? { status: CareAlertStatus.ACKNOWLEDGED, acknowledgedBy: actorId, acknowledgedAt: now }
      : action === 'resolve'
        ? { status: CareAlertStatus.RESOLVED, acknowledgedBy: alert.acknowledgedBy ?? actorId, acknowledgedAt: alert.acknowledgedAt ?? now, resolvedBy: actorId, resolvedAt: now, resolutionNote: reason }
        : { status: CareAlertStatus.DISMISSED, dismissedBy: actorId, dismissedAt: now, dismissalReason: reason };
    const session = await this.connection.startSession();
    try {
      let updated!: CareAlertDocument;
      await session.withTransaction(async () => {
        const statuses = action === 'acknowledge'
          ? [CareAlertStatus.OPEN]
          : [CareAlertStatus.OPEN, CareAlertStatus.ACKNOWLEDGED];
        const found = await this.alerts.findOneAndUpdate(
          { _id: alert._id, assignedDoctorId: actorId, revision: expectedRevision, status: { $in: statuses } },
          { $set: update, $inc: { revision: 1 } },
          { new: true, session },
        ).exec();
        if (!found) throw new HttpException({ code: 'CARE_ALERT_REVISION_CONFLICT', message: 'Alert was changed by another request' }, HttpStatus.CONFLICT);
        updated = found;
        const auditRows: Record<string, unknown>[] = [];
        if (action === 'resolve' && fromStatus === CareAlertStatus.OPEN)
          auditRows.push({ domain: 'care', entityType: 'careAlert', entityId: updated._id, actorId, action: 'care_alert_acknowledged_implicitly', fromStatus: CareAlertStatus.OPEN, toStatus: CareAlertStatus.ACKNOWLEDGED, metadata: { revision: updated.revision } });
        auditRows.push({ domain: 'care', entityType: 'careAlert', entityId: updated._id, actorId, action: `care_alert_${action}d`, fromStatus, toStatus: updated.status, reason, metadata: { revision: updated.revision } });
        await this.audits.create(auditRows, { session });
      });
      return updated;
    } finally { await session.endSession(); }
  }

  async getAuditForAdmin(alertId: string) {
    if (!Types.ObjectId.isValid(alertId)) throw new HttpException({ code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' }, HttpStatus.NOT_FOUND);
    return this.audits.find({ domain: 'care', entityType: 'careAlert', entityId: new Types.ObjectId(alertId) }).sort({ createdAt: 1, _id: 1 }).lean().exec();
  }

  async getForPatient(actorId: string, alertId: string) {
    const alert = await this.alerts
      .findOne({ _id: alertId, patientId: actorId })
      .lean()
      .exec();
    if (!alert)
      throw new HttpException(
        { code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' },
        HttpStatus.NOT_FOUND,
      );
    return {
      id: String(alert._id),
      status: alert.status,
      severity: alert.severity,
      detectedAt: alert.detectedAt,
      reasonCodes: alert.reasonCodes,
    };
  }
}
