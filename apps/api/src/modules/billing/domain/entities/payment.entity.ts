import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { PlanSnapshot } from './plan.entity';

export type PaymentOrderDocument = HydratedDocument<PaymentOrder>;
export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;

export enum PaymentOrderStatus {
  CREATED = 'created',
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
}
export enum PaymentTransactionStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

@Schema({ timestamps: true, collection: 'paymentorders' })
export class PaymentOrder {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, ref: 'Plan' })
  planId!: Types.ObjectId;
  @Prop({ required: true, unique: true, maxlength: 64 }) orderCode!: string;
  @Prop({ required: true, unique: true, maxlength: 128 })
  idempotencyKey!: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  orderSnapshot!: PlanSnapshot & { price: number; currency: string };
  @Prop({ required: true, min: 1 }) amount!: number;
  @Prop({ required: true, default: 'VND', maxlength: 8 }) currency!: string;
  @Prop({ required: true, enum: PaymentOrderStatus })
  status!: PaymentOrderStatus;
  @Prop({ required: true }) expiresAt!: Date;
  @Prop() paidAt?: Date;
  @Prop() cancelledAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) cancelledBy?: Types.ObjectId;
  @Prop({ maxlength: 64 }) cancellationReason?: string;
}
export const PaymentOrderSchema = SchemaFactory.createForClass(PaymentOrder);
PaymentOrderSchema.index(
  { orderCode: 1 },
  { name: 'orderCode_1', unique: true },
);
PaymentOrderSchema.index(
  { idempotencyKey: 1 },
  { name: 'idempotencyKey_1', unique: true },
);
PaymentOrderSchema.index(
  { userId: 1, status: 1, createdAt: -1 },
  { name: 'userId_1_status_1_createdAt_-1' },
);
PaymentOrderSchema.index({ expiresAt: 1 }, { name: 'expiresAt_1' });

@Schema({ timestamps: true, collection: 'paymenttransactions' })
export class PaymentTransaction {
  @Prop({ type: Types.ObjectId, required: true, ref: PaymentOrder.name })
  orderId!: Types.ObjectId;
  @Prop({ required: true, default: 'vnpay', maxlength: 32 }) provider!: string;
  @Prop({ required: true, unique: true, maxlength: 64 })
  transactionRef!: string;
  @Prop({ unique: true, sparse: true, maxlength: 64 })
  providerTransactionNo?: string;
  @Prop({ required: true, min: 1 }) amount!: number;
  @Prop({ required: true, enum: PaymentTransactionStatus })
  status!: PaymentTransactionStatus;
  @Prop({ maxlength: 16 }) responseCode?: string;
  @Prop({ maxlength: 32 }) bankCode?: string;
  @Prop() ipnReceivedAt?: Date;
  @Prop() signatureVerifiedAt?: Date;
  @Prop({ type: MongooseSchema.Types.Mixed }) gatewayPayload?: Record<
    string,
    string
  >;
}
export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);
PaymentTransactionSchema.index(
  { transactionRef: 1 },
  { name: 'transactionRef_1', unique: true },
);
PaymentTransactionSchema.index(
  { providerTransactionNo: 1 },
  { name: 'providerTransactionNo_1', unique: true, sparse: true },
);
PaymentTransactionSchema.index(
  { orderId: 1, createdAt: 1 },
  { name: 'orderId_1_createdAt_1' },
);
