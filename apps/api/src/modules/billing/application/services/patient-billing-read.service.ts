import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { PageResult } from '../../../../common/pagination';
import {
  Plan,
  PlanDocument,
  PlanSnapshot,
  PlanStatus,
} from '../../domain/entities/plan.entity';
import {
  Subscription,
  SubscriptionDocument,
} from '../../domain/entities/subscription.entity';
import type {
  QueryPatientSubscriptionsDto,
  QueryPublishedPlansDto,
} from '../../presentation/dto/patient-billing-read.dto';
import { FreeSubscriptionGrantService } from './free-subscription-grant.service';

type PlainPlan = Record<string, unknown> & { _id: Types.ObjectId };
type PlainSubscription = Record<string, unknown> & {
  _id: Types.ObjectId;
  planId: Types.ObjectId;
};

const BOOLEAN_BENEFITS = [
  'weeklyAiSummary',
  'smartReminder',
  'medicationReminder',
  'doctorReview',
  'priorityInbox',
  'followUp',
  'facilitySearch',
] as const;
const ARRAY_BENEFITS = {
  reports: new Set(['weekly', 'thirty_day', 'ninety_day']),
  exports: new Set(['pdf', 'csv']),
} as const;
const INTEGER_BENEFITS = ['familyLinkLimit', 'summaryTokenBudget'] as const;

@Injectable()
export class PatientBillingReadService {
  constructor(
    @InjectModel(Plan.name) private readonly plans: Model<PlanDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<SubscriptionDocument>,
    private readonly grants: FreeSubscriptionGrantService,
  ) {}

