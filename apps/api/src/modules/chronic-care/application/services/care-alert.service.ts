import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
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
import { localDate } from '../../domain/tasks/care-task-timezone';
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  normalizeCursorRequest,
} from '../../../../common/pagination';
import type { QueryDoctorCareAlertsDto } from '../../presentation/dto/care-alert.dto';
import {
  CARE_ALERT_CONSULTATION_PORT,
  type CareAlertConsultationPort,
} from '../../../consultations/public-api';

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
    @Optional()
    @Inject(CARE_ALERT_CONSULTATION_PORT)
    private readonly consultations?: CareAlertConsultationPort,
  ) {}

  async createConsultation(
    actor: CareActor,
    alertId: string,
    input: {
      scheduledStartAt?: string;
      timezone?: string;
      expectedDurationMinutes?: number;
      followUpNote?: string;
      nextAction?: string;
    },
  ) {
    if (!Types.ObjectId.isValid(alertId) || !Types.ObjectId.isValid(actor.id)) {
      throw new HttpException(
        { code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    const alert = await this.alerts
      .findOne({
        _id: new Types.ObjectId(alertId),
        assignedDoctorId: new Types.ObjectId(actor.id),
        status: { $in: [CareAlertStatus.OPEN, CareAlertStatus.ACKNOWLEDGED] },
      })
      .lean()
      .exec();
    if (!alert) {
      throw new HttpException(
        {
          code: 'CARE_FORBIDDEN',
          message: 'Alert cannot be linked to a consultation',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const scheduledStartAt = input.scheduledStartAt
      ? new Date(input.scheduledStartAt)
      : undefined;
    if (scheduledStartAt && scheduledStartAt <= new Date()) {
      throw new HttpException(
        {
          code: 'CARE_CONSULTATION_SCHEDULE_INVALID',
          message: 'Scheduled consultation must be in the future',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!this.consultations) {
      throw new HttpException(
        {
          code: 'CARE_DEPENDENCY_UNAVAILABLE',
          message: 'Consultation capability is unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.consultations.createFromCareAlert({
      careAlertId: alertId,
      patientCareProgramId: String(alert.patientCareProgramId),
      patientId: String(alert.patientId),
      doctorId: actor.id,
      scheduledStartAt,
      timezone: input.timezone,
      expectedDurationMinutes: input.expectedDurationMinutes ?? 30,
      followUpNote: input.followUpNote,
      nextAction: input.nextAction,
    });
  }

  async createForEvaluation(
    evaluation: HealthEvaluationDocument,
    retry = 0,
  ): Promise<CareAlertDocument | null> {
    if (evaluation.severity === HealthEvaluationSeverity.NORMAL) return null;
    const enrollment = await this.enrollments
      .findById(evaluation.patientCareProgramId)
      .exec();
    if (!enrollment) return null;
    const rawStart = (evaluation.timeRange as Record<string, unknown>).startAt;
    const recordedAt = new Date(rawStart as string | Date);
    if (Number.isNaN(recordedAt.getTime()))
      throw new Error('Invalid evaluation time');
    const activeDeduplicationKey = `cc003a:${enrollment.id}:${evaluation.careRuleId}:${localDate(recordedAt, enrollment.timezone)}`;
    const session = await this.connection.startSession();
    try {
      let alert!: CareAlertDocument;
      await session.withTransaction(async () => {
        const applied = await this.audits
          .findOne({
            domain: 'care',
            entityType: 'careAlert',
            action: 'care_alert_evaluation_applied',
            'metadata.evaluationId': String(evaluation._id),
          })
          .session(session)
          .exec();
        if (applied?.entityId) {
          const recordedAlert = await this.alerts
            .findById(applied.entityId)
            .session(session)
            .exec();
          if (!recordedAlert)
            throw new Error('Applied evaluation alert is missing');
          alert = recordedAlert;
          return;
        }
        const legacy = await this.alerts
          .findOne({ evaluationId: evaluation._id })
          .session(session)
          .exec();
        if (legacy) {
          alert = legacy;
          return;
        }
        const existing = await this.alerts
          .findOne({ activeDeduplicationKey })
          .session(session)
          .exec();
        if (existing) {
          alert = existing;
          if (
            evaluation.severity === HealthEvaluationSeverity.URGENT &&
            existing.severity === HealthEvaluationSeverity.ATTENTION
          ) {
            const upgraded = await this.alerts
              .findOneAndUpdate(
                {
                  _id: existing._id,
                  activeDeduplicationKey,
                  revision: existing.revision,
                },
                {
                  $set: {
                    severity: HealthEvaluationSeverity.URGENT,
                    evaluationId: evaluation._id,
                    reasonCodes: evaluation.reasonCodes,
                  },
                  $inc: { revision: 1 },
                },
                { new: true, session },
              )
              .exec();
            if (!upgraded)
              throw new Error('Care alert changed during escalation');
            alert = upgraded;
            await this.audits.create(
              [
                {
                  domain: 'care',
                  entityType: 'careAlert',
                  entityId: alert._id,
                  action: 'care_alert_escalated',
                  metadata: {
                    severity: 'urgent',
                    evaluationId: String(evaluation._id),
                  },
                },
              ],
              { session },
            );
            await this.outbox.enqueue(
              {
                eventType: 'care.alert.escalated',
                aggregateType: 'careAlert',
                aggregateId: alert._id,
                idempotencyKey: `care.alert.escalated.${evaluation._id}`,
                payload: {
                  alertId: String(alert._id),
                  patientId: String(alert.patientId),
                  severity: 'urgent',
                  evaluationId: String(evaluation._id),
                },
              },
              session,
            );
            await this.outbox.enqueue(
              {
                eventType: 'care.alert.inbox-invalidated',
                aggregateType: 'careAlert',
                aggregateId: alert._id,
                idempotencyKey: `care.alert.inbox-invalidated.${alert._id}.${alert.revision}`,
                payload: {
                  userId: String(alert.assignedDoctorId),
                  action: 'care_alerts_invalidated',
                  alertId: String(alert._id),
                  revision: alert.revision,
                },
              },
              session,
            );
          }
          await this.audits.create(
            [
              {
                domain: 'care',
                entityType: 'careAlert',
                entityId: alert._id,
                action: 'care_alert_evaluation_applied',
                metadata: { evaluationId: String(evaluation._id) },
              },
            ],
            { session },
          );
          return;
        }
        alert = new this.alerts({
          patientCareProgramId: enrollment._id,
          evaluationId: evaluation._id,
          patientId: enrollment.patientId,
          assignedDoctorId: enrollment.doctorId,
          severity: evaluation.severity,
          reasonCodes: evaluation.reasonCodes,
          uniqueKey: `care.alert.evaluation.${evaluation._id}`,
          activeDeduplicationKey,
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
              action: 'care_alert_evaluation_applied',
              metadata: { evaluationId: String(evaluation._id) },
            },
          ],
          { session },
        );
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
        if (retry < 3) return this.createForEvaluation(evaluation, retry + 1);
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
        {
          code: 'CARE_ALERT_REVISION_CONFLICT',
          message: 'Alert was changed by another request',
        },
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
    const update =
      action === 'acknowledge'
        ? {
            status: CareAlertStatus.ACKNOWLEDGED,
            acknowledgedBy: actorId,
            acknowledgedAt: now,
          }
        : action === 'resolve'
          ? {
              status: CareAlertStatus.RESOLVED,
              acknowledgedBy: alert.acknowledgedBy ?? actorId,
              acknowledgedAt: alert.acknowledgedAt ?? now,
              resolvedBy: actorId,
              resolvedAt: now,
              resolutionNote: reason,
            }
          : {
              status: CareAlertStatus.DISMISSED,
              dismissedBy: actorId,
              dismissedAt: now,
              dismissalReason: reason,
            };
    const session = await this.connection.startSession();
    try {
      let updated!: CareAlertDocument;
      await session.withTransaction(async () => {
        const statuses =
          action === 'acknowledge'
            ? [CareAlertStatus.OPEN]
            : [CareAlertStatus.OPEN, CareAlertStatus.ACKNOWLEDGED];
        const found = await this.alerts
          .findOneAndUpdate(
            {
              _id: alert._id,
              assignedDoctorId: actorId,
              revision: expectedRevision,
              status: { $in: statuses },
            },
            {
              $set: update,
              $inc: { revision: 1 },
              ...(action !== 'acknowledge'
                ? { $unset: { activeDeduplicationKey: '' } }
                : {}),
            },
            { new: true, session },
          )
          .exec();
        if (!found)
          throw new HttpException(
            {
              code: 'CARE_ALERT_REVISION_CONFLICT',
              message: 'Alert was changed by another request',
            },
            HttpStatus.CONFLICT,
          );
        updated = found;
        const auditRows: Record<string, unknown>[] = [];
        if (action === 'resolve' && fromStatus === CareAlertStatus.OPEN)
          auditRows.push({
            domain: 'care',
            entityType: 'careAlert',
            entityId: updated._id,
            actorId,
            action: 'care_alert_acknowledged_implicitly',
            fromStatus: CareAlertStatus.OPEN,
            toStatus: CareAlertStatus.ACKNOWLEDGED,
            metadata: { revision: updated.revision },
          });
        auditRows.push({
          domain: 'care',
          entityType: 'careAlert',
          entityId: updated._id,
          actorId,
          action: `care_alert_${action}d`,
          fromStatus,
          toStatus: updated.status,
          reason,
          metadata: { revision: updated.revision },
        });
        await this.audits.create(auditRows, { session, ordered: true });
        await this.outbox.enqueue(
          {
            eventType: 'care.alert.inbox-invalidated',
            aggregateType: 'careAlert',
            aggregateId: updated._id,
            idempotencyKey: `care.alert.inbox-invalidated.${updated._id}.${updated.revision}`,
            payload: {
              userId: String(updated.assignedDoctorId),
              action: 'care_alerts_invalidated',
              alertId: String(updated._id),
              revision: updated.revision,
            },
          },
          session,
        );
      });
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async getAuditForAdmin(alertId: string) {
    if (!Types.ObjectId.isValid(alertId))
      throw new HttpException(
        { code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' },
        HttpStatus.NOT_FOUND,
      );
    return this.audits
      .find({
        domain: 'care',
        entityType: 'careAlert',
        entityId: new Types.ObjectId(alertId),
      })
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec();
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

  async listForDoctor(actor: CareActor, query: QueryDoctorCareAlertsDto) {
    if (!Types.ObjectId.isValid(actor.id))
      throw new HttpException(
        { code: 'CARE_FORBIDDEN', message: 'Invalid doctor identity' },
        HttpStatus.FORBIDDEN,
      );
    const { cursor, limit } = normalizeCursorRequest(query);
    const filter: Record<string, unknown> = {
      assignedDoctorId: new Types.ObjectId(actor.id),
    };
    if (query.status) filter.status = query.status;
    else
      filter.status = {
        $in: [CareAlertStatus.OPEN, CareAlertStatus.ACKNOWLEDGED],
      };
    if (query.severity) filter.severity = query.severity;
    if (cursor) {
      try {
        const parsed = decodeCursor(cursor);
        const [severity, detectedAt] = String(parsed.sortValue).split('|');
        if (!Types.ObjectId.isValid(parsed.id)) throw new InvalidCursorError();
        const id = new Types.ObjectId(parsed.id);
        const date = new Date(detectedAt);
        if (
          ![
            HealthEvaluationSeverity.ATTENTION,
            HealthEvaluationSeverity.URGENT,
          ].includes(severity as HealthEvaluationSeverity) ||
          (query.severity && severity !== query.severity) ||
          Number.isNaN(date.getTime())
        )
          throw new InvalidCursorError();
        filter.$or = query.severity
          ? [
              { detectedAt: { $lt: date } },
              { detectedAt: date, _id: { $lt: id } },
            ]
          : [
              { severity: { $lt: severity } },
              { severity, detectedAt: { $lt: date } },
              { severity, detectedAt: date, _id: { $lt: id } },
            ];
      } catch (error) {
        if (error instanceof InvalidCursorError)
          throw new HttpException(
            {
              code: 'CARE_ALERT_CURSOR_INVALID',
              message: 'Invalid alert cursor',
            },
            HttpStatus.BAD_REQUEST,
          );
        throw error;
      }
    }
    const rows = await this.alerts
      .find(filter)
      .select(
        '_id patientCareProgramId patientId evaluationId severity status reasonCodes detectedAt revision',
      )
      .sort({ severity: -1, detectedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    return {
      items,
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeCursor({
              sortValue: `${last.severity}|${last.detectedAt.toISOString()}`,
              id: String(last._id),
            })
          : null,
    };
  }

  async getForDoctor(actor: CareActor, alertId: string) {
    if (!Types.ObjectId.isValid(actor.id) || !Types.ObjectId.isValid(alertId))
      throw new HttpException(
        { code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' },
        HttpStatus.NOT_FOUND,
      );
    const alert = await this.alerts
      .findOne({
        _id: new Types.ObjectId(alertId),
        assignedDoctorId: new Types.ObjectId(actor.id),
      })
      .select(
        '_id patientCareProgramId patientId evaluationId severity status reasonCodes detectedAt revision acknowledgedAt resolvedAt dismissedAt',
      )
      .lean()
      .exec();
    if (!alert)
      throw new HttpException(
        { code: 'CARE_ALERT_NOT_FOUND', message: 'Alert not found' },
        HttpStatus.NOT_FOUND,
      );
    const evaluation = await this.evaluations
      .findById(alert.evaluationId)
      .select(
        '_id careRuleId severity reasonCodes inputData timeRange evaluatedAt replacesEvaluationId',
      )
      .lean()
      .exec();
    const timeline = await this.audits
      .find({
        domain: 'care',
        entityType: 'careAlert',
        entityId: alert._id,
      })
      .select('action fromStatus toStatus reason actorId createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .lean()
      .exec();
    const actions =
      alert.status === CareAlertStatus.OPEN
        ? ['acknowledge', 'resolve', 'dismiss']
        : alert.status === CareAlertStatus.ACKNOWLEDGED
          ? ['resolve', 'dismiss']
          : [];
    return { ...alert, evaluation, timeline, allowedActions: actions };
  }
}
