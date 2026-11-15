import { Injectable } from '@nestjs/common';
import { CloudinaryService } from '../../../../infrastructure/files/cloudinary.service';
import type { CareReportExportStoragePort } from '../../application/ports/care-report-export-storage.port';

@Injectable()
export class CloudinaryCareReportExportStorageAdapter implements CareReportExportStoragePort {
  constructor(private readonly cloudinary: CloudinaryService) {}

  put(input: { key: string; body: Buffer; mimeType: string }) {
    return this.cloudinary.putPrivateRawObject(input);
  }

  createSignedDownload(input: {
    key: string;
    filename: string;
    expiresAt: Date;
  }) {
    return Promise.resolve(this.cloudinary.createPrivateRawDownloadUrl(input));
  }

  async delete(key: string) {
    await this.cloudinary.deletePrivateRawObject(key);
  }
}
