import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: { private_download_url: jest.fn() },
    uploader: {},
  },
}));

describe('CloudinaryService private export download', () => {
  const privateDownloadUrl = jest.mocked(cloudinary.utils.private_download_url);

  beforeEach(() => {
    jest.clearAllMocks();
    privateDownloadUrl.mockReturnValue('https://download.example/signed');
  });

  it('uses Cloudinary expiring private-download API as an attachment', () => {
    const service = new CloudinaryService({
      getOrThrow: jest.fn(
        (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      ),
    } as never);
    const expiresAt = new Date('2026-11-17T00:02:00.000Z');

    expect(
      service.createPrivateRawDownloadUrl({
        key: 'healthcare/care-report-exports/0123456789abcdef01234567/report.pdf',
        filename: 'report.pdf',
        expiresAt,
      }),
    ).toBe('https://download.example/signed');

    expect(privateDownloadUrl).toHaveBeenCalledWith(
      'healthcare/care-report-exports/0123456789abcdef01234567/report.pdf',
      'pdf',
      {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        attachment: true,
      },
    );
  });
});
