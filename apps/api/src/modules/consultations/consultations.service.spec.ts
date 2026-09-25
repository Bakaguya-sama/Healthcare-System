import { Types } from 'mongoose';
import { ConsultationsService } from './consultations.service';
import {
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from './entities/consultation.entity';

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
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn(function (this: unknown) {
        return this;
      }),
    };
    const model = {
      findById: jest.fn().mockResolvedValue(consultation),
      create: jest.fn().mockResolvedValue(consultation),
    };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const users = {
      findById: jest.fn().mockResolvedValue({ fullName: 'Patient' }),
    };
    return {
      service: new ConsultationsService(
        model as never,
        notifications as never,
        users as never,
      ),
      consultation,
      patientId,
      doctorId,
    };
  }

  it('moves pending request through accept, start and complete', async () => {
    const { service, consultation, doctorId } = createService();

    await service.accept(doctorId.toString(), consultation._id.toString());
    expect(consultation.requestStatus).toBe(ConsultationRequestStatus.ACCEPTED);
    expect(consultation.sessionStatus).toBe(
      ConsultationSessionStatus.CONFIRMED,
    );

    await service.start(doctorId.toString(), consultation._id.toString());
    expect(consultation.sessionStatus).toBe(
      ConsultationSessionStatus.IN_PROGRESS,
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
