import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CareContentDocument = HydratedDocument<CareContent>;

export enum CareContentDisplayType {
  ARTICLE = 'article',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export enum CareContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}

@Schema({ timestamps: true, collection: 'carecontents' })
export class CareContent {
  @Prop({ required: true, trim: true, maxlength: 64 }) contentId: string;
  @Prop({ required: true, trim: true, maxlength: 64 }) version: string;
  @Prop({ required: true, trim: true, maxlength: 35 }) locale: string;
  @Prop({ required: true, enum: CareContentDisplayType })
  displayType: CareContentDisplayType;
  @Prop({ required: true, enum: CareContentStatus }) status: CareContentStatus;
  @Prop({ required: true, trim: true, maxlength: 200 }) title: string;
  @Prop({ trim: true, maxlength: 1000 }) summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CareContentSchema = SchemaFactory.createForClass(CareContent);
CareContentSchema.index(
  { contentId: 1, version: 1, locale: 1, displayType: 1 },
  { name: 'content_ref_unique', unique: true },
);
CareContentSchema.index(
  { status: 1, contentId: 1, version: 1 },
  { name: 'status_1_contentId_1_version_1' },
);
