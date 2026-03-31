import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum FileUploadFolderType {
  PROFILE_IMAGES = 'healthcare/profiles',
  DOCTOR_VERIFICATION = 'healthcare/doctors/verification',
  HEALTH_DOCUMENTS = 'healthcare/documents/health',
  MEDICAL_RECORDS = 'healthcare/documents/records',
  CHAT_ATTACHMENTS = 'healthcare/chat/attachments',
  AI_KNOWLEDGE_BASE = 'healthcare/ai/knowledge-base',
}

/**
 * 📤 FILE UPLOAD DTO
 * 
 * Dùng khi upload file qua endpoint
 * File data sẽ được lấy từ multipart form-data (Multer)
 */
export class UploadFileDto {
  @ApiProperty({
    description: 'Loại folder lưu file',
    enum: FileUploadFolderType,
    example: FileUploadFolderType.PROFILE_IMAGES,
  })
  @IsEnum(FileUploadFolderType)
  folder: FileUploadFolderType;

  @ApiProperty({
    description: 'File type: image hoặc document',
    enum: ['image', 'document'],
    example: 'image',
  })
  @IsString()
  fileType: 'image' | 'document';

  @ApiProperty({
    description: 'Mô tả file (tùy chọn)',
    example: 'Dr. medical license',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * 📤 MULTIPLE FILE UPLOAD DTO
 */
export class UploadMultipleFilesDto {
  @ApiProperty({
    description: 'Loại folder lưu file',
    enum: FileUploadFolderType,
  })
  @IsEnum(FileUploadFolderType)
  folder: FileUploadFolderType;

  @ApiProperty({
    description: 'File type: image hoặc document',
    enum: ['image', 'document'],
  })
  @IsString()
  fileType: 'image' | 'document';

  @ApiProperty({
    description: 'Array mô tả cho từng file (tùy chọn)',
    type: [String],
    required: false,
  })
  @IsOptional()
  descriptions?: string[];
}

/**
 * 📁 UPLOAD RESPONSE
 */
export interface UploadResponse {
  statusCode: number;
  message: string;
  data: {
    files: Array<{
      originalName: string;
      publicId: string;
      url: string;
      secureUrl: string;
      size: number;
    }>;
    uploadedAt: Date;
    totalSize: number;
  };
}
