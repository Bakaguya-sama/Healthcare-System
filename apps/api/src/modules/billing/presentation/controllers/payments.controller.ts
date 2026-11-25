import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Optional,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import type { Request, Response } from 'express';
import { renderMobileDeepLinkBridgeHtml } from '../../../../common/http/mobile-deep-link-bridge';
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
    @Optional() private readonly config?: ConfigService,
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
  returnFromVnpay(
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const acceptHeader = req?.headers?.accept ?? '';
    if (
      res &&
      acceptHeader.includes('text/html') &&
      !acceptHeader.includes('application/json')
    ) {
      const deepLink =
        this.config?.get<string>('VNPAY_MOBILE_RETURN_DEEP_LINK')?.trim() ||
        'healthcare://premium?vnpay=return';
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return renderMobileDeepLinkBridgeHtml({
        targetUrl: deepLink,
        title: 'Đang xác minh giao dịch VNPAY / Verifying VNPAY Payment',
        subtitle:
          'Giao dịch đang được hệ thống kiểm tra tự động qua cổng VNPAY. Trạng thái cuối cùng sẽ cập nhật trong ứng dụng. / Your payment is being verified via VNPAY IPN. Final status will update in the app.',
        buttonLabel: 'Quay lại ứng dụng Healthcare / Return to Healthcare App',
      });
    }
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
