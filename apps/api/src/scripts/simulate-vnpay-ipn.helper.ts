import { createHmac } from 'node:crypto';

export interface SandboxSimulationEnv {
  nodeEnv?: string;
  vnpayEnabled?: boolean;
  vnpaySandbox?: boolean;
}

export interface SignedSandboxIpnInput {
  tmnCode: string;
  secureSecret: string;
  orderCode: string;
  amountVnd: number;
  responseCode?: string;
  bankCode?: string;
  payDate?: string;
  transactionNo?: string;
}

/**
 * Ensures simulated VNPAY IPN signing can only execute in non-production
 * environments with VNPAY sandbox mode explicitly enabled.
 */
export function assertSandboxSimulationAllowed(env: SandboxSimulationEnv): void {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Simulated VNPAY IPN is strictly disabled when NODE_ENV=production.',
    );
  }
  if (env.vnpayEnabled !== true) {
    throw new Error('VNPAY_ENABLED must be true to simulate a VNPAY IPN.');
  }
  if (env.vnpaySandbox !== true) {
    throw new Error('VNPAY_SANDBOX must be true to simulate a VNPAY IPN.');
  }
}

/**
 * Formats a Date as yyyyMMddHHmmss in Asia/Ho_Chi_Minh (GMT+7) matching VNPAY's format.
 */
export function formatVnpayPayDateGmt7(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year}${byType.month}${byType.day}${byType.hour}${byType.minute}${byType.second}`;
}

/**
 * Builds and signs a VNPAY Sandbox IPN query payload matching `vnpay`'s
 * `verifyIpnCall` SHA-512 HMAC canonical query serialization.
 */
export function buildSignedSandboxVnpayIpnQuery(
  input: SignedSandboxIpnInput,
): Record<string, string> {
  if (!input.tmnCode.trim() || !input.secureSecret.trim()) {
    throw new Error('VNPAY_TMN_CODE and VNPAY_HASH_SECRET must be configured.');
  }
  if (!input.orderCode.trim()) {
    throw new Error('orderCode is required.');
  }
  if (!Number.isFinite(input.amountVnd) || input.amountVnd <= 0) {
    throw new Error('amountVnd must be a positive number.');
  }

  const responseCode = (input.responseCode || '00').trim();
  const stamp = String(Date.now());
  const payload: Record<string, string> = {
    vnp_Amount: String(Math.round(input.amountVnd * 100)),
    vnp_BankCode: (input.bankCode || 'NCB').trim(),
    vnp_BankTranNo: `SANDBOX${stamp}`,
    vnp_CardType: 'ATM',
    vnp_OrderInfo: `Healthcare order ${input.orderCode}`,
    vnp_PayDate: input.payDate || formatVnpayPayDateGmt7(),
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: input.tmnCode.trim(),
    vnp_TransactionNo: input.transactionNo || stamp.slice(-8),
    vnp_TransactionStatus: responseCode,
    vnp_TxnRef: input.orderCode.trim(),
  };

  const searchParams = new URLSearchParams();
  for (const key of Object.keys(payload).sort()) {
    const val = payload[key];
    if (val !== undefined && val !== '') {
      searchParams.append(key, val);
    }
  }

  const secureHash = createHmac('sha512', input.secureSecret)
    .update(Buffer.from(searchParams.toString(), 'utf-8'))
    .digest('hex');

  return {
    ...payload,
    vnp_SecureHash: secureHash,
  };
}

