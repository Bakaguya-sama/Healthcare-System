import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum KnowledgeCandidateStatus {
  PENDING_REVIEW = 'pending_review',
  PROMOTED = 'promoted',
  REJECTED = 'rejected',
}

/** External literature is quarantined here; it is never a retrieval source before promotion. */
@Schema({ timestamps: true, collection: 'knowledgecandidates' })
export class KnowledgeCandidate extends Document {
  declare _id: Types.ObjectId;
  @Prop({ required: true }) pmid: string;
  @Prop({ required: true }) contentHash: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) sourceUrl: string;
  @Prop({
    required: true,
    enum: Object.values(KnowledgeCandidateStatus),
    default: KnowledgeCandidateStatus.PENDING_REVIEW,
  })
  status: KnowledgeCandidateStatus;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId | null;
  @Prop({ type: Date, default: null }) reviewedAt?: Date | null;
  @Prop({ type: String, default: null }) reviewReason?: string | null;
}
export const KnowledgeCandidateSchema =
  SchemaFactory.createForClass(KnowledgeCandidate);
KnowledgeCandidateSchema.index({ pmid: 1 }, { unique: true });
KnowledgeCandidateSchema.index({ contentHash: 1 }, { unique: true });
export type KnowledgeCandidateDocument = KnowledgeCandidate & Document;
