export type ExtractableFile = {
  originalname: string;
  mimetype?: string;
  buffer: Buffer;
};

export interface ITextExtractionService {
  extractText(file: ExtractableFile): Promise<string>;
}
