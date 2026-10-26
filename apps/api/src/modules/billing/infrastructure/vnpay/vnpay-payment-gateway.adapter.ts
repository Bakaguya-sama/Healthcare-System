import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VnpayService } from 'nestjs-vnpay';
import {
  PaymentProviderPort,
  PaymentUrlInput,
  VerifiedPaymentNotification,
} from '../../application/ports/payment-provider.port';

@Injectable()
export class VnpayPaymentGatewayAdapter implements PaymentProviderPort {
  constructor(
    private readonly config: ConfigService,
    private readonly vnpay: VnpayService,
  ) {}
  createPaymentUrl(input: PaymentUrlInput): string {
    if (!this.config.get<boolean>('VNPAY_ENABLED'))
      throw new ServiceUnavailableException('VNPAY payments are disabled');
    return this.vnpay.buildPaymentUrl({
      // `vnpay` performs the VND × 100 conversion when it builds the URL.
      // Persisted order amount remains whole VND; IPN is still checked against
      // `order.amount * 100` because callbacks carry VNPAY's minor unit.
      vnp_Amount: input.amount,
      vnp_TxnRef: input.orderCode,
      vnp_OrderInfo: `Healthcare order ${input.orderCode}`,
      vnp_OrderType: 'other',
      vnp_IpAddr: normalizeIpAddress(input.ipAddress),
      vnp_ReturnUrl: this.config.getOrThrow<string>('VNPAY_RETURN_URL'),
      // Do not let the library infer this from the host timezone: both dates
      // must use the same explicit VNPAY GMT+7 contract.
      vnp_CreateDate: formatVnpayDate(new Date()),
      // VNPAY requires yyyyMMddHHmmss in GMT+7, not a JavaScript Date.
      vnp_ExpireDate: formatVnpayDate(input.expiresAt),
      vnp_Locale: 'vn',
    } as never);
  }
  async verifyNotification(
    query: Record<string, string | undefined>,
  ): Promise<VerifiedPaymentNotification> {
    const result = (await this.vnpay.verifyIpnCall(
      query as never,
    )) as unknown as Record<string, unknown>;
    const data = Object.fromEntries(
      Object.entries(query)
        .filter(
          ([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType',
        )
        .map(([key, value]) => [key, value ?? '']),
    );
    return {
      verified: result.isVerified === true,
      successful: result.isSuccess === true,
      orderCode: query.vnp_TxnRef,
      amount: query.vnp_Amount ? Number(query.vnp_Amount) : undefined,
      providerTransactionNo: query.vnp_TransactionNo,
      responseCode: query.vnp_ResponseCode,
      bankCode: query.vnp_BankCode,
      sanitizedPayload: data,
    };
  }
}

function formatVnpayDate(value: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return Number(
    `${byType.year}${byType.month}${byType.day}${byType.hour}${byType.minute}${byType.second}`,
  );
}

function normalizeIpAddress(value: string): string {
  const first = value.split(',')[0]?.trim() || '127.0.0.1';
  if (first === '::1') return '127.0.0.1';
  return first.startsWith('::ffff:') ? first.slice('::ffff:'.length) : first;
}
