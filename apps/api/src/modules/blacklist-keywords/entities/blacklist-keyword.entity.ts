import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export enum KeywordSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum KeywordCategory {
  OFFENSIVE = 'offensive',
  SPAM = 'spam',
  MISINFORMATION = 'misinformation',
  HARMFUL = 'harmful',
  PROHIBITED = 'prohibited',
  ADULT = 'adult',
  VIOLENCE = 'violence',
  DISCRIMINATION = 'discrimination',
}

@Schema({ timestamps: true })
export class BlacklistKeyword extends Document {
  @ApiProperty({ description: 'Keyword ID' })
  declare _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  @ApiProperty({ description: 'The keyword/phrase to block' })
  keyword: string;

  @Prop({ required: true, enum: Object.values(KeywordCategory) })
  @ApiProperty({ description: 'Category of blocked keyword', enum: Object.values(KeywordCategory) })
  category: KeywordCategory;

  @Prop({ required: true, enum: Object.values(KeywordSeverity), default: KeywordSeverity.MEDIUM })
  @ApiProperty({ description: 'Severity level', enum: Object.values(KeywordSeverity) })
  severity: KeywordSeverity;
}

export const BlacklistKeywordSchema = SchemaFactory.createForClass(BlacklistKeyword);

export type BlacklistKeywordDocument = BlacklistKeyword & Document;

// Create indexes
BlacklistKeywordSchema.index({ keyword: 'text', category: 1 });
BlacklistKeywordSchema.index({ category: 1, severity: 1 });
BlacklistKeywordSchema.index({ isActive: 1 });
