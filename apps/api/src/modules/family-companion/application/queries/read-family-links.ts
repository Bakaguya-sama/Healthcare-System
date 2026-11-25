import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FAMILY_LINK_READ_REPOSITORY } from '../ports/family-link-read.repository';
import type {
  FamilyLinkReadModel,
  FamilyLinkReadRepository,
} from '../ports/family-link-read.repository';

export interface FamilyLinksQuery {
  direction: 'sent' | 'received' | 'all';
  status?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ReadFamilyLinks {
  constructor(
    @Inject(FAMILY_LINK_READ_REPOSITORY)
    private readonly links: FamilyLinkReadRepository,
    private readonly config: ConfigService,
  ) {}

  async listForParticipant(userId: string, query: FamilyLinksQuery) {
    this.assertEnabled();
    const page = Math.max(1, Number(query.page));
    const limit = Math.min(100, Math.max(1, Number(query.limit)));
    const result = await this.links.findParticipantPage({
      userId,
      direction: query.direction,
      status: query.status,
      page,
      limit,
    });
    return this.pageResponse(result, page, limit, 'Family links retrieved');
  }

  async getForParticipant(userId: string, linkId: string) {
    this.assertEnabled();
    const link = await this.links.findParticipantLink(userId, linkId);
    if (!link) throw new NotFoundException('Family link not found');
    return {
      statusCode: 200,
      message: 'Family link retrieved',
      data: this.toProjection(link),
    };
  }

  async listForAdmin(query: FamilyLinksQuery) {
    this.assertEnabled();
    const page = Math.max(1, Number(query.page));
    const limit = Math.min(100, Math.max(1, Number(query.limit)));
    const result = await this.links.findAdminPage({
      status: query.status,
      page,
      limit,
    });
    return this.pageResponse(
      result,
      page,
      limit,
      'Family links audit retrieved',
    );
  }

  private pageResponse(
    result: { items: FamilyLinkReadModel[]; total: number },
    page: number,
    limit: number,
    message: string,
  ) {
    return {
      statusCode: 200,
      message,
      data: {
        items: result.items.map((item) => this.toProjection(item)),
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  private toProjection(link: FamilyLinkReadModel) {
    return {
      ...link,
      allowedActions:
        link.status === 'pending'
          ? ['accept', 'decline', 'revoke']
          : link.status === 'active'
            ? ['pause', 'revoke']
            : link.status === 'paused'
              ? ['resume', 'revoke']
              : [],
    };
  }

  private assertEnabled() {
    if (this.config.get<boolean>('FAMILY_COMPANION_ENABLED') !== true)
      throw new ForbiddenException('FAMILY_COMPANION_DISABLED');
  }
}
