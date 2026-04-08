import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { UserRole } from './enums/user-role.enum';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: lấy danh sách tất cả users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('doctors')
  @ApiOperation({ summary: 'Lấy danh sách bác sĩ' })
  findDoctors() {
    return this.usersService.findDoctors();
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  getMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Lấy profile user theo ID (role-aware)' })
  findProfile(@Param('id') id: string) {
    return this.usersService.findProfileById(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin user theo ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật thông tin tài khoản hiện tại' })
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: vô hiệu hoá tài khoản' })
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  /**
   * 👤 PATIENT PROFILE ENDPOINTS
   */

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bệnh nhân tạo profile' })
  createPatientProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePatientProfileDto,
  ) {
    return this.usersService.createPatientProfile(userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Xem patient profile của mình' })
  getPatientProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.getPatientProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Cập nhật patient profile' })
  updatePatientProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePatientProfileDto,
  ) {
    return this.usersService.updatePatientProfile(userId, dto);
  }

  @Delete('profile')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa patient profile' })
  deletePatientProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.deletePatientProfile(userId);
  }
}
