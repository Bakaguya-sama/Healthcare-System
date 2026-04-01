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
  Query,
  BadRequestException,
  Logger,
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
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import {
  UploadFileDto,
  UploadMultipleFilesDto,
  FileUploadFolderType,
  UploadResponse,
} from './dto/upload-file.dto';
import { UserRole } from '../../modules/users/enums/user-role.enum';

/**
 * 📤 FILE UPLOAD CONTROLLER
 * 
 * Xử lý upload file/ảnh lên Cloudinary
 * 
 * 🔒 ROLE RESTRICTION:
 * - Only SUPER_ADMIN & AI_ADMIN can upload/delete files
 * - Other roles: 403 Forbidden
 * 
 * ENDPOINTS:
 * - POST /upload/single - Upload 1 file (ADMIN ONLY)
 * - POST /upload/multiple - Upload nhiều files (ADMIN ONLY)
 * - GET /upload/:publicId - Get file info (ADMIN ONLY)
 * - DELETE /upload/:publicId - Delete file (ADMIN ONLY)
 */
@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private cloudinaryService: CloudinaryService) {}

  /**
   * 📤 UPLOAD SINGLE FILE
   * 
   * 🔒 ADMIN ONLY: super_admin, ai_admin
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
  @Roles(UserRole.ADMIN)
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

    this.logger.log(`✅ File uploaded with publicId: ${result.publicId}`);

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
   * 🔒 ADMIN ONLY: super_admin, ai_admin
   * 
   * USAGE:
   * const formData = new FormData();
   * formData.append('files', fileInput.files[0]);
   * formData.append('files', fileInput.files[1]);
   * formData.append('folder', 'healthcare/doctors/verification');
   * formData.append('fileType', 'document');
   */
  @Post('multiple')
  @Roles(UserRole.ADMIN)
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
   * 
   * 🔒 ADMIN ONLY
   * 
   * Endpoint: GET /upload/info?publicId=healthcare/profiles/filename.pdf
   * (Query parameter instead of path to avoid path-to-regexp issues)
   */
  @Get('info')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lấy thông tin file từ Cloudinary (ADMIN ONLY)' })
  async getFileInfo(@Query('publicId') publicId: string) {
    if (!publicId) {
      throw new BadRequestException('publicId query parameter required');
    }

    this.logger.log(`🔍 Getting file info for: ${publicId}`);
    
    const fileInfo = await this.cloudinaryService.getFileInfo(publicId);

    if (!fileInfo) {
      this.logger.warn(`⚠️ File not found: ${publicId}`);
      throw new BadRequestException('File not found');
    }

    this.logger.log(`✅ File info retrieved: ${publicId}`);

    return {
      statusCode: 200,
      message: 'File info retrieved',
      data: fileInfo,
    };
  }

  /**
   * 🔍 DEBUG: List all files in Cloudinary (ADMIN ONLY)
   */
  @Get('debug/list')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'DEBUG: List all files in Cloudinary' })
  async debugListFiles() {
    this.logger.log('📋 Listing all Cloudinary resources...');
    const resources = await this.cloudinaryService.listAllResources();
    
    return {
      statusCode: 200,
      message: `Found ${resources.length} resources`,
      data: resources.map(r => ({
        publicId: r.public_id,
        size: r.bytes,
        format: r.format,
        uploadedAt: r.created_at,
      })),
    };
  }

  /**
   * 🗑️ DELETE FILE
   * 
   * 🔒 ADMIN ONLY
   * 
   * Endpoint: DELETE /upload/delete?publicId=healthcare/profiles/filename.pdf
   * (Query parameter instead of path to avoid path-to-regexp issues)
   */
  @Delete('delete')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa file từ Cloudinary (ADMIN ONLY)' })
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
    @Query('publicId') publicId: string,
    @Body() body?: { fileType?: 'image' | 'document' },
  ) {
    if (!publicId) {
      throw new BadRequestException('publicId query parameter required');
    }

    this.logger.log(`🗑️ Deleting file: ${publicId}`);
    
    const result = await this.cloudinaryService.deleteFile(
      publicId,
      body?.fileType || 'document',
    );

    this.logger.log(`✅ File deleted: ${publicId}`);

    return {
      statusCode: 200,
      message: 'File deleted successfully',
      data: result,
    };
  }

  /**
   * 🗑️ DELETE MULTIPLE FILES
   * 
   * 🔒 ADMIN ONLY
   */
  @Post('delete-multiple')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa nhiều files từ Cloudinary (ADMIN ONLY)' })
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
