export interface IEmbeddingService {
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  generateQueryEmbedding(query: string): Promise<number[]>;
}
