import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../core/guards/roles.guard';
import { AvailabilitySlotService } from '../../../application/services/availability/availability-slot.service';
import {
  BlockAvailabilitySlotDto,
  CreateAvailabilitySlotDto,
  QueryAvailableSlotDto,
  QueryAvailabilitySlotDto,
  UpdateAvailabilitySlotDto,
} from '../../dto/availability/availability-slot.dto';
import {
  AvailabilitySlotListResponseDto,
  AvailabilitySlotResponseDto,
} from '../../dto/booking-response.dto';

@ApiTags('availability-slots')
@ApiBearerAuth()
@ApiResponse({
  status: 422,
  description: 'Slot policy or time range validation failed',
  schema: { $ref: '#/components/schemas/ErrorResponse' },
})
@ApiResponse({
  status: 503,
  description: 'Scheduled booking policy is not configured',
  schema: { $ref: '#/components/schemas/ErrorResponse' },
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('availability-slots')
export class AvailabilitySlotsController {
  constructor(private readonly slots: AvailabilitySlotService) {}

  @Post()
  @Roles(UserRole.DOCTOR)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Reserved for bulk/retry evolution; overlap constraints are authoritative.',
  })
  @ApiCreatedResponse({ type: AvailabilitySlotResponseDto })
  create(
    @CurrentUser('sub') doctorId: string,
    @Body() dto: CreateAvailabilitySlotDto,
  ) {
    return this.slots.create(doctorId, dto);
  }

  @Get()
  @Roles(UserRole.DOCTOR)
  @ApiOkResponse({ type: AvailabilitySlotListResponseDto })
  listMine(
    @CurrentUser('sub') doctorId: string,
    @Query() query: QueryAvailabilitySlotDto,
  ) {
    return this.slots.listMine(doctorId, query);
  }

  @Get('doctors/:doctorId')
  @Roles(UserRole.PATIENT)
  @ApiOkResponse({ type: AvailabilitySlotListResponseDto })
  listAvailable(
    @Param('doctorId') doctorId: string,
    @Query() query: QueryAvailableSlotDto,
  ) {
    return this.slots.listAvailable(doctorId, query);
  }

  @Patch(':id')
  @Roles(UserRole.DOCTOR)
  @ApiOkResponse({ type: AvailabilitySlotResponseDto })
  update(
    @CurrentUser('sub') doctorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilitySlotDto,
  ) {
    return this.slots.update(doctorId, id, dto);
  }

  @Patch(':id/block')
  @Roles(UserRole.DOCTOR)
  @ApiOkResponse({ type: AvailabilitySlotResponseDto })
  block(
    @CurrentUser('sub') doctorId: string,
    @Param('id') id: string,
    @Body() dto: BlockAvailabilitySlotDto,
  ) {
    return this.slots.block(doctorId, id, dto.reason);
  }

  @Delete(':id')
  @Roles(UserRole.DOCTOR)
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentUser('sub') doctorId: string, @Param('id') id: string) {
    return this.slots.remove(doctorId, id);
  }
}
