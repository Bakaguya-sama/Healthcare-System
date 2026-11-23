import { AiDocumentsService } from './ai-documents.service';

describe('AiDocumentsService safe document response', () => {
  const service = new AiDocumentsService(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
  );

  it('redacts storage location and content hash from every HTTP document representation', () => {
    const document = {
      _id: 'doc-1', title: 'Hướng dẫn tăng huyết áp', fileUrl: 'https://private-storage.example/secret', publicId: 'private-key', contentHash: 'sha256-secret', status: 'pending_ingestion', reviewStatus: 'pending_review', documentVersion: 1,
    };
    const result = service.toPublicDocument(document as never);
    expect(result).toMatchObject({ _id: 'doc-1', title: 'Hướng dẫn tăng huyết áp' });
    expect(result).not.toHaveProperty('fileUrl');
    expect(result).not.toHaveProperty('publicId');
    expect(result).not.toHaveProperty('contentHash');
  });

  it('keeps a replacement pending review and links it to the stable document family', async () => {
    const current = { _id: 'parent-1', documentVersion: 2, parentDocumentId: null };
    const replacement = { save: jest.fn(), documentVersion: 1 };
    const internals = service as unknown as {
      assertKnowledgeManager: (userId: string) => Promise<void>;
      recordTransition: (...args: unknown[]) => Promise<void>;
    };
    jest.spyOn(internals, 'assertKnowledgeManager').mockResolvedValue();
    jest.spyOn(service, 'findById').mockResolvedValue(current as never);
    jest.spyOn(service, 'create').mockResolvedValue(replacement as never);
    jest.spyOn(internals, 'recordTransition').mockResolvedValue();
    await service.replaceVersion('parent-1', 'manager-1', {} as never, {});
    expect(replacement).toMatchObject({ parentDocumentId: 'parent-1', documentVersion: 3 });
    expect(replacement.save).toHaveBeenCalled();
  });

  it('enforces ai_manager versus full-admin authorities independently of request DTOs', async () => {
    const users = { findById: jest.fn() };
    const governed = new AiDocumentsService({} as never, {} as never, {} as never, {} as never, {} as never, users as never, {} as never);
    const access = governed as unknown as { assertKnowledgeManager: (id: string) => Promise<void>; assertFullAdmin: (id: string) => Promise<void> };
    users.findById.mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => ({ role: 'admin', adminProfile: { adminRole: 'ai_manager' } }) }) }) });
    await expect(access.assertKnowledgeManager('manager')).resolves.toBeUndefined();
    await expect(access.assertFullAdmin('manager')).rejects.toThrow('Only a full administrator');
  });
});
