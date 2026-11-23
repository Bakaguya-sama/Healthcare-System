import { KnowledgeCandidatesService } from './knowledge-candidates.service';
import { KnowledgeCandidateStatus } from '../../../domain/knowledge-base/knowledge-candidate.entity';

describe('KnowledgeCandidatesService', () => {
  const aiManager = '507f1f77bcf86cd799439011';
  const superAdmin = '507f1f77bcf86cd799439012';
  const candidate = { _id: { toString: () => '507f1f77bcf86cd799439013' }, pmid: '12345678', title: 'Safe title', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/12345678/', status: KnowledgeCandidateStatus.PENDING_REVIEW, save: jest.fn() };
  const users = { findById: jest.fn((id: string) => ({ select: () => ({ lean: () => ({ exec: async () => id === aiManager ? { role: 'admin', adminProfile: { adminRole: 'ai_manager' } } : { role: 'admin', adminProfile: { adminRole: 'super_admin' } } }) }) })) };
  const candidates = { create: jest.fn(async () => candidate), findById: jest.fn(() => ({ exec: async () => candidate })), find: jest.fn(() => ({ sort: () => ({ lean: () => ({ exec: async () => [candidate] }) }) })) };
  const audits = { create: jest.fn() };
  const outbox = { enqueue: jest.fn() };
  const documents = { createExternalReference: jest.fn<Promise<{ _id: { toString: () => string } }>, [string, { buffer: Buffer; originalname: string; mimetype: string; size: number }, string]>(async () => ({ _id: { toString: () => '507f1f77bcf86cd799439014' } })), toPublicDocument: jest.fn((document) => document) };
  const service = new KnowledgeCandidatesService(candidates as never, users as never, audits as never, outbox as never, documents as never);

  beforeEach(() => jest.clearAllMocks());

  it('lets an AI manager propose a metadata-only PubMed candidate and records durable audit/outbox evidence', async () => {
    await service.propose(aiManager, { pmid: '12345678', title: 'Safe title', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' });
    expect(candidates.create).toHaveBeenCalledWith(expect.objectContaining({ pmid: '12345678', status: KnowledgeCandidateStatus.PENDING_REVIEW }));
    expect(audits.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'proposed' }));
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'knowledge.candidate.proposed.v1' }));
  });

  it('quarantines automated PubMed discoveries without a patient actor or query', async () => {
    await expect(service.captureExternalDiscoveries([{ pmid: '12345678', title: 'Safe title', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' }])).resolves.toBe(1);
    expect(audits.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'externally_discovered', actorId: undefined, metadata: expect.objectContaining({ automated: true, source: 'pubmed' }) }));
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'knowledge.candidate.discovered.v1', payload: expect.not.objectContaining({ query: expect.anything() }) }));
  });

  it('allows only super_admin to promote and never writes an abstract into the reference file', async () => {
    const result = await service.promote(candidate._id.toString(), superAdmin);
    expect(documents.createExternalReference).toHaveBeenCalledWith(superAdmin, expect.objectContaining({ originalname: 'pubmed-12345678.txt', buffer: expect.any(Buffer) }), 'Safe title');
    const file = documents.createExternalReference.mock.calls[0]?.[1];
    expect(file).toBeDefined();
    if (!file) throw new Error('Expected reference file');
    expect(file.buffer.toString()).toContain('PMID: 12345678');
    expect(file.buffer.toString().toLowerCase()).not.toContain('abstract');
    expect(result.candidate.status).toBe(KnowledgeCandidateStatus.PROMOTED);
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'knowledge.candidate.promoted.v1' }));
  });
});
