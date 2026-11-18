import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PageSortQueryDto } from '../../../../common/pagination';
import { PaymentOrderStatus } from '../../domain/entities/payment.entity';

export class QueryPatientPaymentOrdersDto extends PageSortQueryDto {
  @ApiPropertyOptional({ enum: PaymentOrderStatus })
  @IsOptional()
  @IsEnum(PaymentOrderStatus)
  status?: PaymentOrderStatus;

  @ApiPropertyOptional({ enum: ['createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt'])
  sortBy = 'createdAt' as const;
}

export class PatientPaymentOrderPlanDto {
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() version: number;
}

export class PatientPaymentOrderListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() orderCode: string;
  @ApiProperty({ enum: PaymentOrderStatus }) status: PaymentOrderStatus;
  @ApiProperty() amount: number;
  @ApiProperty({ example: 'VND' }) currency: string;
  @ApiProperty({ type: PatientPaymentOrderPlanDto })
  plan: PatientPaymentOrderPlanDto;
  @ApiProperty() expiresAt: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiPropertyOptional() paidAt?: string;
  @ApiPropertyOptional() cancelledAt?: string;
}

/**
 * BILL-05 intentionally uses the same bounded, immutable snapshot projection
 * as history.  The detail route is not an escape hatch to PaymentTransaction,
 * VNPAY/IPN, reconciliation, audit, or idempotency data.
 */
export class PatientPaymentOrderDetailDto extends PatientPaymentOrderListItemDto {}

export class PatientPaymentOrderPageDto {
  @ApiProperty({ type: [PatientPaymentOrderListItemDto] })
  items: PatientPaymentOrderListItemDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}
