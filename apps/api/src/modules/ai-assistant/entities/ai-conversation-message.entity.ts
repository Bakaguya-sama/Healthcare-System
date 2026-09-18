import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MessageAttachment, MessageRole, SentimentType } from './ai-conversation.entity';

/** Canonical, independently pageable message history for an AI conversation. */
@Schema({ timestamps: true, collection: 'aiconversationmessages' })
export class AiConversationMessage {
  @Prop({ type: Types.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(MessageRole), required: true })
  role: MessageRole;

  @Prop({ type: String, required: true, maxlength: 12000 })
  content: string;

  @Prop({ type: Date, required: true })
  timestamp: Date;

  @Prop({ type: [Object], default: [] })
  attachments?: MessageAttachment[];

  @Prop({ type: String, enum: Object.values(SentimentType) })
  sentiment?: SentimentType;

  @Prop({ type: Number, min: 0 })
  tokens?: number;

  /** Stable key for idempotent migration of old embedded/legacy messages. */
  @Prop({ type: String, sparse: true })
  legacySourceKey?: string;
}

export type AiConversationMessageDocument = AiConversationMessage & Document;
export const AiConversationMessageSchema = SchemaFactory.createForClass(AiConversationMessage);

AiConversationMessageSchema.index(
  { conversationId: 1, timestamp: -1, _id: -1 },
  { name: 'conversationId_1_timestamp_-1__id_-1' },
);
AiConversationMessageSchema.index(
  { legacySourceKey: 1 },
  { name: 'legacySourceKey_unique', unique: true, sparse: true },
);
