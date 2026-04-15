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
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.PATIENT)
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
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.PATIENT)
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
      data: resources.map((r) => ({
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
   * 👤 UPLOAD AVATAR
   *
   * 🔒 USER (own user) or ADMIN
   * Specialized endpoint for user profile avatar upload
   *
   * Usage:
   * - Regular user: POST /upload/avatar (uploads own avatar)
   * - Admin: POST /upload/avatar (can upload for other users)
   *
   * Returns: { file: { url, secureUrl, size } }
   *
   * Workflow:
   * 1. Call this endpoint to get avatar URL
   * 2. Use returned URL in PATCH /users/me { avatarUrl: url }
   */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '👤 Upload user profile avatar (image only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image (jpg, png) - max 10MB',
        },
      },
      required: ['file'],
    },
  })
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No avatar image provided');
    }

    // Validate image file type
    const imageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!imageTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG and PNG images are allowed',
      );
    }

    // Validate image file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size (${file.size} bytes) exceeds maximum (${maxSize} bytes). Max avatar size: 10MB`,
      );
    }

    const result = await this.cloudinaryService.uploadFile(
      file,
      'healthcare/profiles',
      'image',
    );

    this.logger.log(
      `✅ Avatar uploaded for user ${userId}: ${result.publicId}`,
    );

    return {
      statusCode: 201,
      message:
        'Avatar uploaded successfully. Now update your profile with this URL.',
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
   * 📄 UPLOAD DOCTOR VERIFICATION DOCUMENTS
   *
   * 🔒 DOCTOR (own docs) or ADMIN
   * Specialized endpoint for doctor verification document upload
   * Supports batch upload of credentials (max 5 files)
   *
   * Usage:
   * - Doctor: POST /upload/doctor-verification (uploads own verification docs)
   * - Admin: POST /upload/doctor-verification (can upload for other doctors)
   *
   * Returns: { files: [{ url, secureUrl, size }, ...] }
   *
   * Workflow:
   * 1. Call this endpoint to upload 2-5 certificate files
   * 2. Get array of URLs from response
   * 3. Use URLs in PATCH /users/me { verificationDocuments: [...urls] }
   */
  @Post('doctor-verification')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 5))
  @ApiOperation({
    summary: '📄 Upload doctor verification documents (batch, max 5 files)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Verification documents (pdf, doc, docx) - max 5 files, 50MB each',
        },
      },
      required: ['files'],
    },
  })
  async uploadDoctorVerification(
    @CurrentUser('sub') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadResponse> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No verification documents provided');
    }

    if (files.length > 5) {
      throw new BadRequestException(
        `Too many files. Maximum 5 documents allowed, received ${files.length}`,
      );
    }

    // Validate document file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    for (const file of files) {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type for ${file.originalname}. Only PDF and Word documents are allowed`,
        );
      }

      // Validate file size (max 50MB each)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} (${file.size} bytes) exceeds maximum (${maxSize} bytes). Max document size: 50MB`,
        );
      }
    }

    // Upload all files
    const results = await this.cloudinaryService.uploadMultiple(
      files,
      'healthcare/doctors/verification',
      'document',
    );

    this.logger.log(
      `✅ ${results.length} verification documents uploaded for user ${userId}`,
    );

    const uploadedUrls = results.map((result) => result.secureUrl);

    return {
      statusCode: 201,
      message: `${results.length} verification documents uploaded successfully. Now update your profile with these URLs.`,
      data: {
        files: results.map((result) => ({
          originalName: result.filename,
          publicId: result.publicId,
          url: result.url,
          secureUrl: result.secureUrl,
          size: result.size,
        })),
        uploadedAt: new Date(),
        totalSize: results.reduce((sum, r) => sum + r.size, 0),
      },
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
