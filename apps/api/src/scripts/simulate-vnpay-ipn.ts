import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { OutboxWorkerModule } from '../infrastructure/outbox/outbox-worker.module';
import { PaymentOrderService } from '../modules/billing/application/services/payment-order.service';
import { SubscriptionPaymentGrantService } from '../modules/billing/application/services/subscription-payment-grant.service';
import {
  PaymentOrder,
  type PaymentOrderDocument,
  PaymentOrderStatus,
} from '../modules/billing/domain/entities/payment.entity';
import {
  assertSandboxSimulationAllowed,
  buildSignedSandboxVnpayIpnQuery,
} from './simulate-vnpay-ipn.helper';

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const noGrant = flags.has('--no-grant');
  const orderCodeArg = flags.has('--latest') ? undefined : positional[0];
  const responseCode = positional[1] || '00';

  const context = await NestFactory.createApplicationContext(
    OutboxWorkerModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const config = context.get(ConfigService, { strict: false });
    assertSandboxSimulationAllowed({
      nodeEnv: config.get<string>('NODE_ENV'),
      vnpayEnabled: config.get<boolean>('VNPAY_ENABLED'),
      vnpaySandbox: config.get<boolean>('VNPAY_SANDBOX'),
    });

    const tmnCode = config.getOrThrow<string>('VNPAY_TMN_CODE');
    const secureSecret = config.getOrThrow<string>('VNPAY_HASH_SECRET');

    const orderModel = context.get<Model<PaymentOrderDocument>>(
      getModelToken(PaymentOrder.name),
      { strict: false },
    );

    const order = orderCodeArg
      ? await orderModel.findOne({ orderCode: orderCodeArg }).exec()
      : await orderModel
          .findOne({
            status: {
              $in: [PaymentOrderStatus.CREATED, PaymentOrderStatus.PENDING],
            },
          })
          .sort({ createdAt: -1, _id: -1 })
          .exec();

    if (!order) {
      throw new Error(
        orderCodeArg
          ? `PaymentOrder "${orderCodeArg}" not found.`
          : 'No pending/created PaymentOrder found to simulate.',
      );
    }

    const signedQuery = buildSignedSandboxVnpayIpnQuery({
      tmnCode,
      secureSecret,
      orderCode: order.orderCode,
      amountVnd: order.amount,
      responseCode,
    });

    const payments = context.get(PaymentOrderService, { strict: false });
    const ipnResult = await payments.handleIpn(signedQuery);

    let grantResult: unknown = null;
    if (
      !noGrant &&
      responseCode === '00' &&
      (ipnResult as { RspCode?: string })?.RspCode === '00'
    ) {
      const grants = context.get(SubscriptionPaymentGrantService, {
        strict: false,
      });
      grantResult = await grants.reconcilePaidOrder(String(order._id));
    }

    console.log(
      JSON.stringify({
        orderId: String(order._id),
        orderCode: order.orderCode,
        amount: order.amount,
        currency: order.currency,
        responseCode,
        ipnResult,
        grantResult,
      }),
    );
  } finally {
    await context.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

