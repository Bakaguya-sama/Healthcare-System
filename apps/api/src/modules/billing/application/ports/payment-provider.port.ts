export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
export type PaymentUrlInput = {
  orderCode: string;
  amount: number;
  ipAddress: string;
  expiresAt: Date;
};
export type VerifiedPaymentNotification = {
  verified: boolean;
  successful: boolean;
  orderCode?: string;
  amount?: number;
  providerTransactionNo?: string;
  responseCode?: string;
  bankCode?: string;
  sanitizedPayload: Record<string, string>;
};
export interface PaymentProviderPort {
  createPaymentUrl(input: PaymentUrlInput): string;
  verifyNotification(
    query: Record<string, string | undefined>,
  ): Promise<VerifiedPaymentNotification>;
}
