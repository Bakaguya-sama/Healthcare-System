import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';

/** Generates a transient QR image for a signed payment URL; nothing is persisted. */
@Injectable()
export class PaymentQrService {
  toDataUrl(paymentUrl: string): Promise<string> {
    return QRCode.toDataURL(paymentUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });
  }
}
