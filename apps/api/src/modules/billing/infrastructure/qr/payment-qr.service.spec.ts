import { PaymentQrService } from './payment-qr.service';

describe('PaymentQrService', () => {
  it('creates a PNG data URL for the complete signed payment URL', async () => {
    await expect(
      new PaymentQrService().toDataUrl(
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=PAY1&vnp_SecureHash=signed',
      ),
    ).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
