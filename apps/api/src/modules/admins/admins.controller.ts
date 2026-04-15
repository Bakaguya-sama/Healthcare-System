import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminsService } from './admins.service';
import {
  CreateAdminDto,
  UpdateAdminDto,
  QueryAdminDto,
} from './dto/create-admin.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('admins')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  /**
   * 📝 POST /admins
   * Tạo hồ sơ admin mới (SUPER_ADMIN ONLY)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo hồ sơ admin mới (SUPER_ADMIN)' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAdminDto,
  ) {
    return this.adminsService.create(userId, dto);
  }

  /**
   * 📊 GET /admins
   * Lấy danh sách tất cả admin (SUPER_ADMIN ONLY)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách admin (SUPER_ADMIN)' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryAdminDto,
  ) {
    return this.adminsService.findAll(userId, query);
  }

  /**
   * ✏️ PATCH /admins/:id
   * Cập nhật hồ sơ admin (SUPER_ADMIN ONLY)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật hồ sơ admin (SUPER_ADMIN)' })
  async update(
    @CurrentUser('sub') currentAdminUserId: string,
    @Param('id') adminUserId: string,
    @Body() dto: UpdateAdminDto,
  ) {
    return this.adminsService.update(currentAdminUserId, adminUserId, dto);
  }

  /**
   * 🗑️ DELETE /admins/:id
   * Xóa hồ sơ admin (SUPER_ADMIN ONLY)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa hồ sơ admin (SUPER_ADMIN)' })
  async delete(
    @CurrentUser('sub') currentAdminUserId: string,
    @Param('id') adminUserId: string,
  ) {
    return this.adminsService.delete(currentAdminUserId, adminUserId);
  }
}
