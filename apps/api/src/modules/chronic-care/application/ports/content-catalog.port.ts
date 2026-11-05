import type { CareContentDisplayType } from '../../domain/entities/care-content.entity';

export const CONTENT_CATALOG_PORT = Symbol('CONTENT_CATALOG_PORT');

export type EducationContentRef = {
  contentId: string;
  version: string;
  locale: string;
  displayType: CareContentDisplayType;
};

export type PublishedCareContent = EducationContentRef & {
  title: string;
  summary?: string;
};

export interface ContentCatalogPort {
  resolvePublished(
    reference: EducationContentRef,
  ): Promise<PublishedCareContent | null>;
}