  async listPublishedPlans(query: QueryPublishedPlansDto, now = new Date()) {
    const filter = this.publishedPlanFilter(now);
    const sort = { [query.sortBy]: query.sortOrder, _id: query.sortOrder };
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.plans
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.plans.countDocuments(filter).exec(),
    ]);
    return this.page(
      rows.map((row) => this.planProjection(row as unknown as PlainPlan)),
      query,
      total,
    );
  }

  async getPublishedPlan(id: string, now = new Date()) {
    const objectId = this.objectId(id, 'BILLING_PLAN_NOT_FOUND');
    const row = await this.plans
      .findOne({ _id: objectId, ...this.publishedPlanFilter(now) })
      .lean()
      .exec();
    if (!row)
      this.notFound('BILLING_PLAN_NOT_FOUND', 'Published Plan not found');
    return this.planProjection(row as unknown as PlainPlan);
  }

  async listPatientSubscriptions(
    patientId: string,
    query: QueryPatientSubscriptionsDto,
    now = new Date(),
  ) {
    const userId = this.objectId(patientId, 'BILLING_FORBIDDEN');
    const effective = await this.grants.getEffectiveSubscription(
      patientId,
      now,
    );
    const filter: Record<string, unknown> = { userId };
    if (query.status) filter.status = query.status;
    const sort = { [query.sortBy]: query.sortOrder, _id: query.sortOrder };
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.subscriptions
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.subscriptions.countDocuments(filter).exec(),
    ]);
    const page = this.page(
      rows.map((row) =>
        this.subscriptionProjection(row as unknown as PlainSubscription),
      ),
      query,
      total,
    );
    return {
      effective: effective
        ? this.subscriptionProjection(
            effective.toObject() as unknown as PlainSubscription,
          )
        : null,
      ...page,
    };
  }

  async getPatientUsage(patientId: string, now = new Date()) {
    this.objectId(patientId, 'BILLING_FORBIDDEN');
    const subscription = await this.grants.getEffectiveSubscription(
      patientId,
      now,
    );
    if (!subscription)
      this.notFound(
        'BILLING_SUBSCRIPTION_NOT_FOUND',
        'Current Subscription not found',
      );
    const snapshot = this.validSnapshot(subscription.planSnapshot);
    const limit = snapshot.consultationLimitPerCycle;
    const reserved = this.nonNegativeInteger(
      subscription.consultationUsageReserved,
    );
    const counted = this.nonNegativeInteger(
      subscription.consultationUsageCounted,
    );
    if (reserved === null || counted === null || reserved + counted > limit)
      this.unavailable('Consultation usage counters are inconsistent');
    return {
      subscriptionId: String(subscription._id),
      cycle: this.cycleProjection(
        subscription.toObject() as unknown as Record<string, unknown>,
      ),
      consultations: {
        limit,
        counted,
        reserved,
        available: limit - counted - reserved,
        unlimited: false,
      },
      asOf: now.toISOString(),
    };
  }

  private publishedPlanFilter(now: Date) {
    return {
      status: PlanStatus.PUBLISHED,
      $and: [
        {
          $or: [
            { effectiveFrom: { $exists: false } },
            { effectiveFrom: { $lte: now } },
          ],
        },
        {
          $or: [
            { effectiveUntil: { $exists: false } },
            { effectiveUntil: { $gt: now } },
          ],
        },
      ],
    };
  }

  private planProjection(plan: PlainPlan) {
    return {
      id: String(plan._id),
      code: String(plan.code),
      version: Number(plan.version),
      name: String(plan.name),
      ...(typeof plan.description === 'string'
        ? { description: plan.description }
        : {}),
      price: Number(plan.price),
      currency: String(plan.currency),
      durationDays: Number(plan.durationDays),
      quota: {
        aiRequestLimit: Number(plan.aiRequestLimit),
        aiTokenLimit: Number(plan.aiTokenLimit),
        aiQuotaPeriod: plan.aiQuotaPeriod,
        consultationLimitPerCycle: Number(plan.consultationLimitPerCycle),
        activeCareProgramLimit: Number(plan.activeCareProgramLimit),
        familyLinkLimit: Number(plan.familyLinkLimit ?? 0),
      },
      benefits: this.safeBenefits(plan.benefits),
      available: true,
      purchasable: Number(plan.price) > 0 && plan.currency === 'VND',
      ...(this.iso(plan.effectiveFrom)
        ? { effectiveFrom: this.iso(plan.effectiveFrom) }
        : {}),
      ...(this.iso(plan.effectiveUntil)
        ? { effectiveUntil: this.iso(plan.effectiveUntil) }
        : {}),
    };
  }

  private subscriptionProjection(subscription: PlainSubscription) {
    const snapshot = this.validSnapshot(subscription.planSnapshot);
    const next = this.optionalSnapshot(subscription.nextPlanSnapshot);
    const updatedAt = this.iso(subscription.updatedAt);
    if (!updatedAt) this.unavailable('Subscription timestamp is unavailable');
    return {
      subscriptionId: String(subscription._id),
      status: subscription.status,
      plan: {
        id: String(subscription.planId),
        code: snapshot.code,
        version: snapshot.version,
        name: snapshot.name,
      },
      cycle: this.cycleProjection(subscription),
      entitlement: {
        aiRequestLimit: snapshot.aiRequestLimit,
        aiTokenLimit: snapshot.aiTokenLimit,
        aiQuotaPeriod: snapshot.aiQuotaPeriod,
        consultationLimitPerCycle: snapshot.consultationLimitPerCycle,
        activeCareProgramLimit: snapshot.activeCareProgramLimit,
        familyLinkLimit: snapshot.familyLinkLimit,
        benefits: this.safeBenefits(snapshot.benefits),
      },
      startedAt: this.requiredIso(subscription.startedAt),
      expiresAt: this.requiredIso(subscription.expiresAt),
      ...(next && this.iso(subscription.nextPlanStartsAt)
        ? {
            renewal: {
              id: String(subscription.nextPlanId),
              code: next.code,
              version: next.version,
              name: next.name,
              effectiveAt: this.requiredIso(subscription.nextPlanStartsAt),
            },
          }
        : {}),
      updatedAt,
    };
  }

  private cycleProjection(subscription: Record<string, unknown>) {
    const cycleNumber = this.nonNegativeInteger(subscription.cycleNumber);
    if (cycleNumber === null || cycleNumber < 1)
      this.unavailable('Subscription cycle is unavailable');
    return {
      number: cycleNumber,
      startedAt: this.requiredIso(subscription.currentPeriodStart),
      endsAt: this.requiredIso(subscription.currentPeriodEnd),
    };
  }

  private validSnapshot(value: unknown): PlanSnapshot {
    if (!this.isRecord(value)) this.unavailable('Plan snapshot is unavailable');
    const snapshot = value as unknown as PlanSnapshot;
    const integers = [
      snapshot.version,
      snapshot.durationDays,
      snapshot.aiRequestLimit,
      snapshot.aiTokenLimit,
      snapshot.consultationLimitPerCycle,
      snapshot.activeCareProgramLimit,
      snapshot.familyLinkLimit,
    ];
    if (
      typeof snapshot.code !== 'string' ||
      typeof snapshot.name !== 'string' ||
      !integers.every(
        (item) => Number.isSafeInteger(item) && Number(item) >= 0,
      ) ||
      !['day', 'subscription_cycle'].includes(snapshot.aiQuotaPeriod) ||
      !this.isRecord(snapshot.benefits)
    )
      this.unavailable('Plan snapshot is invalid');
    return snapshot;
  }

  private optionalSnapshot(value: unknown): PlanSnapshot | null {
    return value === undefined || value === null
      ? null
      : this.validSnapshot(value);
  }

  private safeBenefits(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) return {};
    const output: Record<string, unknown> = {};
    for (const key of BOOLEAN_BENEFITS)
      if (typeof value[key] === 'boolean') output[key] = value[key];
    for (const key of INTEGER_BENEFITS) {
      const item = value[key];
      if (Number.isSafeInteger(item) && Number(item) >= 0) output[key] = item;
    }
    for (const [key, allowed] of Object.entries(ARRAY_BENEFITS)) {
      const items = value[key];
      if (
        Array.isArray(items) &&
        items.every(
          (item) => typeof item === 'string' && allowed.has(item as never),
        )
      )
        output[key] = [...new Set(items)];
    }
    return output;
  }

  private page<T>(
    items: T[],
    query: { page: number; limit: number },
    total: number,
  ): PageResult<T> {
    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private objectId(value: string, code: string) {
    if (!Types.ObjectId.isValid(value))
      this.notFound(code, 'Resource not found');
    return new Types.ObjectId(value);
  }

  private requiredIso(value: unknown): string {
    const iso = this.iso(value);
    if (!iso) this.unavailable('Billing timestamp is unavailable');
    return iso;
  }

  private iso(value: unknown): string | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime()))
      return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return undefined;
  }

  private nonNegativeInteger(value: unknown): number | null {
    return Number.isSafeInteger(value) && Number(value) >= 0
      ? Number(value)
      : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private notFound(code: string, message: string): never {
    throw new HttpException({ code, message }, HttpStatus.NOT_FOUND);
  }

  private unavailable(message: string): never {
    throw new HttpException(
      { code: 'BILLING_PROJECTION_UNAVAILABLE', message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
