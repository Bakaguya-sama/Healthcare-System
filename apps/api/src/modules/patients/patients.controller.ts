import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto, QueryPatientDto } from './dto/create-patient.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /**
   * 📝 POST /patients
   * Tạo hồ sơ bệnh nhân mới
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo hồ sơ bệnh nhân mới' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(userId, dto);
  }

  /**
   * 👤 GET /patients/profile
   * Lấy hồ sơ bệnh nhân của user hiện tại
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy hồ sơ bệnh nhân của tôi' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.patientsService.findByUserId(userId);
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
  async findAll(@Query() query: QueryPatientDto) {
    return this.patientsService.findAll(query);
  }

  /**
   * ✏️ PATCH /patients/profile
   * Cập nhật hồ sơ bệnh nhân
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật hồ sơ bệnh nhân' })
  async update(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(userId, dto);
  }

  /**
   * 🗑️ DELETE /patients/profile
   * Xóa hồ sơ bệnh nhân
   */
  @Delete('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa hồ sơ bệnh nhân' })
  async delete(@CurrentUser('sub') userId: string) {
    return this.patientsService.delete(userId);
  }
}
