export const CARE_REPORT_EXPORT_STORAGE = Symbol('CARE_REPORT_EXPORT_STORAGE');

export interface CareReportExportStoragePort {
  put(input: {
    key: string;
    body: Buffer;
    mimeType: string;
  }): Promise<{ byteSize: number }>;
  createSignedDownload(input: {
    key: string;
    filename: string;
    expiresAt: Date;
  }): Promise<string>;
  delete(key: string): Promise<void>;
}
