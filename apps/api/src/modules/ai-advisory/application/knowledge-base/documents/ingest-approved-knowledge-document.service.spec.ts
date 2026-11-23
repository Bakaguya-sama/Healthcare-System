import { IngestApprovedKnowledgeDocumentService } from './ingest-approved-knowledge-document.service';

describe('IngestApprovedKnowledgeDocumentService retry and archive safety', () => {
  const documents = { beginIngestion: jest.fn(), completeIngestion: jest.fn(), markIngestionFailed: jest.fn() };
  const ingestion = { handleRAG: jest.fn() };
  const service = new IngestApprovedKnowledgeDocumentService(documents as never, ingestion as never);
  const originalFetch = global.fetch;
  beforeEach(() => { jest.resetAllMocks(); global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer }) as never; });
  afterAll(() => { global.fetch = originalFetch; });

  it('does nothing for an archived document whose worker event arrives late', async () => {
    documents.beginIngestion.mockResolvedValue(null);
    await service.ingest('doc-archived');
    expect(ingestion.handleRAG).not.toHaveBeenCalled();
    expect(documents.completeIngestion).not.toHaveBeenCalled();
  });

  it('marks a failed job retry-safe and never marks it ready', async () => {
    documents.beginIngestion.mockResolvedValue({ fileUrl: 'https://storage.example/document', title: 'guide.pdf', fileType: 'application/pdf', contentHash: 'hash', documentVersion: 1, knowledgeLanguage: 'vi', scope: 'general' });
    ingestion.handleRAG.mockRejectedValue(new Error('embedding unavailable'));
    await expect(service.ingest('doc-1')).rejects.toThrow('embedding unavailable');
    expect(documents.markIngestionFailed).toHaveBeenCalledWith('doc-1');
    expect(documents.completeIngestion).not.toHaveBeenCalled();
  });
});
