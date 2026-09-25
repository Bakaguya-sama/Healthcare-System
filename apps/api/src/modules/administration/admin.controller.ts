import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { UserRole } from '../../core/domain/user.enums';
import { VerifyDoctorDto } from './dto/verify-doctor.dto';
import { RejectDoctorDto } from './dto/reject-doctor.dto';
import { LockAccountDto } from './dto/lock-account.dto';
import { QueryConsultationDto } from '../consultations/public-api';
import { QueryDoctorApplicationsDto } from './dto/query-doctor-applications.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================
  // DOCTOR VERIFICATION ENDPOINTS
  // ============================================

  /**
   * 👨‍⚕️ GET /admin/doctors/application
   * Lấy danh sách đơn tham gia của bác sĩ.
   */
  @Get('doctors/applications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách đơn tham gia của bác sĩ' })
  async getDoctorApplication(@Query() query: QueryDoctorApplicationsDto) {
    return this.adminService.getDoctorApplication(query);
  }

  /**
   * ✅ POST /admin/doctors/:id/verify
   * Duyệt tài khoản bác sĩ
   */
  @Post('doctors/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Duyệt tài khoản bác sĩ' })
  async verifyDoctor(
    @Param('id') doctorId: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: VerifyDoctorDto,
  ) {
    return this.adminService.verifyDoctor(doctorId, adminId, dto);
  }

  /**
   * ❌ POST /admin/doctors/:id/reject
   * Từ chối tài khoản bác sĩ
   */
  @Post('doctors/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối tài khoản bác sĩ' })
  async rejectDoctor(
    @Param('id') doctorId: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: RejectDoctorDto,
  ) {
    return this.adminService.rejectDoctor(doctorId, adminId, dto);
  }

  // ============================================
  // ACCOUNT LOCK/UNLOCK ENDPOINTS
  // ============================================

  /**
   * 🔒 POST /admin/users/:id/lock
   * Khóa tài khoản
   */
  @Post('users/:id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Khóa tài khoản vi phạm' })
  async lockAccount(
    @Param('id') userId: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: LockAccountDto,
  ) {
    return this.adminService.lockAccount(userId, adminId, dto);
  }

  /**
   * 🔓 POST /admin/users/:id/unlock
   * Mở khóa tài khoản
   */
  @Post('users/:id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mở khóa tài khoản' })
  async unlockAccount(
    @Param('id') userId: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.unlockAccount(userId, adminId);
  }

  // ============================================
  // CONSULTATIONS MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * GET /admin/consultations
   */
  @Get('consultations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả consultations' })
  async getAllConsultations(@Query() query: QueryConsultationDto) {
    return this.adminService.getAllConsultations(query);
  }

  /**
   * GET /admin/consultations/:id
   */
  @Get('consultations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết consultation' })
  async getConsultationById(@Param('id') id: string) {
    return this.adminService.getConsultationById(id);
  }

  // ============================================
  // DASHBOARD ENDPOINTS
  // ============================================

  /**
   * 📈 GET /admin/dashboard/stats
   * Lấy thống kê hệ thống
   */
  @Get('dashboard/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy thống kê hệ thống' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }
}
