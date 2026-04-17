import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  filename: string;
  format: string;
  size: number;
  uploadedAt: Date;
}

export type UploadableFile = {
  originalname: string;
  mimetype?: string;
  buffer: Buffer;
  size: number;
};

/**
 * 🌥️ CLOUDINARY SERVICE
 * Quản lý upload file/ảnh lên Cloudinary cloud storage
 *
 * Features:
 * - Upload ảnh (jpg, png)
 * - Upload document (pdf, doc, docx)
 * - Validate file size & type
 * - Track upload history
 * - Delete file khi cần
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    // ✅ BƯỚC 1: Cấu hình Cloudinary
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        '⚠️ Cloudinary credentials missing! File upload disabled. Set CLOUDINARY_* in .env',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    this.logger.log('✅ Cloudinary initialized');
  }

  /**
   * 📤 UPLOAD SINGLE FILE (ảnh hoặc document)
   *
   * @param file - Express file object từ Multer
   * @param folder - Folder trong Cloudinary (vd: "healthcare/documents")
   * @param fileType - "image" | "document" (xác định cách xử lý)
   * @returns CloudinaryUploadResult
   *
   * KIẾN THỨC:
   * - Cloudinary auto-xóa temp file sau upload
   * - Lưu lại publicId để delete later
   * - URL có thể dùng trong img tag hoặc download link
   */
  async uploadFile(
    file: UploadableFile,
    folder: string,
    fileType: 'image' | 'document' = 'document',
  ): Promise<CloudinaryUploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // ✅ BƯỚC 2: Validate file size
    const maxSize = this.configService.get<number>('MAX_FILE_SIZE', 52428800); // 50MB default
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size (${file.size} bytes) exceeds maximum (${maxSize} bytes)`,
      );
    }

    // ✅ BƯỚC 3: Validate file type
    const allowedTypes = this.getAllowedFileTypes();
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      throw new BadRequestException(
        `File type .${fileExtension} not allowed. Allowed: ${allowedTypes.join(', ')}`,
      );
    }

    return new Promise((resolve, reject) => {
      // ✅ BƯỚC 4: Stream file to Cloudinary
      const publicIdName = `${Date.now()}-${file.originalname}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder, // Organize files by folder
          resource_type: fileType === 'image' ? 'image' : 'raw', // 'raw' for documents
          public_id: publicIdName, // Without extension - Cloudinary will add it
          overwrite: true,
          type: 'upload',
        },
        (error, result) => {
          if (error) {
            this.logger.error(
              `❌ Upload failed for ${file.originalname}:`,
              error,
            );
            return reject(
              new BadRequestException(
                `Upload failed: ${error.message || 'Unknown error'}`,
              ),
            );
          }

          if (!result) {
            this.logger.error(`❌ No result from Cloudinary upload`);
            return reject(
              new BadRequestException(
                'Upload failed: No response from Cloudinary',
              ),
            );
          }

          // ✅ BƯỚC 5: Return result
          this.logger.log(
            `✅ File uploaded: ${result.public_id} (${result.bytes} bytes)`,
          );

          resolve({
            publicId: result.public_id,
            url: result.url, // HTTP URL
            secureUrl: result.secure_url, // HTTPS URL (preferred)
            filename: result.original_filename,
            format: result.format,
            size: result.bytes,
            uploadedAt: new Date(),
          });
        },
      );

      // ✅ BƯỚC 6: Pipe file data to stream
      const stream = Readable.from(file.buffer);

      // Add error handlers
      uploadStream.on('error', (error) => {
        this.logger.error(`❌ Stream error:`, error);
        reject(new BadRequestException(`Stream error: ${error.message}`));
      });

      stream.on('error', (error) => {
        this.logger.error(`❌ Source stream error:`, error);
        reject(
          new BadRequestException(`Source stream error: ${error.message}`),
        );
      });

      stream.pipe(uploadStream);
    });
  }

  /**
   * 📤 UPLOAD MULTIPLE FILES (batch upload)
   *
   * @param files - Array of Express file objects
   * @param folder - Cloudinary folder
   * @param fileType - "image" | "document"
   * @returns Array<CloudinaryUploadResult>
   *
   * Dùng khi một lúc upload nhiều file
   * (VD: Doctor up 3 chứng chỉ lúc verify account)
   */
  async uploadMultiple(
    files: UploadableFile[],
    folder: string,
    fileType: 'image' | 'document' = 'document',
  ): Promise<CloudinaryUploadResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    this.logger.log(`📤 Uploading ${files.length} files to folder: ${folder}`);

    // ✅ Upload tuần tự (không parallel vì có thể overload Cloudinary)
    const results: CloudinaryUploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.uploadFile(files[i], folder, fileType);
        results.push(result);
        this.logger.log(
          `[${i + 1}/${files.length}] ✅ ${files[i].originalname}`,
        );
      } catch (error) {
        this.logger.error(
          `[${i + 1}/${files.length}] ❌ ${files[i].originalname}`,
        );
        throw error;
      }
    }

    return results;
  }

  /**
   * 🗑️ DELETE FILE từ Cloudinary
   *
   * @param publicId - Public ID của file (lưu khi upload)
   * @param fileType - "image" | "document"
   *
   * DÙNG KHI:
   * - User xóa document
   * - Admin xóa profile picture
   * - Cleanup khi xóa user
   */
  async deleteFile(
    publicId: string,
    fileType: 'image' | 'document' = 'document',
  ): Promise<{ success: boolean; message: string }> {
    if (!publicId) {
      throw new BadRequestException('Public ID required for deletion');
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: fileType === 'image' ? 'image' : 'raw',
      });

      if (result.result === 'ok') {
        this.logger.log(`🗑️ File deleted: ${publicId}`);
        return {
          success: true,
          message: `File ${publicId} deleted successfully`,
        };
      } else {
        this.logger.warn(`⚠️ File not found or already deleted: ${publicId}`);
        return {
          success: false,
          message: `File ${publicId} not found`,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Delete failed for ${publicId}:`, error);
      const message =
        error instanceof Error ? error.message : 'Unknown deletion error';
      throw new BadRequestException(`Delete failed: ${message}`);
    }
  }

  /**
   * 📋 DELETE MULTIPLE FILES
   *
   * @param publicIds - Array of public IDs
   * @param fileType - "image" | "document"
   */
  async deleteMultiple(
    publicIds: string[],
    fileType: 'image' | 'document' = 'document',
  ): Promise<{ success: boolean; deleted: number; failed: number }> {
    if (!publicIds || publicIds.length === 0) {
      throw new BadRequestException('No files to delete');
    }

    let deleted = 0;
    let failed = 0;

    for (const publicId of publicIds) {
      try {
        const result = await this.deleteFile(publicId, fileType);
        if (result.success) {
          deleted++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    return { success: failed === 0, deleted, failed };
  }

  /**
   * � DEBUG: List all resources trong Cloudinary
   */
  async listAllResources(prefix?: string) {
    try {
      const result = await cloudinary.api.resources({
        prefix: prefix || 'healthcare',
        max_results: 500,
        type: 'upload',
      });

      return result.resources;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown listing error';
      this.logger.error(`❌ Failed to list resources: ${message}`);
      return [];
    }
  }

  /**
   * �📊 GET FILE INFO từ Cloudinary
   *
   * @param publicId - Public ID của file (full path từ folder)
   * @returns File metadata
   *
   * Dùng để kiểm tra file có tồn tại hay không
   */
  async getFileInfo(publicId: string) {
    try {
      // For raw files (documents), must use resource_type: 'raw' in the API call
      // cloudinary.api.resources() doesn't include raw files
      try {
        const result = await cloudinary.api.resource(publicId, {
          resource_type: 'raw',
        });

        return {
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          size: result.bytes,
          format: result.format,
          uploadedAt: new Date(result.created_at),
        };
      } catch (err) {
        // Fallback: try auto resource type
        try {
          const result = await cloudinary.api.resource(publicId);

          return {
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            size: result.bytes,
            format: result.format,
            uploadedAt: new Date(result.created_at),
          };
        } catch (autoErr) {
          this.logger.warn(`⚠️ File not found: ${publicId}`);
          return null;
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown retrieval error';
      this.logger.error(`❌ Error retrieving file info: ${message}`);
      return null;
    }
  }

  /**
   * 🔍 GET ALLOWED FILE TYPES từ .env
   */
  private getAllowedFileTypes(): string[] {
    const allowed = this.configService.get<string>(
      'ALLOWED_FILE_TYPES',
      'jpg,jpeg,png,pdf,doc,docx,txt',
    );
    return allowed.split(',').map((type) => type.trim().toLowerCase());
  }
}
