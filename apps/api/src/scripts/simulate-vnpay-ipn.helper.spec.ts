import { VNPay } from 'vnpay';
import {
  assertSandboxSimulationAllowed,
  buildSignedSandboxVnpayIpnQuery,
} from './simulate-vnpay-ipn.helper';

describe('simulate-vnpay-ipn helper', () => {
  it('blocks simulation in production or when sandbox/vnpay is disabled', () => {
    expect(() =>
      assertSandboxSimulationAllowed({
        nodeEnv: 'production',
        vnpayEnabled: true,
        vnpaySandbox: true,
      }),
    ).toThrow('NODE_ENV=production');

    expect(() =>
      assertSandboxSimulationAllowed({
        nodeEnv: 'development',
        vnpayEnabled: false,
        vnpaySandbox: true,
      }),
    ).toThrow('VNPAY_ENABLED');

    expect(() =>
      assertSandboxSimulationAllowed({
        nodeEnv: 'development',
        vnpayEnabled: true,
        vnpaySandbox: false,
      }),
    ).toThrow('VNPAY_SANDBOX');

    expect(() =>
      assertSandboxSimulationAllowed({
        nodeEnv: 'development',
        vnpayEnabled: true,
        vnpaySandbox: true,
      }),
    ).not.toThrow();
  });

  it('produces an IPN query accepted by VNPay.verifyIpnCall', () => {
    const tmnCode = 'TESTTMN01';
    const secureSecret = 'SANDBOXSECRETKEY1234567890ABCDEF';
    const vnpay = new VNPay({
      tmnCode,
      secureSecret,
      testMode: true,
    });

    const successQuery = buildSignedSandboxVnpayIpnQuery({
      tmnCode,
      secureSecret,
      orderCode: 'PAY123456TEST',
      amountVnd: 199_000,
      responseCode: '00',
      payDate: '20261121160000',
      transactionNo: '14000001',
    });

    const verifiedSuccess = vnpay.verifyIpnCall(successQuery as never);
    expect(verifiedSuccess.isVerified).toBe(true);
    expect(verifiedSuccess.isSuccess).toBe(true);
    expect(verifiedSuccess.vnp_Amount).toBe(199_000);
    expect(verifiedSuccess.vnp_TxnRef).toBe('PAY123456TEST');

    const cancelledQuery = buildSignedSandboxVnpayIpnQuery({
      tmnCode,
      secureSecret,
      orderCode: 'PAY123456CANCEL',
      amountVnd: 199_000,
      responseCode: '24',
      payDate: '20261121160001',
      transactionNo: '14000002',
    });

    const verifiedCancel = vnpay.verifyIpnCall(cancelledQuery as never);
    expect(verifiedCancel.isVerified).toBe(true);
    expect(verifiedCancel.isSuccess).toBe(false);
    expect(verifiedCancel.vnp_ResponseCode).toBe('24');
  });
});

