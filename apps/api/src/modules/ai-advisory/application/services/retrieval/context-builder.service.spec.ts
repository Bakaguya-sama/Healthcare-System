import { ContextBuilderService } from './context-builder.service';

describe('ContextBuilderService server citations', () => {
  it('builds citation fields exclusively from retrieved server hits', () => {
    const result = new ContextBuilderService().build({ hits: [{ chunkId: 'chunk-1', documentId: 'document-1', documentVersion: 3, content: 'Hướng dẫn theo dõi huyết áp tại nhà.', score: 0.93, title: 'Hướng dẫn nội bộ', pageNumber: 4, sectionTitle: 'Theo dõi' }] });
    expect(result.citations).toEqual([expect.objectContaining({ chunkId: 'chunk-1', documentId: 'document-1', documentVersion: 3, pageNumber: 4, title: 'Hướng dẫn nội bộ' })]);
    expect(JSON.stringify(result.citations)).not.toContain('fileUrl');
    expect(JSON.stringify(result.citations)).not.toContain('embedding');
  });
});
