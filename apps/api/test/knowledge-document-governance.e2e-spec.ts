import { CanActivate, ExecutionContext, INestApplication, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AiDocumentsController } from '../src/modules/ai-advisory/presentation/controllers/knowledge-base/documents/ai-documents.controller';
import { AiDocumentsService } from '../src/modules/ai-advisory/application/services/knowledge-base/documents/ai-documents.service';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';

@Injectable()
class HeaderUserGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: { id: string; role: string } }>();
    if (!req.headers['x-user-id']) return false;
    req.user = { id: req.headers['x-user-id']!, role: 'admin' };
    return true;
  }
}

describe('knowledge document governance (e2e)', () => {
  let app: INestApplication<App>;
  const documents = { approve: jest.fn(), reject: jest.fn(), activate: jest.fn(), toPublicDocument: jest.fn((value) => value) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AiDocumentsController], providers: [{ provide: AiDocumentsService, useValue: documents }] })
      .overrideGuard(JwtAuthGuard).useClass(HeaderUserGuard)
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication(); await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => { Object.values(documents).forEach((value) => { if (typeof value === 'function' && 'mockReset' in value) (value as jest.Mock).mockReset(); }); documents.approve.mockResolvedValue({ _id: 'doc-1' }); documents.toPublicDocument.mockImplementation((value) => value); });
  it('uses the authenticated admin subject for approval, never an actor from request body', async () => {
    await request(app.getHttpServer()).post('/ai-documents/doc-1/approve').set('x-user-id', 'admin-authenticated').send({ actorId: 'forged' }).expect(201);
    expect(documents.approve).toHaveBeenCalledWith('doc-1', 'admin-authenticated');
  });
  it('rejects governance actions when unauthenticated', async () => {
    await request(app.getHttpServer()).post('/ai-documents/doc-1/approve').expect(403);
    expect(documents.approve).not.toHaveBeenCalled();
  });
});
