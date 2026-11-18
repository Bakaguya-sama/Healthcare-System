import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { PaymentOrderService } from '../../application/services/payment-order.service';
import { PaymentEvidenceService } from '../../application/services/payment-evidence.service';
import { PatientPaymentOrderReadService } from '../../application/services/patient-payment-order-read.service';
import { CreatePaymentOrderDto } from '../dto/payment.dto';
import {
  PatientPaymentOrderPageDto,
  PatientPaymentOrderDetailDto,
  QueryPatientPaymentOrdersDto,
} from '../dto/patient-payment-order-read.dto';
@ApiTags('billing-payments')
@Controller('billing/payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentOrderService,
    private readonly evidence: PaymentEvidenceService,
    private readonly patientReads: PatientPaymentOrderReadService,
  ) {}
  @Post('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePaymentOrderDto,
    @Headers('idempotency-key') key: string,
    @Ip() ip: string,
  ) {
    return this.payments.create(userId, dto.planId, key, ip);
  }
  @Get('orders')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current Patient payment-order history' })
  @ApiOkResponse({ type: PatientPaymentOrderPageDto })
  @ApiBadRequestResponse({ description: 'Invalid status or pagination query' })
  @ApiUnauthorizedResponse({ description: 'Bearer token is required' })
  @ApiForbiddenResponse({ description: 'Patient role is required' })
  @ApiServiceUnavailableResponse({
    description: 'An immutable payment-order snapshot is corrupt',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  list(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryPatientPaymentOrdersDto,
  ) {
    return this.patientReads.list(userId, query);
  }
  @Post('orders/:id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  cancel(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.payments.cancel(userId, id);
  }
  @Get('orders/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read one owner-scoped Patient payment order safely' })
  @ApiOkResponse({ type: PatientPaymentOrderDetailDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment order identifier',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiResponse({
    status: 401,
    description: 'Bearer token is required',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiResponse({
    status: 403,
    description: 'Patient role is required',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiResponse({
    status: 404,
    description: 'Payment order is missing or belongs to another Patient',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiResponse({
    status: 503,
    description: 'An immutable payment-order snapshot is corrupt',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  get(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.patientReads.get(userId, id);
  }
  @Get('orders/:id/evidence')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getEvidence(@Param('id') id: string) {
    return this.evidence.get(id);
  }
  // Browser return is display-only. IPN remains the sole payment authority.
  @Get('vnpay/return')
  @HttpCode(200)
  returnFromVnpay() {
    return {
      status: 'payment_verification_pending',
      message:
        'Payment is being verified. The signed VNPAY IPN determines the final order status.',
    };
  }
  // VNPAY invokes its server-to-server IPN endpoint with a signed GET query.
  @Get('vnpay/ipn')
  @HttpCode(200)
  ipn(@Req() request: Request) {
    return this.payments.handleIpn(
      request.query as Record<string, string | undefined>,
    );
  }
}
