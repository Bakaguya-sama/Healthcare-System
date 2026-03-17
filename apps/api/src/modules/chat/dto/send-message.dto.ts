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
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageType, SenderType } from '../entities/message.entity';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @ApiProperty({ example: 'https://example.com/file.pdf' })
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @ApiProperty({ example: 'document.pdf' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({ example: 1024, required: false })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiProperty({ example: 'application/pdf', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: '65e456def789abc012345678' })
  @IsNotEmpty()
  @IsMongoId()
  receiverId: string;

  @ApiProperty({
    enum: SenderType,
    default: SenderType.PATIENT,
    description: 'Loại người gửi: patient hoặc doctor',
  })
  @IsNotEmpty()
  @IsEnum(SenderType)
  senderType: SenderType;

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
    type: [AttachmentDto],
    description: 'Mảng attachments hỗ trợ gửi nhiều file',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiProperty({
    example: 'https://example.com/file.pdf',
    required: false,
    deprecated: true,
    description: 'Deprecated - use attachments array instead',
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
