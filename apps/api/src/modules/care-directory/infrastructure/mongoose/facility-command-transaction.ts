import { ConflictException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Connection, Model, Types } from 'mongoose';
import { AuditLog } from '../../../platform-audit/public-api';
import {
  FacilityCommandReceipt,
  FacilityCommandReceiptDocument,
} from './facility-command-receipt.schema';

export interface FacilityAuditDraft {
  entityType: string;
  entityId?: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

@Injectable()
export class FacilityCommandTransaction {
  constructor(
    @InjectModel(FacilityCommandReceipt.name)
    private readonly receipts: Model<FacilityCommandReceiptDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findReplay<T>(input: {
    actorId: string;
    operation: string;
    key: string;
    request: unknown;
  }): Promise<T | null> {
    if (!Types.ObjectId.isValid(input.actorId))
      throw new ConflictException('INVALID_ACTOR');
    const receipt = await this.receipts
      .findOne({
        actorId: new Types.ObjectId(input.actorId),
        operation: input.operation,
        keyHash: hash(input.key),
      })
      .lean()
      .exec();
    return receipt
      ? this.readReplay<T>(receipt, hash(canonicalJson(input.request)))
      : null;
  }

  async run<T extends object>(input: {
    actorId: string;
    operation: string;
    key: string;
    request: unknown;
    work: (
      session: import('mongoose').ClientSession,
    ) => Promise<{ result: T; audits: FacilityAuditDraft[] }>;
  }): Promise<T> {
    if (!Types.ObjectId.isValid(input.actorId))
      throw new ConflictException('INVALID_ACTOR');
    const scope = {
      actorId: new Types.ObjectId(input.actorId),
      operation: input.operation,
      keyHash: hash(input.key),
    };
    const fingerprint = hash(canonicalJson(input.request));
    try {
      return await this.connection.transaction(async (session) => {
        const replay = await this.receipts
          .findOne(scope)
          .session(session)
          .lean()
          .exec();
        if (replay) return this.readReplay<T>(replay, fingerprint);
        const outcome = await input.work(session);
        if (outcome.audits.length) {
          await this.audits.create(
            outcome.audits.map((audit) => ({
              domain: 'facility',
              entityType: audit.entityType,
              ...(audit.entityId && Types.ObjectId.isValid(audit.entityId)
                ? { entityId: new Types.ObjectId(audit.entityId) }
                : {}),
              actorId: new Types.ObjectId(input.actorId),
              action: audit.action,
              fromStatus: audit.fromStatus,
              toStatus: audit.toStatus,
              reason: audit.reason,
              metadata: audit.metadata,
            })),
            { session, ordered: true },
          );
        }
        await this.receipts.create(
          [
            {
              ...scope,
              fingerprint,
              result: outcome.result as Record<string, unknown>,
              expiresAt: new Date(Date.now() + 7 * 86_400_000),
            },
          ],
          { session },
        );
        return outcome.result;
      });
    } catch (error) {
      if (isDuplicateOrWriteConflict(error)) {
        const replay = await this.receipts.findOne(scope).lean().exec();
        if (replay) return this.readReplay<T>(replay, fingerprint);
        if ((error as { code?: number }).code === 11000)
          throw new ConflictException('CARE_DIRECTORY_UNIQUE_CONFLICT');
        throw new ConflictException('CARE_DIRECTORY_WRITE_CONFLICT');
      }
      throw error;
    }
  }

  private readReplay<T>(
    receipt: { fingerprint: string; result: unknown },
    fingerprint: string,
  ): T {
    if (receipt.fingerprint !== fingerprint)
      throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
    return receipt.result as T;
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
function isDuplicateOrWriteConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: number; codeName?: string };
  return (
    record.code === 11000 ||
    record.code === 112 ||
    record.codeName === 'WriteConflict'
  );
}
