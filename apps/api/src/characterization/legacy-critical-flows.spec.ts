import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminService } from '../modules/administration/admin.service';
import { AiAssistantService } from '../modules/ai-advisory/conversations/ai-assistant.service';
import {
  ConversationType,
  MessageRole,
} from '../modules/ai-advisory/conversations/entities/ai-conversation.entity';
import { ChatService } from '../modules/consultations/messaging/chat.service';
import { SenderType } from '../modules/consultations/messaging/entities/message.entity';
import { HealthMetricsService } from '../modules/health-tracking/health-metrics.service';
import { MetricType } from '../modules/health-tracking/entities/health-metric.entity';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { NotificationType } from '../modules/notifications/entities/notification.entity';
import { RagRetrievalService } from '../modules/ai-advisory/retrieval/services/rag-retrieval.service';
import { ReviewsService } from '../modules/consultations/reviews/reviews.service';
import { DoctorVerificationStatus } from '../core/domain/user.enums';

describe('legacy critical-flow characterization', () => {
  const patientId = new Types.ObjectId();
  const doctorId = new Types.ObjectId();
  const adminId = new Types.ObjectId();
  const consultationId = new Types.ObjectId();

  describe('doctor approval', () => {
    it('moves a pending doctor to approved and sends the legacy email', async () => {
      const populatedDoctor = {
        id: doctorId.toString(),
        verificationStatus: 'approved',
      };
      const userAccounts = {
        setDoctorVerification: jest.fn().mockResolvedValue({
          ...populatedDoctor,
          userId: { email: 'doctor@example.com' },
        }),
      };
      const mailer = {
        sendApproveEmail: jest.fn().mockResolvedValue(undefined),
      };
      const service = new AdminService(
        userAccounts as never,
        {} as never,
        mailer as never,
        {} as never,
      );

      const result = await service.verifyDoctor(
        doctorId.toString(),
        adminId.toString(),
        {} as never,
      );

      expect(userAccounts.setDoctorVerification).toHaveBeenCalledWith(
        doctorId.toString(),
        adminId.toString(),
        DoctorVerificationStatus.APPROVED,
      );
      expect(mailer.sendApproveEmail).toHaveBeenCalledWith(
        'doctor@example.com',
      );
      expect(result).toMatchObject(populatedDoctor);
    });
  });

  describe('chat authorization', () => {
    it('rejects a sender who is not a session participant', async () => {
      const consultations = {
        findDocument: jest.fn().mockResolvedValue({ patientId, doctorId }),
      };
      const service = new ChatService(
        {} as never,
        consultations as never,
        {
          getAllowedMimeTypes: jest.fn().mockReturnValue([]),
          getAllowedFileTypes: jest.fn().mockReturnValue([]),
        } as never,
      );

      await expect(
        service.sendMessage(new Types.ObjectId().toString(), {
          consultationId: consultationId.toString(),
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
      const consultations = {
        findForReview: jest.fn().mockResolvedValue({ _id: consultationId }),
      };
      const users = {
        requireDoctorProfile: jest.fn().mockResolvedValue({
          _id: doctorId,
          doctorProfile: {},
        }),
        applyDoctorRatingDelta: jest.fn().mockResolvedValue({
          _id: doctorId,
          doctorProfile: { averageRating: 5, reviewCount: 1 },
        }),
      };
      const service = new ReviewsService(
        ReviewModel as never,
        consultations as never,
        users as never,
      );

      const result = await service.create(patientId.toString(), {
        doctorId: doctorId.toString(),
        consultationId: consultationId.toString(),
        rating: 5,
        comment: 'Helpful consultation',
      });

      expect(result.statusCode).toBe(201);
      expect(users.applyDoctorRatingDelta).toHaveBeenCalledWith(
        doctorId.toString(),
        5,
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

  describe('AI conversation and RAG', () => {
    it('starts the legacy AI conversation with the initial user message', async () => {
      const conversation = { _id: new Types.ObjectId() };
      const conversationModel = {
        create: jest.fn().mockResolvedValue(conversation),
      };
      const conversationMessageModel = {
        create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      };
      const service = new AiAssistantService(
        conversationModel as never,
        conversationMessageModel as never,
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
          messageCount: 1,
        }),
      );
      expect(conversationMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: MessageRole.USER,
          conversationId: conversation._id,
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
  });

  describe('notification create/read', () => {
    it('persists a notification and records an idempotent delivery event', async () => {
      const notification = {
        _id: new Types.ObjectId(),
        id: '',
        title: 'Consultation',
        message: 'Request received',
        isRead: false,
        type: NotificationType.INFO,
        createdAt: new Date(),
      };
      notification.id = notification._id.toString();
      const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
      const service = new NotificationsService(
        { create: jest.fn().mockResolvedValue(notification) } as never,
        outbox as never,
      );

      const result = await service.create(patientId.toString(), {
        userId: patientId.toString(),
        type: NotificationType.INFO,
        title: notification.title,
        message: notification.message,
      });

      expect(result.statusCode).toBe(201);
      expect(outbox.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'notification.created',
          idempotencyKey: `notification.created.${notification.id}`,
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
      const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
      const service = new NotificationsService(
        { findOne: jest.fn().mockResolvedValue(notification) } as never,
        outbox as never,
      );

      await service.findOne(patientId.toString(), notificationId.toString());

      expect(notification.isRead).toBe(true);
      expect(notification.save).toHaveBeenCalled();
      expect(outbox.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'notification.realtime' }),
      );
    });
  });
});
