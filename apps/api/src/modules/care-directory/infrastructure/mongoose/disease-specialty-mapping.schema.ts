import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DiseaseSpecialtyMappingDocument = HydratedDocument<DiseaseSpecialtyMapping>;

@Schema({ timestamps: true, collection: 'diseasespecialties' })
export class DiseaseSpecialtyMapping {
  @Prop({ required: true, enum: ['program', 'disease'] }) scope: 'program' | 'disease';
  @Prop({ required: true, trim: true, lowercase: true, maxlength: 80 }) scopeKey: string;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ required: true, min: 1, default: 1 }) revision: number;
  @Prop({ required: true, enum: ['draft', 'published', 'retired'] }) status: 'draft' | 'published' | 'retired';
  @Prop({ type: [String], required: true }) specialtyCodes: string[];
  @Prop({ type: [String], required: true }) sourceReferences: string[];
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' }) createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) updatedBy?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) publishedBy?: Types.ObjectId;
  @Prop() publishedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) retiredBy?: Types.ObjectId;
  @Prop() retiredAt?: Date;
}

export const DiseaseSpecialtyMappingSchema = SchemaFactory.createForClass(DiseaseSpecialtyMapping);
DiseaseSpecialtyMappingSchema.index({ scope: 1, scopeKey: 1, version: 1 }, { name: 'scope_1_scopeKey_1_version_1_unique', unique: true });
DiseaseSpecialtyMappingSchema.index({ scope: 1, scopeKey: 1 }, { name: 'one_published_mapping_per_scope', unique: true, partialFilterExpression: { status: 'published' } });
DiseaseSpecialtyMappingSchema.index({ status: 1, scope: 1, scopeKey: 1 }, { name: 'status_1_scope_1_scopeKey_1' });
