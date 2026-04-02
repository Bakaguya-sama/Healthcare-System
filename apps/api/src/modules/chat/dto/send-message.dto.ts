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
import { SenderType } from '../entities/message.entity';
import { Type } from 'class-transformer';
import { IsCloudinaryUrl } from '../../../core/validators/is-cloudinary-url.validator';

export class AttachmentDto {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/healthcare/raw/upload/healthcare/chat/attachments/document.pdf',
    description: '🌥️ Cloudinary URL only. Upload via POST /upload/single first',
  })
  @IsNotEmpty()
  @IsCloudinaryUrl()
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
  doctorSessionId: string;

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
    type: [AttachmentDto],
    description: 'Mảng attachments hỗ trợ gửi nhiều file',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
