import {
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PageQueryDto } from '../../../../../common/pagination';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../core/guards/roles.guard';
import { ConsultationQueueService } from '../../../application/services/consultations/consultation-queue.service';
import {
  CallNextResponseDto,
  DoctorQueueListResponseDto,
} from '../../dto/consultations/consultation-queue.dto';
import { ConsultationsGateway } from '../../gateways/consultations/consultations.gateway';

@ApiTags('consultation-queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DOCTOR)
@Controller('doctors/me/queue')
export class DoctorQueueController {
  constructor(
    private readonly queue: ConsultationQueueService,
    private readonly gateway: ConsultationsGateway,
  ) {}

  @Get()
  @Roles(UserRole.DOCTOR)
  @ApiOkResponse({ type: DoctorQueueListResponseDto })
  list(@CurrentUser('sub') doctorId: string, @Query() query: PageQueryDto) {
    return this.queue.listDoctorQueue(doctorId, query);
  }

  @Post('call-next')
  @Roles(UserRole.DOCTOR)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: CallNextResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Queue is empty or Doctor already has a called/active item',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  async callNext(
    @CurrentUser('sub') doctorId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    const result = await this.queue.callNext(doctorId, idempotencyKey);
    if (!result.replayed) {
      this.gateway.emitQueueCalled({
        consultationId: result.data.id,
        patientId: result.data.patientId,
        doctorId: result.data.doctorId,
        calledAt: result.data.calledAt!,
      });
    }
    return result;
  }
}
