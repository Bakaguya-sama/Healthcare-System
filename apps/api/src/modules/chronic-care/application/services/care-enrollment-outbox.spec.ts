import { Types } from 'mongoose';
import { CareEnrollmentService } from './care-enrollment.service';
import { PatientCareProgramStatus } from '../../domain/entities/patient-care-program.entity';

describe('CareEnrollmentService task synchronization outbox', () => {
  it('records state-sync intent inside the same transaction as command and idempotency receipt', async () => {
    const session = {
      withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
      endSession: jest.fn(),
    };
    const idempotency = {
      findOne: jest.fn(() => ({
        session: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      })),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new CareEnrollmentService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      idempotency as never,
      { startSession: jest.fn().mockResolvedValue(session) } as never,
      {} as never,
      {} as never,
      {} as never,
      outbox as never,
    );
    const enrollmentId = new Types.ObjectId();

    const result = await (service as any).command(
      { id: new Types.ObjectId().toString() },
      'care-enrollment.resume',
      'command-key',
      { expectedRevision: 2 },
      async () => ({
        _id: enrollmentId,
        revision: 3,
        status: 'active',
      }),
    );

    expect(result._id).toBe(enrollmentId);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      {
        enrollmentId: String(enrollmentId),
        revision: 3,
        status: PatientCareProgramStatus.ACTIVE,
      },
      session,
    );
    expect(idempotency.create).toHaveBeenCalledWith(expect.any(Array), { session });
    expect(session.endSession).toHaveBeenCalled();
  });
});
