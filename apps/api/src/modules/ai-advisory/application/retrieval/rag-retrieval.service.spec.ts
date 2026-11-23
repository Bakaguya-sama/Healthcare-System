import { RagRetrievalService } from './rag-retrieval.service';

describe('RagRetrievalService trusted evidence gate', () => {
  it('keeps only evidence above threshold and removes duplicate chunks', async () => {
    const vectorStore = {
      similaritySearchByText: jest.fn().mockResolvedValue([
        {
          chunkId: 'a',
          documentId: 'doc-1',
          documentVersion: 2,
          content: 'Tăng huyết áp cần được theo dõi.',
          score: 0.91,
        },
        {
          chunkId: 'b',
          documentId: 'doc-1',
          documentVersion: 2,
          content: '  tăng   huyết áp cần được theo dõi. ',
          score: 0.9,
        },
        {
          chunkId: 'c',
          documentId: 'doc-2',
          documentVersion: 1,
          content: 'Không được dùng vì điểm thấp.',
          score: 0.2,
        },
      ]),
    };
    const service = new RagRetrievalService(vectorStore as never);
    const result = await service.retrieve({
      query: 'Theo dõi huyết áp',
      minScore: 0.85,
      scope: 'cardiology',
      language: 'vi',
    });
    expect(result.hits).toHaveLength(1);
    expect(vectorStore.similaritySearchByText).toHaveBeenCalledWith(
      'Theo dõi huyết áp',
      12,
      'cardiology',
      'vi',
    );
  });

  it('does not call storage for blank or no-evidence Vietnamese evaluation questions', async () => {
    const vectorStore = { similaritySearchByText: jest.fn() };
    const service = new RagRetrievalService(vectorStore as never);
    await expect(service.retrieve({ query: '   ' })).resolves.toMatchObject({
      hits: [],
    });
    expect(vectorStore.similaritySearchByText).not.toHaveBeenCalled();
  });

  it('fuses text and vector rankings deterministically with RRF', () => {
    const service = new RagRetrievalService({
      similaritySearchByText: jest.fn(),
      fullTextSearchByText: jest.fn(),
    } as never);
    const ranked = service.fuseByReciprocalRank(
      [
        {
          chunkId: 'vector-first',
          documentId: 'd1',
          documentVersion: 1,
          content: 'A',
          score: 0.9,
        },
        {
          chunkId: 'shared',
          documentId: 'd2',
          documentVersion: 1,
          content: 'B',
          score: 0.8,
        },
      ],
      [
        {
          chunkId: 'shared',
          documentId: 'd2',
          documentVersion: 1,
          content: 'B',
          score: 3,
        },
        {
          chunkId: 'text-only',
          documentId: 'd3',
          documentVersion: 1,
          content: 'C',
          score: 2,
        },
      ],
    );
    expect(ranked.map((item) => item.chunkId)).toEqual([
      'shared',
      'vector-first',
      'text-only',
    ]);
    expect(ranked[0].score).toBe(1);
    expect(ranked[0].score).toBeGreaterThan(0.6);
  });

  it('fails closed when an Atlas branch times out instead of failing the AI request', async () => {
    const service = new RagRetrievalService({
      similaritySearchByText: jest.fn().mockRejectedValue(new Error('timeout')),
      fullTextSearchByText: jest.fn().mockResolvedValue([]),
    } as never);
    await expect(
      service.retrieve({ query: 'Cau hoi an toan', minScore: 0 }),
    ).resolves.toMatchObject({ hits: [] });
  });
});
