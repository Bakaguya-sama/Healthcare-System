import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ConversationType {
  HEALTH_INQUIRY = 'health_inquiry',
  SYMPTOM_ANALYSIS = 'symptom_analysis',
  HEALTH_EDUCATION = 'health_education',
  TEST_RESULT_EXPLANATION = 'test_result_explanation',
  MEDICATION_INFO = 'medication_info',
  GENERAL_CONSULTATION = 'general_consultation',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum SentimentType {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  URGENT = 'urgent',
}

export interface MessageAttachment {
  publicId: string;
  secureUrl: string;
  fileType: 'image';
  mimeType: string;
  originalName: string;
  size: number;
  description?: string;
}

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
  attachments?: MessageAttachment[];
  sentiment?: SentimentType;
  tokens?: number;
}

export interface FollowUpAction {
  type: 'schedule_appointment' | 'consult_doctor' | 'visit_clinic' | 'none';
  description: string;
  priority: 'low' | 'medium' | 'high';
}

@Schema({ timestamps: true, collection: 'aiconversations' })
export class AiConversation {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ConversationType),
    default: ConversationType.GENERAL_CONSULTATION,
  })
  type: ConversationType;

  @Prop({ type: String, required: true, minlength: 5, maxlength: 500 })
  topic: string;

  @Prop({ type: String, maxlength: 2000 })
  summary?: string;

  @Prop({ type: Object })
  followUpAction?: FollowUpAction;

  @Prop({ type: Number, default: 0, min: 0, index: true })
  totalTokensUsed: number;

  @Prop({ type: Number, default: 0, min: 0 })
  messageCount: number;

  @Prop({ type: Date })
  lastMessageAt: Date;

  @Prop({ type: Boolean, default: false })
  isArchived: boolean;

  @Prop({ type: Date })
  archivedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isFavorite: boolean;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  rating?: number;

  @Prop({ type: String, maxlength: 500 })
  ratingComment?: string;

  @Prop({
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'active',
  })
  status: 'draft' | 'active' | 'completed' | 'archived';

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, maxlength: 1000 })
  internalNotes?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type AiConversationDocument = AiConversation & Document;

export const AiConversationSchema =
  SchemaFactory.createForClass(AiConversation);

// Indexes
AiConversationSchema.index(
  { userId: 1, createdAt: -1, _id: -1 },
  { name: 'userId_1_createdAt_-1__id_-1' },
);
AiConversationSchema.index(
  { userId: 1, lastMessageAt: -1, _id: -1 },
  { name: 'userId_1_lastMessageAt_-1__id_-1' },
);
AiConversationSchema.index(
  { userId: 1, status: 1, lastMessageAt: -1, _id: -1 },
  { name: 'userId_1_status_1_lastMessageAt_-1__id_-1' },
);
AiConversationSchema.index(
  { userId: 1, type: 1, createdAt: -1, _id: -1 },
  { name: 'userId_1_type_1_createdAt_-1__id_-1' },
);
AiConversationSchema.index(
  { userId: 1, status: 1, createdAt: -1, _id: -1 },
  { name: 'userId_1_status_1_createdAt_-1__id_-1' },
);
AiConversationSchema.index(
  { userId: 1, isArchived: 1, createdAt: -1, _id: -1 },
  { name: 'userId_1_isArchived_1_createdAt_-1__id_-1' },
);
