import { CanActivate, ExecutionContext, INestApplication, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { KnowledgeCandidatesService } from '../src/modules/ai-advisory/application/knowledge-base/candidates/knowledge-candidates.service';
import { KnowledgeCandidatesController } from '../src/modules/ai-advisory/presentation/knowledge-base/candidates/knowledge-candidates.controller';

describe('AI knowledge candidate HTTP contract (e2e)', () => {
  let app: INestApplication<App>;
  const service = { list: jest.fn(async () => []), propose: jest.fn(async () => ({ status: 'pending_review' })), promote: jest.fn(), reject: jest.fn() };
  @Injectable()
  class HeaderUserGuard implements CanActivate { canActivate(context: ExecutionContext) { const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: { id: string; role: string } }>(); if (!req.headers['x-user-id']) return false; req.user = { id: req.headers['x-user-id']!, role: 'admin' }; return true; } }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [KnowledgeCandidatesController],
      providers: [
        { provide: KnowledgeCandidatesService, useValue: service },
      ],
    }).overrideGuard(JwtAuthGuard).useClass(HeaderUserGuard).overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app?.close());
  it('exposes only the candidate proposal boundary and forwards the authenticated actor', async () => {
    await request(app.getHttpServer()).get('/ai-knowledge-candidates').set('x-user-id', '507f1f77bcf86cd799439011').expect(200).expect([]);
    await request(app.getHttpServer()).post('/ai-knowledge-candidates').set('x-user-id', '507f1f77bcf86cd799439011').send({ pmid: '12345678', title: 'PubMed reference', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' }).expect(201);
    expect(service.propose).toHaveBeenCalledWith('507f1f77bcf86cd799439011', expect.objectContaining({ pmid: '12345678' }));
  });
});
