export type ExternalLiteratureRecord = {
  pmid: string;
  title: string;
  abstract?: string;
  journal?: string;
  publicationYear?: number;
  sourceUrl: string;
};

export interface ExternalLiteraturePort {
  searchMedicalLiterature(
    query: string,
    limit: number,
  ): Promise<ExternalLiteratureRecord[]>;
}

export const EXTERNAL_LITERATURE_PORT = Symbol('EXTERNAL_LITERATURE_PORT');
