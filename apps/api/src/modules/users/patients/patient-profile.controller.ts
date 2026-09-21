import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientProfileService } from './patient-profile.service';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { Roles } from '../../../core/decorators/roles.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { UserRole } from '../../../core/domain/user.enums';

@ApiTags('patients')
@Controller('patients')
export class PatientProfileController {
  constructor(private readonly patientProfiles: PatientProfileService) {}

  /**
   * 📝 POST /patients/me
   * Tạo hồ sơ bệnh nhân mới
   */
  @Post('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo hồ sơ bệnh nhân mới' })
  async create(@CurrentUser('sub') userId: string) {
    return this.patientProfiles.create(userId);
  }

  /**
   * 👤 GET /patients/me
   * Lấy hồ sơ bệnh nhân của user hiện tại
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy hồ sơ bệnh nhân của tôi' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.patientProfiles.findByUserId(userId);
  }

  /**
   * 📊 GET /patients
   * Lấy danh sách tất cả bệnh nhân (ADMIN)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bệnh nhân (ADMIN)' })
  async findAll(@Query() query: QueryPatientsDto) {
    return this.patientProfiles.findAll(query);
  }

  /**
   * 🗑️ DELETE /patients/me
   * Xóa hồ sơ bệnh nhân
   */
  @Delete('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa hồ sơ bệnh nhân' })
  async delete(@CurrentUser('sub') userId: string) {
    return this.patientProfiles.delete(userId);
  }
}
