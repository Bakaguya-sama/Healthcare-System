import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import {
  ConsultationChangedAction,
  ConsultationsGateway,
} from '../../gateways/consultations/consultations.gateway';
import { ConsultationsService } from '../../../application/services/consultations/consultations.service';
import { ConsultationHeartbeatService } from '../../../application/services/consultations/consultation-heartbeat.service';
import { CreateConsultationDto } from '../../dto/consultations/create-consultation.dto';
import { QueryConsultationDto } from '../../dto/consultations/query-consultation.dto';
import { UpdateConsultationDto } from '../../dto/consultations/update-consultation.dto';

@ApiTags('consultations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(
    private readonly consultations: ConsultationsService,
    private readonly heartbeat: ConsultationHeartbeatService,
    private readonly gateway: ConsultationsGateway,
  ) {}

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

  private emit(action: ConsultationChangedAction, data: Record<string, any>) {
    this.gateway.emitConsultationChanged({
      action,
      consultationId: String(data._id ?? data.id),
      patientId: String(data.patientId),
      doctorId: String(data.doctorId),
    });
  }
}
