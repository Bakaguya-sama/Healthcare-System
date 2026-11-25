import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { DoctorBookingSettingsService } from '../../application/services/doctors/doctor-booking-settings.service';
import {
  BookingSettingsResponseDto,
  DoctorBookingSettingsDto,
  OverrideDoctorBookingSettingsDto,
} from '../dto/doctors/doctor-booking-settings.dto';

@ApiTags('doctor-booking-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctor-booking-settings')
export class DoctorBookingSettingsController {
  constructor(private readonly settings: DoctorBookingSettingsService) {}

  @Get('me')
  @Roles(UserRole.DOCTOR)
  @ApiOkResponse({ type: BookingSettingsResponseDto })
  getMine(@CurrentUser('sub') doctorId: string) {
    return this.settings.getForDoctor(doctorId);
  }

  @Patch('me')
  @Roles(UserRole.DOCTOR)
  @ApiOkResponse({ type: BookingSettingsResponseDto })
  updateMine(
    @CurrentUser('sub') doctorId: string,
    @Body() dto: DoctorBookingSettingsDto,
  ) {
    return this.settings.updateByDoctor(doctorId, dto);
  }

  @Get(':doctorId')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ type: BookingSettingsResponseDto })
  getForAdmin(@Param('doctorId') doctorId: string) {
    return this.settings.getForDoctor(doctorId);
  }

  @Patch(':doctorId/override')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ type: BookingSettingsResponseDto })
  override(
    @CurrentUser('sub') adminId: string,
    @Param('doctorId') doctorId: string,
    @Body() dto: OverrideDoctorBookingSettingsDto,
  ) {
    const { overrideReason, ...settings } = dto;
    return this.settings.overrideByAdmin(
      adminId,
      doctorId,
      settings,
      overrideReason,
    );
  }
}
