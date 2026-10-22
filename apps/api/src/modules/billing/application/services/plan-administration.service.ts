import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  Plan,
  PlanDocument,
  PlanStatus,
} from '../../domain/entities/plan.entity';
import { AuditLog } from '../../../platform-audit/public-api';

export type PlanDraftInput = Pick<
  Plan,
  | 'code'
  | 'name'
  | 'description'
  | 'price'
  | 'currency'
  | 'durationDays'
  | 'aiRequestLimit'
  | 'aiTokenLimit'
  | 'aiQuotaPeriod'
  | 'consultationLimitPerCycle'
  | 'activeCareProgramLimit'
  | 'benefits'
  | 'refundPolicy'
>;
@Injectable()
export class PlanAdministrationService {
  constructor(
    @InjectModel(Plan.name) private readonly plans: Model<PlanDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
  ) {}
  async createDraft(adminId: string, input: PlanDraftInput) {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(code))
      throw new BadRequestException('Invalid plan code');
    return this.connection.transaction(async (session) => {
      const latest = await this.plans
        .findOne({ code })
        .sort({ version: -1 })
        .session(session)
        .lean();
      const [plan] = await this.plans.create(
        [
          {
            ...input,
            code,
            version: (latest?.version ?? 0) + 1,
            status: PlanStatus.DRAFT,
            createdBy: new Types.ObjectId(adminId),
          },
        ],
        { session },
      );
      await this.audit(plan, adminId, 'plan_draft_created', session);
      return plan;
    });
  }
  async publish(adminId: string, planId: string) {
    this.id(planId);
    return this.connection.transaction(async (session) => {
      const plan = await this.plans
        .findOne({ _id: planId, status: PlanStatus.DRAFT })
        .session(session);
      if (!plan) throw new NotFoundException('Draft plan not found');
      const now = new Date();
      await this.plans.updateMany(
        { code: plan.code, status: PlanStatus.PUBLISHED },
        {
          $set: {
            status: PlanStatus.RETIRED,
            retiredAt: now,
            retiredBy: new Types.ObjectId(adminId),
          },
        },
        { session },
      );
      plan.status = PlanStatus.PUBLISHED;
      plan.publishedAt = now;
      plan.publishedBy = new Types.ObjectId(adminId);
      plan.effectiveFrom = now;
      await plan.save({ session });
      await this.audit(plan, adminId, 'plan_published', session);
      return plan;
    });
  }
  async retire(adminId: string, planId: string) {
    this.id(planId);
    return this.connection.transaction(async (session) => {
      const plan = await this.plans
        .findOne({ _id: planId, status: PlanStatus.PUBLISHED })
        .session(session);
      if (!plan) throw new NotFoundException('Published plan not found');
      if (plan.code === 'FREE')
        throw new BadRequestException(
          'FREE plan must be replaced by publishing a newer draft',
        );
      plan.status = PlanStatus.RETIRED;
      plan.retiredAt = new Date();
      plan.retiredBy = new Types.ObjectId(adminId);
      await plan.save({ session });
      await this.audit(plan, adminId, 'plan_retired', session);
      return plan;
    });
  }
  list() {
    return this.plans.find().sort({ code: 1, version: -1 }).lean().exec();
  }
  async deployDefaultPlans(adminId: string) {
    const created: PlanDocument[] = [];
    for (const input of DEFAULT_PLAN_ARTIFACTS) {
      const existing = await this.plans
        .findOne({ code: input.code, status: PlanStatus.PUBLISHED })
        .exec();
      if (existing) {
        created.push(existing);
        continue;
      }
      const draft = await this.createDraft(adminId, input);
      created.push(await this.publish(adminId, String(draft._id)));
    }
    return created;
  }
  private id(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException('Invalid plan ID');
  }
  private async audit(
    plan: PlanDocument,
    adminId: string,
    action: string,
    session: import('mongoose').ClientSession,
  ) {
    await this.audits.create(
      [
        {
          domain: 'billing',
          entityType: 'Plan',
          entityId: plan._id,
          actorId: new Types.ObjectId(adminId),
          action,
          metadata: { code: plan.code, version: plan.version },
        },
      ],
      { session },
    );
  }
}

const DEFAULT_PLAN_ARTIFACTS: PlanDraftInput[] = [
  {
    code: 'FREE',
    name: 'Free',
    price: 0,
    currency: 'VND',
    durationDays: 30,
    aiRequestLimit: 10,
    aiTokenLimit: 25_000,
    aiQuotaPeriod: 'day',
    consultationLimitPerCycle: 1,
    activeCareProgramLimit: 1,
    benefits: { weeklyAiSummary: false },
    refundPolicy: { version: 'v1', refundType: 'none' },
  },
  {
    code: 'PLUS',
    name: 'Plus',
    price: 99000,
    currency: 'VND',
    durationDays: 30,
    aiRequestLimit: 40,
    aiTokenLimit: 120_000,
    aiQuotaPeriod: 'day',
    consultationLimitPerCycle: 3,
    activeCareProgramLimit: 3,
    benefits: { weeklyAiSummary: true, summaryTokenBudget: 15_000 },
    refundPolicy: { version: 'v1', refundType: 'full_only' },
  },
  {
    code: 'CARE',
    name: 'Care',
    price: 199000,
    currency: 'VND',
    durationDays: 30,
    aiRequestLimit: 80,
    aiTokenLimit: 250_000,
    aiQuotaPeriod: 'day',
    consultationLimitPerCycle: 6,
    activeCareProgramLimit: 6,
    benefits: {
      weeklyAiSummary: true,
      summaryTokenBudget: 30_000,
      doctorReview: true,
    },
    refundPolicy: { version: 'v1', refundType: 'full_only' },
  },
];
