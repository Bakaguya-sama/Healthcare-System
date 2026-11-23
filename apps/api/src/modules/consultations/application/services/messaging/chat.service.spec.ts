import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';
import {
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';
import { SenderType } from '../../../domain/entities/messaging/message.entity';

describe('ChatService sendMessage guards', () => {
  function createService(overrides: Record<string, unknown> = {}) {
    const patientId = new Types.ObjectId();
    const doctorId = new Types.ObjectId();
    const consultationId = new Types.ObjectId();

    const consultation = {
      _id: consultationId,
      patientId,
      doctorId,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      ...overrides,
    };

    const createdMessage = {
      _id: new Types.ObjectId(),
      id: 'msg-1',
      consultationId,
      senderId: doctorId,
      senderType: SenderType.DOCTOR,
      content: 'Hello',
      sentAt: new Date(),
    };

    const messageModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(createdMessage),
    };

    const consultations = {
      findDocument: jest.fn().mockResolvedValue(consultation),
      recordLastMessage: jest.fn().mockResolvedValue(undefined),
    };

    const cloudinaryService = {
      getAllowedMimeTypes: jest.fn().mockReturnValue(['image/png']),
      getAllowedFileTypes: jest.fn().mockReturnValue(['image/png']),
      uploadFile: jest.fn().mockResolvedValue({
        publicId: 'pub-1',
        secureUrl: 'https://example.com/file.png',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new ChatService(
        messageModel as never,
        consultations as never,
        cloudinaryService as never,
      ),
      patientId,
      doctorId,
      consultationId,
      messageModel,
      consultations,
      cloudinaryService,
    };
  }

  it.each([
    ConsultationRequestStatus.PENDING,
    ConsultationRequestStatus.DECLINED,
    ConsultationRequestStatus.EXPIRED,
  ])(
    'rejects sending messages when requestStatus is %s before uploading attachments',
    async (requestStatus) => {
      const { service, doctorId, consultationId, cloudinaryService, messageModel } =
        createService({
          requestStatus,
          sessionStatus: ConsultationSessionStatus.NOT_STARTED,
        });

      await expect(
        service.sendMessage(
          doctorId.toString(),
          {
            consultationId: consultationId.toString(),
            senderType: SenderType.DOCTOR,
            content: 'Hello',
          },
          [
            {
              originalname: 'report.png',
              mimetype: 'image/png',
              size: 1024,
              buffer: Buffer.from('x'),
            } as never,
          ],
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'Consultation must be accepted before sending messages',
        ),
      );

      expect(cloudinaryService.uploadFile).not.toHaveBeenCalled();
      expect(messageModel.create).not.toHaveBeenCalled();
    },
  );

  it('rejects cancelled consultation with BadRequestException', async () => {
    const { service, doctorId, consultationId } = createService({
      requestStatus: ConsultationRequestStatus.CANCELLED,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
    });

    await expect(
      service.sendMessage(doctorId.toString(), {
        consultationId: consultationId.toString(),
        senderType: SenderType.DOCTOR,
        content: 'Hello',
      }),
    ).rejects.toThrow(
      new BadRequestException('Cannot send message in cancelled consultation'),
    );
  });

  it.each([
    [
      ConsultationSessionStatus.COMPLETED,
      'Cannot send message in completed consultation',
    ],
    [
      ConsultationSessionStatus.NO_SHOW,
      'Cannot send message in no-show consultation',
    ],
  ])(
    'rejects accepted consultation when sessionStatus is %s',
    async (sessionStatus, expectedMsg) => {
      const { service, doctorId, consultationId } = createService({
        requestStatus: ConsultationRequestStatus.ACCEPTED,
        sessionStatus,
      });

      await expect(
        service.sendMessage(doctorId.toString(), {
          consultationId: consultationId.toString(),
          senderType: SenderType.DOCTOR,
          content: 'Hello',
        }),
      ).rejects.toThrow(new BadRequestException(expectedMsg));
    },
  );

  it.each([
    ConsultationSessionStatus.WAITING,
    ConsultationSessionStatus.IN_CONSULTATION,
  ])(
    'allows sending message when accepted and sessionStatus is %s',
    async (sessionStatus) => {
      const { service, doctorId, consultationId, messageModel, consultations } =
        createService({
          requestStatus: ConsultationRequestStatus.ACCEPTED,
          sessionStatus,
        });

      const res = await service.sendMessage(doctorId.toString(), {
        consultationId: consultationId.toString(),
        senderType: SenderType.DOCTOR,
        content: 'Hello',
      });

      expect(res.statusCode).toBe(201);
      expect(messageModel.create).toHaveBeenCalledTimes(1);
      expect(consultations.recordLastMessage).toHaveBeenCalledTimes(1);
    },
  );
});
