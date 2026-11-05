import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CareContent,
  CareContentDocument,
  CareContentStatus,
} from '../../domain/entities/care-content.entity';
import type {
  ContentCatalogPort,
  EducationContentRef,
} from '../../application/ports/content-catalog.port';

@Injectable()
export class MongoContentCatalogAdapter implements ContentCatalogPort {
  constructor(
    @InjectModel(CareContent.name)
    private readonly contents: Model<CareContentDocument>,
  ) {}

  async resolvePublished(reference: EducationContentRef) {
    const content = await this.contents
      .findOne({ ...reference, status: CareContentStatus.PUBLISHED })
      .select('contentId version locale displayType title summary')
      .lean()
      .exec();
    if (!content) return null;
    return {
      contentId: content.contentId,
      version: content.version,
      locale: content.locale,
      displayType: content.displayType,
      title: content.title,
      ...(content.summary ? { summary: content.summary } : {}),
    };
  }
}
