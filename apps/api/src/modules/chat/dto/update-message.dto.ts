import { PartialType } from '@nestjs/mapped-types';
import { SendMessageDto } from './send-message.dto';
import {
  IsOptional,
  IsString,
  IsEnum,
  MinLength,
  MaxLength,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageStatus } from '../entities/message.entity';

export class UpdateMessageDto extends PartialType(SendMessageDto) {
  @ApiProperty({ example: 'Updated message content', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @ApiProperty({
    enum: MessageStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

  @ApiProperty({ example: ['👍', '❤️', '😂'], required: false })
  @IsOptional()
  @IsArray()
  reactions?: string[];
}
