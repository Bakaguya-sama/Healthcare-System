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
import { UserRole } from '../users/enums/user-role.enum';
import { VerifyDoctorDto } from './dto/verify-doctor.dto';
import { RejectDoctorDto } from './dto/reject-doctor.dto';
import { LockAccountDto } from './dto/lock-account.dto';
import { QuerySessionAdminDto } from './dto/query-session-admin.dto';

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
   * 👨‍⚕️ GET /admin/doctors/pending
   * Lấy danh sách bác sĩ chờ duyệt
   */
  @Get('doctors/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách bác sĩ chờ duyệt' })
  async getPendingDoctors() {
    return this.adminService.getPendingDoctors();
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

  /**
   * 📋 GET /admin/users/:id/lock-history
   * Xem lịch sử khóa tài khoản
   */
  @Get('users/:id/lock-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xem lịch sử khóa tài khoản' })
  async getLockHistory(@Param('id') userId: string) {
    return this.adminService.getLockHistory(userId);
  }

  // ============================================
  // SESSIONS MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * 📊 GET /admin/sessions
   * Lấy tất cả sessions
   */
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả sessions' })
  async getAllSessions(@Query() query: QuerySessionAdminDto) {
    return this.adminService.getAllSessions(query);
  }

  /**
   * 🔍 GET /admin/sessions/:id
   * Lấy chi tiết 1 session
   */
  @Get('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết session' })
  async getSessionById(@Param('id') id: string) {
    return this.adminService.getSessionById(id);
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
