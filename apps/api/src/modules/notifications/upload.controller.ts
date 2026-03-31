import {
  Controller,
  Post,
  Delete,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import {
  UploadFileDto,
  UploadMultipleFilesDto,
  FileUploadFolderType,
  UploadResponse,
} from './dto/upload-file.dto';

/**
 * 📤 FILE UPLOAD CONTROLLER
 * 
 * Xử lý upload file/ảnh lên Cloudinary
 * 
 * ENDPOINTS:
 * - POST /upload/single - Upload 1 file
 * - POST /upload/multiple - Upload nhiều files
 * - GET /upload/:publicId - Get file info
 * - DELETE /upload/:publicId - Delete file
 */
@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private cloudinaryService: CloudinaryService) {}

  /**
   * 📤 UPLOAD SINGLE FILE
   * 
   * USAGE:
   * const formData = new FormData();
   * formData.append('file', fileInput.files[0]);
   * formData.append('folder', 'healthcare/profiles');
   * formData.append('fileType', 'image');
   * 
   * fetch('/api/v1/upload/single', {
   *   method: 'POST',
   *   headers: { Authorization: 'Bearer token' },
   *   body: formData
   * });
   */
  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload 1 file lên Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File + metadata',
    type: UploadFileDto,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File cần upload',
        },
        folder: {
          type: 'string',
          enum: Object.values(FileUploadFolderType),
          description: 'Folder trong Cloudinary',
        },
        fileType: {
          type: 'string',
          enum: ['image', 'document'],
          description: 'Loại file',
        },
      },
      required: ['file', 'folder', 'fileType'],
    },
  })
  async uploadSingle(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.validateDto(dto);

    const result = await this.cloudinaryService.uploadFile(
      file,
      dto.folder,
      dto.fileType,
    );

    return {
      statusCode: 201,
      message: 'File uploaded successfully',
      data: {
        files: [
          {
            originalName: file.originalname,
            publicId: result.publicId,
            url: result.url,
            secureUrl: result.secureUrl,
            size: result.size,
          },
        ],
        uploadedAt: result.uploadedAt,
        totalSize: result.size,
      },
    };
  }

  /**
   * 📤 UPLOAD MULTIPLE FILES
   * 
   * USAGE:
   * const formData = new FormData();
   * formData.append('files', fileInput.files[0]);
   * formData.append('files', fileInput.files[1]);
   * formData.append('folder', 'healthcare/doctors/verification');
   * formData.append('fileType', 'document');
   */
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  @ApiOperation({ summary: 'Upload nhiều files lên Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Multiple files + metadata',
    type: UploadMultipleFilesDto,
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Multiple files',
        },
        folder: {
          type: 'string',
          enum: Object.values(FileUploadFolderType),
        },
        fileType: {
          type: 'string',
          enum: ['image', 'document'],
        },
      },
      required: ['files', 'folder', 'fileType'],
    },
  })
  async uploadMultiple(
    @CurrentUser('sub') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadMultipleFilesDto,
  ): Promise<UploadResponse> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    this.validateDto(dto);

    const results = await this.cloudinaryService.uploadMultiple(
      files,
      dto.folder,
      dto.fileType,
    );

    const totalSize = results.reduce((sum, r) => sum + r.size, 0);

    return {
      statusCode: 201,
      message: `${results.length} files uploaded successfully`,
      data: {
        files: results.map((result, index) => ({
          originalName: files[index].originalname,
          publicId: result.publicId,
          url: result.url,
          secureUrl: result.secureUrl,
          size: result.size,
        })),
        uploadedAt: new Date(),
        totalSize,
      },
    };
  }

  /**
   * 🔍 GET FILE INFO
   */
  @Get(':publicId')
  @ApiOperation({ summary: 'Lấy thông tin file từ Cloudinary' })
  async getFileInfo(@Param('publicId') publicId: string) {
    const fileInfo = await this.cloudinaryService.getFileInfo(publicId);

    if (!fileInfo) {
      throw new BadRequestException('File not found');
    }

    return {
      statusCode: 200,
      message: 'File info retrieved',
      data: fileInfo,
    };
  }

  /**
   * 🗑️ DELETE FILE
   */
  @Delete(':publicId')
  @ApiOperation({ summary: 'Xóa file từ Cloudinary' })
  @ApiBody({
    description: 'File type (tùy chọn)',
    schema: {
      type: 'object',
      properties: {
        fileType: {
          type: 'string',
          enum: ['image', 'document'],
          default: 'document',
        },
      },
    },
  })
  async deleteFile(
    @CurrentUser('sub') userId: string,
    @Param('publicId') publicId: string,
    @Body() body?: { fileType?: 'image' | 'document' },
  ) {
    const result = await this.cloudinaryService.deleteFile(
      publicId,
      body?.fileType || 'document',
    );

    return {
      statusCode: 200,
      message: 'File deleted successfully',
      data: result,
    };
  }

  /**
   * 🗑️ DELETE MULTIPLE FILES
   */
  @Post('delete-multiple')
  @ApiOperation({ summary: 'Xóa nhiều files từ Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        publicIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['public_id_1', 'public_id_2'],
        },
        fileType: {
          type: 'string',
          enum: ['image', 'document'],
          default: 'document',
        },
      },
      required: ['publicIds'],
    },
  })
  async deleteMultiple(
    @CurrentUser('sub') userId: string,
    @Body() body: { publicIds: string[]; fileType?: 'image' | 'document' },
  ) {
    if (!body.publicIds || body.publicIds.length === 0) {
      throw new BadRequestException('No files to delete');
    }

    const result = await this.cloudinaryService.deleteMultiple(
      body.publicIds,
      body.fileType || 'document',
    );

    return {
      statusCode: 200,
      message: 'Files deleted',
      data: result,
    };
  }

  /**
   * ✅ VALIDATE DTO
   */
  private validateDto(dto: UploadFileDto | UploadMultipleFilesDto) {
    if (!Object.values(FileUploadFolderType).includes(dto.folder as any)) {
      throw new BadRequestException('Invalid folder type');
    }

    if (!['image', 'document'].includes(dto.fileType)) {
      throw new BadRequestException('Invalid file type');
    }
  }
}
