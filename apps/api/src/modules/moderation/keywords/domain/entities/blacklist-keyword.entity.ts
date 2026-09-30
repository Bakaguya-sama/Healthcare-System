import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class BlacklistKeyword extends Document {
  @ApiProperty({ description: 'Keyword ID' })
  declare _id: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  @ApiProperty({ description: 'Blacklist keyword' })
  keyword: string;
}

export const BlacklistKeywordSchema =
  SchemaFactory.createForClass(BlacklistKeyword);

export type BlacklistKeywordDocument = BlacklistKeyword & Document;

// Create indexes
BlacklistKeywordSchema.index({ keyword: 'text' });
