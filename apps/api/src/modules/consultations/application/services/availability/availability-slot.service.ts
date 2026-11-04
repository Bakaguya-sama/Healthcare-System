import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types, mongo } from 'mongoose';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../../core/domain/user.enums';
import { UsersService } from '../../../../users/public-api';
import { BookingException } from '../../errors/booking.exception';
import {
  AvailabilitySlot,
  AvailabilitySlotDocument,
  AvailabilitySlotLock,
  AvailabilitySlotStatus,
} from '../../../domain/entities/availability/availability-slot.entity';
import {
  CreateAvailabilitySlotDto,
  QueryAvailableSlotDto,
  QueryAvailabilitySlotDto,
  UpdateAvailabilitySlotDto,
} from '../../../presentation/dto/availability/availability-slot.dto';
import { BookingPolicyService } from '../consultations/booking-policy';

const SLOT_PROJECTION =
  '_id doctorId startAt endAt timezone status blockedAt blockedBy blockReason createdAt updatedAt';
const MAX_QUERY_DAYS = 93;

@Injectable()
export class AvailabilitySlotService {
  constructor(
    @InjectModel(AvailabilitySlot.name)
    private readonly slots: Model<AvailabilitySlotDocument>,
    @InjectModel(AvailabilitySlotLock.name)
    private readonly locks: Model<AvailabilitySlotLock>,
    private readonly users: UsersService,
    private readonly policy: BookingPolicyService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(doctorId: string, dto: CreateAvailabilitySlotDto) {
    await this.assertApprovedDoctor(doctorId);
    const policy = this.policy.getScheduledPolicy();
    const range = this.validateRange(dto.startAt, dto.endAt, dto.timezone);
    this.assertNotice(range.startAt, policy.minNoticeMinutes);

    const item = await this.inTransaction(async (session) => {
      await this.fence(doctorId, session);
      await this.assertNoOverlap(
        doctorId,
        range.startAt,
        range.endAt,
        policy.bufferMinutes,
        session,
      );
      const created = new this.slots({
        doctorId: new Types.ObjectId(doctorId),
        ...range,
        status: AvailabilitySlotStatus.AVAILABLE,
      });
      try {
        return await created.save({ session });
      } catch (error: unknown) {
        if (this.isDuplicateKey(error)) this.throwOverlap();
        throw error;
      }
    });
    return this.response(item, 201);
  }

  async listMine(doctorId: string, query: QueryAvailabilitySlotDto) {
    const { from, to } = this.validateQueryRange(query.from, query.to);
    await this.expirePastSlots(doctorId);
    const filter: Record<string, unknown> = {
      doctorId: new Types.ObjectId(doctorId),
      startAt: { $gte: from, $lt: to },
    };
    if (query.status) filter.status = query.status;
    return this.findPage(filter, query);
  }

  async listAvailable(doctorId: string, query: QueryAvailableSlotDto) {
    const policy = this.policy.getScheduledPolicy();
    const { from, to } = this.validateQueryRange(query.from, query.to);
    await this.assertApprovedDoctor(doctorId);
    await this.expirePastSlots(doctorId);
    const threshold = new Date(Date.now() + policy.minNoticeMinutes * 60_000);
    return this.findPage(
      {
        doctorId: new Types.ObjectId(doctorId),
        status: AvailabilitySlotStatus.AVAILABLE,
        startAt: {
          $gte: new Date(Math.max(from.getTime(), threshold.getTime())),
          $lt: to,
        },
      },
      query,
    );
  }

  async update(doctorId: string, id: string, dto: UpdateAvailabilitySlotDto) {
    this.assertId(id, 'slot');
    const policy = this.policy.getScheduledPolicy();
    const item = await this.inTransaction(async (session) => {
      const current = await this.slots.findById(id).session(session);
      if (!current) throw new NotFoundException('Availability slot not found');
      this.assertOwner(current, doctorId);
      this.assertMutable(current);
      const range = this.validateRange(
        dto.startAt ?? current.startAt.toISOString(),
        dto.endAt ?? current.endAt.toISOString(),
        dto.timezone ?? current.timezone,
      );
      this.assertNotice(range.startAt, policy.minNoticeMinutes);
      await this.fence(doctorId, session);
      await this.assertNoOverlap(
        doctorId,
        range.startAt,
        range.endAt,
        policy.bufferMinutes,
        session,
        current._id,
      );
      current.set(range);
      try {
        return await current.save({ session });
      } catch (error: unknown) {
        if (this.isDuplicateKey(error)) this.throwOverlap();
        throw error;
      }
    });
    return this.response(item);
  }

  async block(doctorId: string, id: string, reason: string) {
    this.assertId(id, 'slot');
    const item = await this.slots.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        doctorId: new Types.ObjectId(doctorId),
        status: AvailabilitySlotStatus.AVAILABLE,
      },
      {
        $set: {
          status: AvailabilitySlotStatus.BLOCKED,
          blockedAt: new Date(),
          blockedBy: new Types.ObjectId(doctorId),
          blockReason: reason,
        },
      },
      { returnDocument: 'after' },
    );
    if (item) return this.response(item);
    await this.throwOwnedSlotConflict(doctorId, id);
  }

  async remove(doctorId: string, id: string) {
    this.assertId(id, 'slot');
    const deleted = await this.slots.findOneAndDelete({
      _id: new Types.ObjectId(id),
      doctorId: new Types.ObjectId(doctorId),
      status: {
        $in: [AvailabilitySlotStatus.AVAILABLE, AvailabilitySlotStatus.BLOCKED],
      },
    });
    if (deleted) return;
    await this.throwOwnedSlotConflict(doctorId, id);
  }

  async reopenAfterCancellation(
    slotId: Types.ObjectId,
    consultationId: Types.ObjectId,
    session: ClientSession,
  ) {
    const startInFuture = new Date();
    const slot = await this.slots.findOneAndUpdate(
      { _id: slotId, status: AvailabilitySlotStatus.BOOKED },
      [
        {
          $set: {
            status: {
              $cond: [
                { $gt: ['$startAt', startInFuture] },
                AvailabilitySlotStatus.AVAILABLE,
                AvailabilitySlotStatus.EXPIRED,
              ],
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', session, updatePipeline: true },
    );
    if (!slot) {
      throw new BookingException(
        HttpStatus.CONFLICT,
        'SLOT_STATE_CONFLICT',
        'Booked slot could not be released',
        { consultationId: String(consultationId) },
      );
    }
  }

  private async assertNoOverlap(
    doctorId: string,
    startAt: Date,
    endAt: Date,
    bufferMinutes: number,
    session: ClientSession,
    excludeId?: Types.ObjectId,
  ) {
    const bufferMs = bufferMinutes * 60_000;
    const overlap = await this.slots
      .findOne({
        doctorId: new Types.ObjectId(doctorId),
        status: {
          $in: [
            AvailabilitySlotStatus.AVAILABLE,
            AvailabilitySlotStatus.BOOKED,
          ],
        },
        startAt: { $lt: new Date(endAt.getTime() + bufferMs) },
        endAt: { $gt: new Date(startAt.getTime() - bufferMs) },
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
      .session(session)
      .select('_id')
      .lean()
      .exec();
    if (overlap) this.throwOverlap();
  }

  private async fence(doctorId: string, session: ClientSession) {
    await this.locks.findOneAndUpdate(
      { doctorId: new Types.ObjectId(doctorId) },
      { $inc: { revision: 1 } },
      {
        upsert: true,
        returnDocument: 'after',
        session,
        setDefaultsOnInsert: true,
      },
    );
  }

  private validateRange(start: string, end: string, timezone: string) {
    const startAt = new Date(start);
    const endAt = new Date(end);
    if (endAt <= startAt) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_SLOT_RANGE',
        'Slot endAt must be after startAt',
      );
    }
    if (!this.isIanaTimezone(timezone)) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_TIMEZONE',
        'timezone must be a valid IANA timezone',
      );
    }
    return { startAt, endAt, timezone };
  }

  private validateQueryRange(fromValue: string, toValue: string) {
    const from = new Date(fromValue);
    const to = new Date(toValue);
    if (
      to <= from ||
      to.getTime() - from.getTime() > MAX_QUERY_DAYS * 86_400_000
    ) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_QUERY_RANGE',
        `Slot query range must be positive and no longer than ${MAX_QUERY_DAYS} days`,
      );
    }
    return { from, to };
  }

  private assertNotice(startAt: Date, minNoticeMinutes: number) {
    if (startAt.getTime() <= Date.now()) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'SLOT_IN_PAST',
        'Slot startAt must be in the future',
      );
    }
    if (startAt.getTime() < Date.now() + minNoticeMinutes * 60_000) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MIN_NOTICE_NOT_MET',
        'Slot does not meet the configured minimum notice',
        { minNoticeMinutes },
      );
    }
  }

  private async assertApprovedDoctor(doctorId: string) {
    this.assertId(doctorId, 'doctor');
    const doctor = await this.users.findById(doctorId);
    if (
      doctor.role !== UserRole.DOCTOR ||
      doctor.accountStatus !== AccountStatus.ACTIVE ||
      doctor.doctorProfile?.verificationStatus !==
        DoctorVerificationStatus.APPROVED
    ) {
      throw new ForbiddenException({
        code: 'DOCTOR_NOT_APPROVED',
        message: 'Only an active approved doctor can manage availability',
      });
    }
  }

  private assertOwner(slot: AvailabilitySlotDocument, doctorId: string) {
    if (!slot.doctorId.equals(new Types.ObjectId(doctorId))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Doctor does not own this availability slot',
      });
    }
  }

  private assertMutable(slot: AvailabilitySlotDocument) {
    if (slot.status !== AvailabilitySlotStatus.AVAILABLE) {
      throw new BookingException(
        HttpStatus.CONFLICT,
        'SLOT_NOT_MUTABLE',
        'Only an available slot can be updated',
      );
    }
  }

  private async throwOwnedSlotConflict(
    doctorId: string,
    id: string,
  ): Promise<never> {
    const slot = await this.slots.findById(id).select('doctorId status').lean();
    if (!slot) throw new NotFoundException('Availability slot not found');
    if (!slot.doctorId.equals(new Types.ObjectId(doctorId))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Doctor does not own this availability slot',
      });
    }
    throw new BookingException(
      HttpStatus.CONFLICT,
      'SLOT_NOT_MUTABLE',
      `Slot cannot be changed from status ${slot.status}`,
    );
  }

  private async expirePastSlots(doctorId: string) {
    await this.slots.updateMany(
      {
        doctorId: new Types.ObjectId(doctorId),
        status: AvailabilitySlotStatus.AVAILABLE,
        startAt: { $lte: new Date() },
      },
      { $set: { status: AvailabilitySlotStatus.EXPIRED } },
    );
  }

  private async findPage(
    filter: Record<string, unknown>,
    query: QueryAvailableSlotDto,
  ) {
    const sortOrder = query.sortOrder;
    const [items, total] = await Promise.all([
      this.slots
        .find(filter)
        .select(SLOT_PROJECTION)
        .sort({ startAt: sortOrder, _id: sortOrder })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.slots.countDocuments(filter),
    ]);
    return {
      data: items.map((item) =>
        this.serialize(item as unknown as Record<string, unknown>),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  private throwOverlap(): never {
    throw new BookingException(
      HttpStatus.CONFLICT,
      'SLOT_OVERLAP',
      'Slot overlaps another active slot or its configured buffer',
    );
  }

  private isDuplicateKey(error: unknown) {
    return error instanceof mongo.MongoServerError && error.code === 11000;
  }

  private isIanaTimezone(value: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }

  private assertId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BookingException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        `Invalid ${label} ID`,
      );
    }
  }

  private response(item: AvailabilitySlotDocument, statusCode = 200) {
    return {
      statusCode,
      data: this.serialize(
        item.toObject() as unknown as Record<string, unknown>,
      ),
    };
  }

  private serialize(item: Record<string, unknown>) {
    const { _id, __v: _version, ...safe } = item;
    void _version;
    return { id: String(_id), ...safe };
  }

  private async inTransaction<T>(
    execute: (session: ClientSession) => Promise<T>,
  ) {
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await execute(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
