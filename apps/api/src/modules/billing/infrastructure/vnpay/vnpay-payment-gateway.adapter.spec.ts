import { VnpayPaymentGatewayAdapter } from './vnpay-payment-gateway.adapter';

describe('VnpayPaymentGatewayAdapter', () => {
  const config = { get: jest.fn((key: string) => ({ VNPAY_ENABLED: true, VNPAY_RETURN_URL: 'https://app.example/payment-result' })[key]), getOrThrow: jest.fn(() => 'https://app.example/payment-result') };
  it('converts server-side VND to VNPAY minor units', () => {
    const vnpay = { buildPaymentUrl: jest.fn(() => 'https://sandbox/payment') };
    const adapter = new VnpayPaymentGatewayAdapter(config as never, vnpay as never);
    expect(adapter.createPaymentUrl({ orderCode: 'PAY1', amount: 10_000, ipAddress: '127.0.0.1', expiresAt: new Date('2026-10-22T00:15:00Z') })).toBe('https://sandbox/payment');
    expect(vnpay.buildPaymentUrl).toHaveBeenCalledWith(expect.objectContaining({ vnp_TxnRef: 'PAY1', vnp_Amount: 10_000, vnp_IpAddr: '127.0.0.1', vnp_ExpireDate: 20261022071500 }));
  });
  it('does not treat an unverified callback as successful', async () => {
    const vnpay = { verifyIpnCall: jest.fn().mockResolvedValue({ isVerified: false, isSuccess: true }) };
    const adapter = new VnpayPaymentGatewayAdapter(config as never, vnpay as never);
    await expect(adapter.verifyNotification({ vnp_TxnRef: 'PAY1', vnp_Amount: '1000000', vnp_SecureHash: 'forged' })).resolves.toMatchObject({ verified: false, successful: true, orderCode: 'PAY1', amount: 1_000_000 });
  });
});
