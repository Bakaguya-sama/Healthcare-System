import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminService } from '../modules/admin/admin.service';
import { AiAssistantService } from '../modules/ai-assistant/ai-assistant.service';
import { AiHealthInsightsService } from '../modules/ai-health-insights/services/ai-health-insights.service';
import { AiMessagesService } from '../modules/ai-messages/ai-messages.service';
import {
  ConversationType,
  MessageRole,
} from '../modules/ai-assistant/entities/ai-conversation.entity';
import { ChatService } from '../modules/chat/chat.service';
import { SenderType } from '../modules/chat/entities/message.entity';
import { HealthMetricsService } from '../modules/health-metrics/health-metrics.service';
import { MetricType } from '../modules/health-metrics/entities/health-metric.entity';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { NotificationType } from '../modules/notifications/entities/notification.entity';
import { RagRetrievalService } from '../modules/rag/services/rag-retrieval.service';
import { ReviewsService } from '../modules/reviews/reviews.service';
import { SessionsService } from '../modules/sessions/sessions.service';
import { SessionStatus } from '../modules/sessions/entities/session.entity';
import { UserRole } from '../modules/users/enums/user-role.enum';
import { DoctorVerificationStatus } from '../modules/users/entities/doctor.schema';

describe('legacy critical-flow characterization', () => {
  const patientId = new Types.ObjectId();
  const doctorId = new Types.ObjectId();
  const adminId = new Types.ObjectId();
  const sessionId = new Types.ObjectId();

  describe('doctor approval', () => {
    it('moves a pending doctor to approved and sends the legacy email', async () => {
      const populatedDoctor = {
        id: doctorId.toString(),
        verificationStatus: 'approved',
      };
      const doctor: {
        _id: Types.ObjectId;
        userId: Types.ObjectId;
        verificationStatus: DoctorVerificationStatus;
        verifiedAt?: Date;
        save: jest.Mock;
      } = {
        _id: new Types.ObjectId(),
        userId: doctorId,
        verificationStatus: DoctorVerificationStatus.PENDING,
        save: jest.fn(),
      };
      const updatedDoctor = {
        ...doctor,
        populate: jest.fn().mockResolvedValue({
          toObject: jest.fn().mockReturnValue(populatedDoctor),
        }),
      };
      doctor.save.mockResolvedValue(updatedDoctor);
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValueOnce({ _id: adminId, role: UserRole.ADMIN })
          .mockResolvedValueOnce({
            _id: doctorId,
            email: 'doctor@example.com',
          }),
      };
      const doctorModel = { findOne: jest.fn().mockResolvedValue(doctor) };
      const mailer = {
        sendApproveEmail: jest.fn().mockResolvedValue(undefined),
      };
      const usersCache = {
        invalidatePractitionerDirectory: jest.fn().mockResolvedValue(undefined),
      };
      const service = new AdminService(
        userModel as never,
        doctorModel as never,
        {} as never,
        {} as never,
        mailer as never,
        {} as never,
        usersCache as never,
      );

      const result = await service.verifyDoctor(
        doctorId.toString(),
        adminId.toString(),
        {} as never,
      );

      expect(doctor.verificationStatus).toBe(DoctorVerificationStatus.APPROVED);
      expect(doctor.verifiedAt).toBeInstanceOf(Date);
      expect(mailer.sendApproveEmail).toHaveBeenCalledWith(
        'doctor@example.com',
      );
      expect(usersCache.invalidatePractitionerDirectory).toHaveBeenCalledTimes(
        1,
      );
      expect(result).toBe(populatedDoctor);
    });
  });

  describe('consultation request lifecycle', () => {
    function createSessionService(sessionModel: Record<string, jest.Mock>) {
      return new SessionsService(
        sessionModel as never,
        { create: jest.fn().mockResolvedValue({}) } as never,
        {
          findById: jest.fn().mockResolvedValue({ fullName: 'Legacy User' }),
        } as never,
      );
    }

    it('creates a pending consultation request', async () => {
      const session = {
        _id: sessionId,
        patientId,
        doctorId,
        status: SessionStatus.PENDING,
      };
      const sessionModel = { create: jest.fn().mockResolvedValue(session) };
      const service = createSessionService(sessionModel);

      const result = await service.create(patientId.toString(), {
        doctorId: doctorId.toString(),
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        patientNotes: 'Need consultation',
      });

      expect(result.data.status).toBe(SessionStatus.PENDING);
      expect(sessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: SessionStatus.PENDING }),
      );
    });

    it.each([
      ['confirm', SessionStatus.ACTIVE],
      ['reject', SessionStatus.REJECTED],
    ] as const)(
      '%s transitions a pending request',
      async (command, expected) => {
        const session = {
          _id: sessionId,
          patientId,
          doctorId,
          status: SessionStatus.PENDING,
          save: jest.fn().mockResolvedValue(undefined),
        };
        const service = createSessionService({
          findById: jest.fn().mockResolvedValue(session),
        });

        await service[command](doctorId.toString(), sessionId.toString());

        expect(session.status).toBe(expected);
        expect(session.save).toHaveBeenCalled();
      },
    );
  });

  describe('chat authorization', () => {
    it('rejects a sender who is not a session participant', async () => {
      const sessionModel = {
        findById: jest.fn().mockResolvedValue({ patientId, doctorId }),
      };
      const service = new ChatService(
        {} as never,
        sessionModel as never,
        {
          getAllowedMimeTypes: jest.fn().mockReturnValue([]),
          getAllowedFileTypes: jest.fn().mockReturnValue([]),
        } as never,
      );

      await expect(
        service.sendMessage(new Types.ObjectId().toString(), {
          doctorSessionId: sessionId.toString(),
          senderType: SenderType.PATIENT,
          content: 'hello',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('review and rating projection', () => {
    it('creates a review and increments the legacy doctor rating projection', async () => {
      const reviewDocument = {
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const ReviewModel = jest
        .fn()
        .mockImplementation((data: Record<string, unknown>) =>
          Object.assign(reviewDocument, data),
        );
      Object.assign(ReviewModel, {
        findByIdAndDelete: jest.fn(),
      });
      const doctorModel = {
        findOne: jest.fn().mockResolvedValue({ userId: doctorId }),
        updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
        findById: jest.fn().mockResolvedValue({ userId: doctorId }),
      };
      const sessionModel = {
        findById: jest.fn().mockResolvedValue({ _id: sessionId }),
      };
      const usersCache = {
        invalidatePractitionerDirectory: jest.fn().mockResolvedValue(undefined),
      };
      const service = new ReviewsService(
        ReviewModel as never,
        doctorModel as never,
        sessionModel as never,
        usersCache as never,
      );

      const result = await service.create(patientId.toString(), {
        doctorId: doctorId.toString(),
        doctorSessionId: sessionId.toString(),
        rating: 5,
        comment: 'Helpful consultation',
      });

      expect(result.statusCode).toBe(201);
      expect(doctorModel.updateOne).toHaveBeenCalled();
      expect(usersCache.invalidatePractitionerDirectory).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe('health metric create/query', () => {
    it('records a normal heart-rate metric without an alert', async () => {
      const now = new Date();
      const metric = {
        _id: new Types.ObjectId(),
        type: MetricType.HEART_RATE,
      };
      const metricModel = { create: jest.fn().mockResolvedValue(metric) };
      const notifications = { create: jest.fn() };
      const service = new HealthMetricsService(
        metricModel as never,
        notifications as never,
        { findById: jest.fn().mockResolvedValue({ gender: 'male' }) } as never,
        { getAiNotificationAlert: jest.fn() } as never,
      );

      const result = await service.create(patientId.toString(), {
        type: MetricType.HEART_RATE,
        values: { value: { value: 70, recordedAt: now } },
        recordedAt: now,
      });

      expect(result.data).toBe(metric);
      expect(metricModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: MetricType.HEART_RATE, unit: 'bpm' }),
      );
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('queries a patient metric page with the legacy pagination envelope', async () => {
      const metrics = [
        { _id: new Types.ObjectId(), type: MetricType.HEART_RATE },
      ];
      const exec = jest.fn().mockResolvedValue(metrics);
      const lean = jest.fn().mockReturnValue({ exec });
      const limit = jest.fn().mockReturnValue({ lean });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });
      const select = jest.fn().mockReturnValue({ sort });
      const metricModel = {
        find: jest.fn().mockReturnValue({ select }),
        countDocuments: jest.fn().mockResolvedValue(1),
      };
      const service = new HealthMetricsService(
        metricModel as never,
        {} as never,
        {} as never,
        {} as never,
      );

      const result = await service.findAll(patientId.toString(), 'patient', {
        page: 1,
        limit: 10,
        sortBy: 'recordedAt',
        sortOrder: -1,
      });

      expect(result).toMatchObject({
        data: metrics,
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      });
      expect(metricModel.find).toHaveBeenCalledWith({
        patientId: new Types.ObjectId(patientId.toString()),
      });
      expect(select).toHaveBeenCalledWith(
        expect.stringContaining('patientId type values unit recordedAt'),
      );
      expect(lean).toHaveBeenCalled();
    });

    it('calculates metric statistics in MongoDB without hydrating the history', async () => {
      const latest = {
        _id: new Types.ObjectId(),
        patientId,
        type: MetricType.HEART_RATE,
        values: { value: { value: 80, recordedAt: new Date() } },
        unit: 'bpm',
        recordedAt: new Date(),
      };
      const aggregate = jest.fn().mockResolvedValue([
        {
          stats: [{ count: 3 }],
          numericStats: [{ average: 80.126, minimum: 70, maximum: 90 }],
          latest: [latest],
        },
      ]);
      const service = new HealthMetricsService(
        { aggregate } as never,
        {} as never,
        {} as never,
        {} as never,
      );

      const result = await service.getStatistics(
        patientId.toString(),
        MetricType.HEART_RATE,
      );

      expect(result.data).toMatchObject({
        count: 3,
        average: 80.13,
        minimum: 70,
        maximum: 90,
        latest,
      });
      expect(aggregate).toHaveBeenCalled();
      expect(JSON.stringify(aggregate.mock.calls)).toContain('"$facet"');
    });
  });

  describe('AI health insight statistics', () => {
    it('groups risk counts in MongoDB instead of loading every insight', async () => {
      const aggregate = jest.fn().mockResolvedValue([
        { _id: 'warning', count: 2 },
        { _id: 'danger', count: 1 },
      ]);
      const service = new AiHealthInsightsService({ aggregate } as never);

      await expect(
        service.getStatsByPatient(patientId.toString()),
      ).resolves.toEqual({
        total: 3,
        byRiskLevel: { warning: 2, danger: 1 },
      });
      expect(aggregate).toHaveBeenCalled();
      expect(JSON.stringify(aggregate.mock.calls)).toContain('"$group"');
      expect(JSON.stringify(aggregate.mock.calls)).toContain('"$project"');
    });
  });

  describe('AI conversation and RAG', () => {
    it('starts the legacy AI conversation with the initial user message', async () => {
      const conversation = { _id: new Types.ObjectId() };
      const conversationModel = {
        create: jest.fn().mockResolvedValue(conversation),
      };
      const service = new AiAssistantService(
        conversationModel as never,
        { get: jest.fn().mockReturnValue('test-key') } as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );

      const result = await service.startConversation(patientId.toString(), {
        type: ConversationType.HEALTH_INQUIRY,
        initialQuestion: 'Why do I have a headache?',
        tags: ['headache'],
      });

      expect(result.statusCode).toBe(201);
      expect(conversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: new Types.ObjectId(patientId.toString()),
          messages: [expect.objectContaining({ role: MessageRole.USER })],
        }),
      );
    });

    it('filters and deduplicates vector hits in the RAG happy path', async () => {
      const vectorStore = {
        similaritySearchByText: jest.fn().mockResolvedValue([
          {
            chunkId: '1',
            documentId: 'd1',
            content: 'Medical fact',
            score: 0.95,
          },
          {
            chunkId: '2',
            documentId: 'd1',
            content: ' medical   fact ',
            score: 0.94,
          },
          { chunkId: '3', documentId: 'd2', content: 'Low score', score: 0.5 },
        ]),
      };
      const service = new RagRetrievalService(vectorStore as never);

      const result = await service.retrieve({
        query: 'headache',
        limit: 3,
        minScore: 0.85,
      });

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].chunkId).toBe('1');
    });

    it('queries user AI messages through a bounded lookup instead of loading session IDs', async () => {
      const aggregate = jest
        .fn()
        .mockResolvedValue([{ data: [{ content: 'hello' }], total: 1 }]);
      const sessionsService = { findByUserId: jest.fn() };
      const service = new AiMessagesService(
        { aggregate } as never,
        sessionsService as never,
      );

      await expect(
        service.findByUserId(patientId.toString(), {
          page: 1,
          limit: 20,
          sortBy: 'sentAt',
          sortOrder: -1,
        }),
      ).resolves.toEqual({ data: [{ content: 'hello' }], total: 1 });
      expect(sessionsService.findByUserId).not.toHaveBeenCalled();
      expect(aggregate).toHaveBeenCalled();
      expect(JSON.stringify(aggregate.mock.calls)).toContain('"$lookup"');
      expect(JSON.stringify(aggregate.mock.calls)).toContain('"$facet"');
    });
  });

  describe('notification create/read', () => {
    it('persists and emits a new notification', async () => {
      const notification = {
        id: new Types.ObjectId().toString(),
        title: 'Consultation',
        message: 'Request received',
        isRead: false,
        type: NotificationType.INFO,
        createdAt: new Date(),
      };
      const gateway = { handleNotifications: jest.fn() };
      const service = new NotificationsService(
        { create: jest.fn().mockResolvedValue(notification) } as never,
        gateway as never,
      );

      const result = await service.create(patientId.toString(), {
        userId: patientId.toString(),
        type: NotificationType.INFO,
        title: notification.title,
        message: notification.message,
      });

      expect(result.statusCode).toBe(201);
      expect(gateway.handleNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: patientId.toString(),
          action: 'send',
        }),
      );
    });

    it('marks an unread notification as read when fetched', async () => {
      const notificationId = new Types.ObjectId();
      const notification = {
        id: notificationId.toString(),
        title: 'Consultation',
        message: 'Request received',
        isRead: false,
        type: NotificationType.INFO,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const gateway = { handleNotifications: jest.fn() };
      const service = new NotificationsService(
        { findOne: jest.fn().mockResolvedValue(notification) } as never,
        gateway as never,
      );

      await service.findOne(patientId.toString(), notificationId.toString());

      expect(notification.isRead).toBe(true);
      expect(notification.save).toHaveBeenCalled();
      expect(gateway.handleNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'mark_read' }),
      );
    });
  });
});
