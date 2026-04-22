import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
