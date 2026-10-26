import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { PaymentOrderService } from '../../application/services/payment-order.service';
import { PaymentEvidenceService } from '../../application/services/payment-evidence.service';
import { CreatePaymentOrderDto } from '../dto/payment.dto';
@ApiTags('billing-payments')
@Controller('billing/payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentOrderService,
    private readonly evidence: PaymentEvidenceService,
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
  @Post('orders/:id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  cancel(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.payments.cancel(userId, id);
  }
  @Get('orders/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  get(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.payments.getForUser(userId, id);
  }
  @Get('orders/:id/evidence')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getEvidence(@Param('id') id: string) {
    return this.evidence.get(id);
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
