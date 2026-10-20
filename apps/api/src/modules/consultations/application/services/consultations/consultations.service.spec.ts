import { Types } from 'mongoose';
import { ConsultationsService } from './consultations.service';
import {
  ConsultationMode,
  ConsultationQuotaPolicy,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';

describe('ConsultationsService state machine', () => {
  function createService() {
    const patientId = new Types.ObjectId();
    const doctorId = new Types.ObjectId();
    const consultation = {
      _id: new Types.ObjectId(),
      patientId,
      doctorId,
      requestStatus: ConsultationRequestStatus.PENDING,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      interruptionReason: undefined as string | undefined,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn(function (this: unknown) {
        return this;
      }),
    };
    const model = {
      findById: jest.fn().mockImplementation(() => {
        const query = Promise.resolve(consultation) as Promise<
          typeof consultation
        > & { session: () => Promise<typeof consultation> };
        query.session = () => Promise.resolve(consultation);
        return query;
      }),
      create: jest.fn().mockResolvedValue(consultation),
    };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const users = {
      findById: jest.fn().mockResolvedValue({ fullName: 'Patient' }),
    };
    const usage = {
      prepare: jest.fn().mockResolvedValue(undefined),
      reserve: jest
        .fn()
        .mockResolvedValue({ status: 'reserved', created: true }),
      count: jest.fn().mockResolvedValue('counted'),
      release: jest.fn().mockResolvedValue('released'),
    };
    const session = {
      withTransaction: async (fn: () => Promise<void>) => fn(),
      endSession: jest.fn(),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(session) };
    return {
      service: new ConsultationsService(
        model as never,
        notifications as never,
        users as never,
        usage as never,
        connection as never,
      ),
      consultation,
      patientId,
      doctorId,
      usage,
    };
  }

  it('moves pending request through accept, start and complete', async () => {
    const { service, consultation, doctorId } = createService();

    await service.accept(doctorId.toString(), consultation._id.toString());
    expect(consultation.requestStatus).toBe(ConsultationRequestStatus.ACCEPTED);
    expect(consultation.sessionStatus).toBe(ConsultationSessionStatus.WAITING);

    await service.start(doctorId.toString(), consultation._id.toString());
    expect(consultation.sessionStatus).toBe(
      ConsultationSessionStatus.IN_CONSULTATION,
    );

    await service.complete(
      doctorId.toString(),
      consultation._id.toString(),
      {} as never,
    );
    expect(consultation.sessionStatus).toBe(
      ConsultationSessionStatus.COMPLETED,
    );
  });

  it('does not allow start before doctor accepts the request', async () => {
    const { service, consultation, doctorId } = createService();
    await expect(
      service.start(doctorId.toString(), consultation._id.toString()),
    ).rejects.toThrow('Consultation must be accepted before starting');
  });

  it('records cancellation of an active call as interrupted', async () => {
    const { service, consultation, doctorId } = createService();
    consultation.requestStatus = ConsultationRequestStatus.ACCEPTED;
    consultation.sessionStatus = ConsultationSessionStatus.IN_CONSULTATION;

    await service.cancel(doctorId.toString(), consultation._id.toString(), {
      reason: 'Connection ended',
    });

    expect(consultation.requestStatus).toBe(
      ConsultationRequestStatus.CANCELLED,
    );
    expect(consultation.sessionStatus).toBe(
      ConsultationSessionStatus.INTERRUPTED,
    );
    expect(consultation.interruptionReason).toBe('cancelled');
  });

  it('rejects no-show without a scheduled booking policy', async () => {
    const { service, consultation, doctorId, usage } = createService();
    consultation.requestStatus = ConsultationRequestStatus.ACCEPTED;
    consultation.sessionStatus = ConsultationSessionStatus.WAITING;

    await expect(
      service.markNoShow(
        doctorId.toString(),
        consultation._id.toString(),
        'Absent',
      ),
    ).rejects.toThrow('No-show policy is unavailable');
    expect(usage.count).not.toHaveBeenCalled();
  });

  it('rejects late patient cancellation before releasing quota', async () => {
    const { service, consultation, patientId, usage } = createService();
    Object.assign(consultation, {
      mode: ConsultationMode.SCHEDULED,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      scheduledStartAt: new Date(Date.now() + 30 * 60_000),
      bookingSettingsSnapshot: { cancellationDeadlineMinutes: 60 },
    });
    await expect(
      service.cancel(patientId.toString(), consultation._id.toString(), {}),
    ).rejects.toThrow('Cancellation deadline has passed');
    expect(usage.release).not.toHaveBeenCalled();
  });

  it('releases quota when a patient cancels a scheduled booking on time', async () => {
    const { service, consultation, patientId, usage } = createService();
    Object.assign(consultation, {
      mode: ConsultationMode.SCHEDULED,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      scheduledStartAt: new Date(Date.now() + 120 * 60_000),
      bookingSettingsSnapshot: { cancellationDeadlineMinutes: 60 },
    });
    await service.cancel(patientId.toString(), consultation._id.toString(), {});
    expect(usage.release).toHaveBeenCalledTimes(1);
    expect(consultation.requestStatus).toBe(
      ConsultationRequestStatus.CANCELLED,
    );
  });

  it('only counts scheduled no-show after its snapshot waiting period', async () => {
    const { service, consultation, doctorId, usage } = createService();
    Object.assign(consultation, {
      mode: ConsultationMode.SCHEDULED,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      scheduledStartAt: new Date(Date.now() - 9 * 60_000),
      bookingSettingsSnapshot: { noShowAfterMinutes: 10 },
    });
    await expect(
      service.markNoShow(doctorId.toString(), consultation._id.toString()),
    ).rejects.toThrow('No-show waiting period has not elapsed');
    expect(usage.count).not.toHaveBeenCalled();
    Object.assign(consultation, {
      scheduledStartAt: new Date(Date.now() - 11 * 60_000),
    });
    await service.markNoShow(doctorId.toString(), consultation._id.toString());
    expect(usage.count).toHaveBeenCalledTimes(1);
    expect(consultation.sessionStatus).toBe(ConsultationSessionStatus.NO_SHOW);
  });

  it('does not support no-show for on-demand even with a snapshot', async () => {
    const { service, consultation, doctorId, usage } = createService();
    Object.assign(consultation, {
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      scheduledStartAt: new Date(Date.now() - 20 * 60_000),
      bookingSettingsSnapshot: { noShowAfterMinutes: 10 },
    });
    await expect(
      service.markNoShow(doctorId.toString(), consultation._id.toString()),
    ).rejects.toThrow('No-show policy is unavailable');
    expect(usage.count).not.toHaveBeenCalled();
  });

  it('does not count or release an included care-program consultation', async () => {
    const { service, consultation, doctorId, patientId, usage } =
      createService();
    Object.assign(consultation, {
      quotaPolicy: ConsultationQuotaPolicy.CARE_PROGRAM_INCLUDED,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
    });
    await service.start(doctorId.toString(), consultation._id.toString());
    expect(usage.count).not.toHaveBeenCalled();
    await service.cancel(patientId.toString(), consultation._id.toString(), {});
    expect(usage.release).not.toHaveBeenCalled();
  });

  it('returns canonical fields without legacy session aliases', async () => {
    const { service, consultation, patientId } = createService();

    const result = await service.findOne(
      patientId.toString(),
      consultation._id.toString(),
    );

    expect(result.data).toMatchObject({
      requestStatus: ConsultationRequestStatus.PENDING,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
    });
    expect(result.data).not.toHaveProperty('status');
    expect(result.data).not.toHaveProperty('scheduledAt');
    expect(result.data).not.toHaveProperty('doctorSessionId');
  });
});
