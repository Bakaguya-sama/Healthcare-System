import { Injectable } from '@nestjs/common';
import {
  Citation,
  ContextBuilderInput,
  ContextBuilderOutput,
  IContextBuilderService,
} from '../interfaces/context-builder.interface';

@Injectable()
export class ContextBuilderService implements IContextBuilderService {
  private readonly defaultTokenBudget = 1200;

  build(input: ContextBuilderInput): ContextBuilderOutput {
    const tokenBudget = this.normalizeTokenBudget(input.tokenBudget);

    if (!input.hits.length) {
      return {
        context: null,
        citations: [],
        estimatedTokens: 0,
      };
    }

    const citations: Citation[] = [];
    const blocks: string[] = [];
    let estimatedTokens = 0;

    for (let index = 0; index < input.hits.length; index++) {
      const hit = input.hits[index];
      const source = `Nguồn ${index + 1}`;
      const excerpt = this.limitSnippet(hit.content, 240);
      const block = `[${source} | score=${hit.score.toFixed(3)} | doc=${hit.documentId}] ${hit.content}`;
      const blockTokens = this.estimateTokens(block);

      if (estimatedTokens + blockTokens > tokenBudget && blocks.length > 0) {
        break;
      }

      blocks.push(block);
      citations.push({
        source,
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        score: hit.score,
        excerpt,
      });
      estimatedTokens += blockTokens;
    }

    return {
      context: blocks.length
        ? `Dữ liệu tham khảo từ Vector:\n${blocks.join('\n\n')}`
        : null,
      citations,
      estimatedTokens,
    };
  }

  private normalizeTokenBudget(tokenBudget?: number): number {
    if (!tokenBudget || Number.isNaN(tokenBudget)) {
      return this.defaultTokenBudget;
    }

    return Math.max(200, Math.min(4000, Math.floor(tokenBudget)));
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private limitSnippet(text: string, maxLength: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength)}...`;
  }
}
