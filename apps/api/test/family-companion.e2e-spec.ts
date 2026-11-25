import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { AcceptFamilyInvitation } from '../src/modules/family-companion/application/use-cases/accept-family-invitation.use-case';
import { RejectFamilyInvitation } from '../src/modules/family-companion/application/use-cases/reject-family-invitation.use-case';
import { CreateFamilyInvitation } from '../src/modules/family-companion/application/use-cases/create-family-invitation.use-case';
import { RedeemFamilyInvitation } from '../src/modules/family-companion/application/use-cases/redeem-family-invitation.use-case';
import { ChangeFamilyLinkStatus } from '../src/modules/family-companion/application/use-cases/change-family-link-status.use-case';
import { UpdateFamilyReminderPermissions } from '../src/modules/family-companion/application/use-cases/update-family-reminder-permissions.use-case';
import { RegenerateFamilyInvitationArtifacts } from '../src/modules/family-companion/application/use-cases/regenerate-family-invitation-artifacts.use-case';
import { ReadFamilyLinks } from '../src/modules/family-companion/application/queries/read-family-links';
import {
  AdminFamilyLinksController,
  FamilyLinksController,
} from '../src/modules/family-companion/presentation/controllers/family-links.controller';

describe('Family Companion HTTP contract (e2e)', () => {
  let app: INestApplication<App>;
  const redeemInvitation = {
    execute: jest.fn(async () => ({
      statusCode: 200,
      data: { status: 'pending_consent' },
    })),
  };
  const changeFamilyLinkStatus = {
    execute: jest.fn(async () => ({
      statusCode: 200,
      data: { status: 'paused' },
    })),
  };
  const updatePermissions = {
    execute: jest.fn(async () => ({
      statusCode: 200,
      data: { permissions: [] },
    })),
  };
  const regenerateArtifacts = {
    execute: jest.fn(async () => ({
      statusCode: 200,
      data: { artifacts: { revealOnce: true } },
    })),
  };
  const createInvitation = {
    execute: jest.fn(async () => ({
      statusCode: 201,
      data: {
        link: { id: '507f1f77bcf86cd799439011' },
        artifacts: {
          shareLink: 'opaque',
          qrPayload: 'opaque',
          shortCode: '123456',
          revealOnce: true,
        },
      },
    })),
  };
  const acceptInvitation = {
    execute: jest.fn(async () => ({
      statusCode: 200,
      data: { status: 'active' },
    })),
  };
  const rejectInvitation = {
    execute: jest.fn(async () => ({
      statusCode: 200,
      data: { status: 'declined' },
    })),
  };
  const reads = {
    listForParticipant: jest.fn(async () => ({
      statusCode: 200,
      data: { items: [], total: 0 },
    })),
    getForParticipant: jest.fn(async () => ({
      statusCode: 200,
      data: { id: '507f1f77bcf86cd799439011' },
    })),
    listForAdmin: jest.fn(async () => ({
      statusCode: 200,
      data: { items: [], total: 0 },
    })),
  };

  @Injectable()
  class HeaderUserGuard implements CanActivate {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        user?: { sub: string };
      }>();
      const userId = req.headers['x-user-id'];
      if (!userId) return false;
      req.user = { sub: userId };
      return true;
    }
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FamilyLinksController, AdminFamilyLinksController],
      providers: [
        { provide: CreateFamilyInvitation, useValue: createInvitation },
        { provide: AcceptFamilyInvitation, useValue: acceptInvitation },
        { provide: RejectFamilyInvitation, useValue: rejectInvitation },
        { provide: RedeemFamilyInvitation, useValue: redeemInvitation },
        { provide: ChangeFamilyLinkStatus, useValue: changeFamilyLinkStatus },
        {
          provide: UpdateFamilyReminderPermissions,
          useValue: updatePermissions,
        },
        {
          provide: RegenerateFamilyInvitationArtifacts,
          useValue: regenerateArtifacts,
        },
        { provide: ReadFamilyLinks, useValue: reads },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderUserGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app?.close());

  it('forwards selected contact ID and idempotency header to invitation creation', async () => {
    await request(app.getHttpServer())
      .post('/family-links')
      .set('x-user-id', '507f1f77bcf86cd799439012')
      .set('idempotency-key', 'e2-http-1')
      .send({
        contactUserId: '507f1f77bcf86cd799439013',
        relationship: 'con của bệnh nhân',
      })
      .expect(201);
    expect(createInvitation.execute).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      expect.objectContaining({ contactUserId: '507f1f77bcf86cd799439013' }),
      'e2-http-1',
    );
  });

  it('keeps redeem/accept/action endpoints owner-scoped and forwards actor', async () => {
    await request(app.getHttpServer())
      .post('/family-links/redeem')
      .set('x-user-id', '507f1f77bcf86cd799439013')
      .set('idempotency-key', 'e2-http-redeem')
      .send({ shortCode: '123456' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/family-links/507f1f77bcf86cd799439011/accept')
      .set('x-user-id', '507f1f77bcf86cd799439013')
      .set('idempotency-key', 'e2-http-accept')
      .send({
        consentVersion: 'family-companion.v1',
        permissions: ['weekly_progress'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/family-links/507f1f77bcf86cd799439011/actions/pause')
      .set('x-user-id', '507f1f77bcf86cd799439012')
      .set('idempotency-key', 'e2-http-pause')
      .send({ reason: 'user_requested' })
      .expect(201);
    expect(redeemInvitation.execute).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439013',
      { shortCode: '123456' },
      'e2-http-redeem',
    );
    expect(acceptInvitation.execute).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439013',
      '507f1f77bcf86cd799439011',
      expect.anything(),
      'e2-http-accept',
    );
    expect(changeFamilyLinkStatus.execute).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439011',
      'pause',
      'user_requested',
      'e2-http-pause',
    );
  });
});
