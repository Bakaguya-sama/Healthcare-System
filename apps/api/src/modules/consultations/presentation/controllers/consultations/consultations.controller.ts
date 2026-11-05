import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../core/guards/roles.guard';
import {
  ConsultationChangedAction,
  ConsultationsGateway,
} from '../../gateways/consultations/consultations.gateway';
import { ConsultationsService } from '../../../application/services/consultations/consultations.service';
import { ConsultationHeartbeatService } from '../../../application/services/consultations/consultation-heartbeat.service';
import { CreateConsultationDto } from '../../dto/consultations/create-consultation.dto';
import { QueryConsultationDto } from '../../dto/consultations/query-consultation.dto';
import { UpdateConsultationDto } from '../../dto/consultations/update-consultation.dto';
import {
  CreateScheduledBookingDto,
  RescheduleBookingDto,
} from '../../dto/consultations/scheduled-booking.dto';
import { ScheduledBookingService } from '../../../application/services/consultations/scheduled-booking.service';
import { ScheduledConsultationResponseDto } from '../../dto/booking-response.dto';
import { ConsultationQueueService } from '../../../application/services/consultations/consultation-queue.service';
import {
  CheckInResponseDto,
  PatientQueueResponseDto,
} from '../../dto/consultations/consultation-queue.dto';

@ApiTags('consultations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(
    private readonly consultations: ConsultationsService,
    private readonly heartbeat: ConsultationHeartbeatService,
    private readonly gateway: ConsultationsGateway,
    private readonly scheduledBookings: ScheduledBookingService,
    private readonly queue: ConsultationQueueService,
  ) {}

  @Post('scheduled')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: ScheduledConsultationResponseDto })
  @ApiResponse({
    status: 422,
    description: 'Subscription/quota/notice policy rejected the booking',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiResponse({
    status: 503,
    description: 'Scheduled booking policy is not configured',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  async createScheduled(
    @CurrentUser('sub') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateScheduledBookingDto,
  ) {
    const result = await this.scheduledBookings.book(
      userId,
      idempotencyKey,
      dto,
    );
    this.emit('created', result.data);
    return result;
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateConsultationDto,
  ) {
    const result = await this.consultations.create(userId, dto);
    this.emit('created', result.data);
    return result;
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  findAll(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Query() query: QueryConsultationDto,
  ) {
    return this.consultations.findAll(userId, role, query);
  }

  @Get('upcoming')
  upcoming(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Query('days') days = 7,
  ) {
    return this.consultations.getUpcoming(userId, role, Number(days));
  }

  @Post(':id/check-in')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: CheckInResponseDto })
  @ApiResponse({
    status: 422,
    description: 'Check-in is too early or the check-in window has closed',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiResponse({
    status: 503,
    description: 'Check-in policy is not configured',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  async checkIn(
    @CurrentUser('sub') patientId: string,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    const result = await this.queue.checkIn(patientId, id, idempotencyKey);
    if (!result.replayed) {
      this.emit('checked_in', result.data);
      this.gateway.emitQueueChanged({
        consultationId: result.queue.consultationId,
        patientId: result.data.patientId,
        doctorId: result.data.doctorId,
        position: result.queue.position,
        estimatedWaitMinutes: result.queue.estimatedWaitMinutes,
        version: String(result.queue.updatedAt),
      });
    }
    return result;
  }

  @Get(':id/queue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiOkResponse({ type: PatientQueueResponseDto })
  getQueue(@CurrentUser('sub') patientId: string, @Param('id') id: string) {
    return this.queue.getPatientQueue(patientId, id);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.consultations.findOne(userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    const result = await this.consultations.update(userId, id, dto);
    this.emit('updated', result.data);
    return result;
  }

  @Post(':id/accept')
  async accept(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const result = await this.consultations.accept(userId, id);
    this.emit('accepted', result.data);
    return result;
  }

  @Post(':id/decline')
  async decline(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    const result = await this.consultations.decline(userId, id, dto.reason);
    this.emit('declined', result.data);
    return result;
  }

  @Post(':id/start')
  async start(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const result = await this.consultations.start(userId, id);
    this.emit('started', result.data);
    return result;
  }

  @Post(':id/waiting-room-presence')
  recordWaitingRoomPresence(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.heartbeat.recordWaitingRoomPresence(id, userId);
  }

  @Post(':id/complete')
  async complete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    const result = await this.consultations.complete(userId, id, dto);
    this.emit('completed', result.data);
    return result;
  }

  @Post(':id/no-show')
  async markNoShow(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    const result = await this.consultations.markNoShow(userId, id, dto.reason);
    this.emit('no_show', result.data);
    return result;
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    const result = await this.consultations.cancel(userId, id, dto);
    this.emit('cancelled', result.data);
    return result;
  }

  @Post(':id/reschedule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: ScheduledConsultationResponseDto })
  @ApiResponse({
    status: 422,
    description: 'Reschedule cutoff/notice policy rejected the command',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiResponse({
    status: 503,
    description: 'Scheduled booking policy is not configured',
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  async reschedule(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: RescheduleBookingDto,
  ) {
    const result = await this.scheduledBookings.reschedule(
      userId,
      id,
      idempotencyKey,
      dto.availabilitySlotId,
    );
    this.emit('updated', result.data);
    return result;
  }

  private emit(action: ConsultationChangedAction, data: Record<string, any>) {
    this.gateway.emitConsultationChanged({
      action,
      consultationId: String(data._id ?? data.id),
      patientId: String(data.patientId),
      doctorId: String(data.doctorId),
    });
  }
}
