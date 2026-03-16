import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../entities/message.entity';

export class SendMessageDto {
  @ApiProperty({ example: '65e456def789abc012345678' })
  @IsNotEmpty()
  @IsMongoId()
  receiverId: string;

  @ApiProperty({
    example: 'Hello, how are you?',
    minLength: 1,
    maxLength: 5000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiProperty({
    enum: MessageType,
    default: MessageType.TEXT,
    required: false,
  })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiProperty({
    example: 'https://example.com/file.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({ example: 'document.pdf', required: false })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ example: 1024, required: false })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiProperty({
    example: 'application/pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({
    example: '65e789ghi012jkl345678901',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  replyToId?: string;

  @ApiProperty({ example: ['👍', '❤️'], required: false })
  @IsOptional()
  @IsArray()
  reactions?: string[];
}
