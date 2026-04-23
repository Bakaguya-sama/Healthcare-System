import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsEnum,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SenderType } from '../entities/message.entity';

export type UploadedAttachment = {
  mimetype: string;
  originalname: string;
  buffer: Buffer;
  size: number;
};

export type UploadedAttachmentMetadata = {
  publicId: string;
  fileUrl: string;
  cloudinaryResourceType: 'image' | 'document';
  mimeType: string;
  fileName: string;
  size: number;
};

export class MessageAttachmentDto {
  @ApiProperty({
    description: 'URL của file đã được upload lên Cloudinary',
    example: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  })
  @IsUrl()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiProperty({ description: 'Tên file gốc', example: 'sample.jpg' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ description: 'Kích thước file (bytes)', example: 12345 })
  @IsNumber()
  @IsOptional()
  size?: number;

  @ApiProperty({ description: 'Loại MIME của file', example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;
}

export class SendMessageDto {
  @ApiProperty({ example: '65e456def789abc012345678' })
  @IsNotEmpty()
  @IsMongoId()
  doctorSessionId!: string;

  @ApiProperty({
    enum: SenderType,
    default: SenderType.PATIENT,
    description: 'Loại người gửi: patient hoặc doctor',
  })
  @IsNotEmpty()
  @IsEnum(SenderType)
  senderType!: SenderType;

  @ApiProperty({
    example: 'Hello, how are you?',
    minLength: 1,
    maxLength: 5000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @ApiProperty({
    type: [MessageAttachmentDto],
    required: false,
    description:
      'Mảng thông tin các file đính kèm đã được upload. Dùng cho WebSocket.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
