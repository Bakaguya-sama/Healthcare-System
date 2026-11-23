import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ExternalLiteraturePort,
  ExternalLiteratureRecord,
} from '../../../application/ports/retrieval/external-literature.port';

@Injectable()
export class PubmedLiteratureAdapter implements ExternalLiteraturePort {
  constructor(private readonly config: ConfigService) {}

  async searchMedicalLiterature(
    query: string,
    limit: number,
  ): Promise<ExternalLiteratureRecord[]> {
    const timeoutMs = this.config.get<number>('PUBMED_TIMEOUT_MS') ?? 3000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const params = new URLSearchParams({
        db: 'pubmed',
        term: query,
        retmode: 'json',
        retmax: String(Math.max(1, Math.min(limit, 5))),
        sort: 'relevance',
      });
      const headers = {
        Accept: 'application/json',
        'User-Agent': 'HealthcareApp-RAG/1.0 (external-evidence-metadata)',
      };
      const search = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`,
        { signal: controller.signal, headers },
      );
      if (!search.ok)
        throw new Error(`PubMed search failed with ${search.status}`);
      if (!search.headers.get('content-type')?.includes('application/json'))
        throw new Error('PubMed search returned a non-JSON response');
      const ids =
        ((await search.json()) as { esearchresult?: { idlist?: string[] } })
          .esearchresult?.idlist ?? [];
      if (!ids.length) return [];
      const summary = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
        { signal: controller.signal, headers },
      );
      if (!summary.ok)
        throw new Error(`PubMed summary failed with ${summary.status}`);
      if (!summary.headers.get('content-type')?.includes('application/json'))
        throw new Error('PubMed summary returned a non-JSON response');
      const result = (await summary.json()) as {
        result?: Record<
          string,
          {
            uid?: string;
            title?: string;
            fulljournalname?: string;
            pubdate?: string;
          }
        >;
      };
      return ids
        .map((id) => result.result?.[id])
        .filter(Boolean)
        .map((item) => ({
          pmid: item?.uid ?? '',
          title: item?.title ?? '',
          journal: item?.fulljournalname,
          publicationYear:
            Number(item?.pubdate?.match(/\d{4}/)?.[0]) || undefined,
          sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${item?.uid}/`,
        }))
        .filter((item) => Boolean(item.pmid && item.title));
    } finally {
      clearTimeout(timer);
    }
  }
}
