import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * 📝 POST /sessions
   * Đặt lịch tư vấn mới
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đặt lịch tư vấn mới' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionsService.create(userId, dto);
  }

  /**
   * 📊 GET /sessions
   * Lấy danh sách sessions (filter + pagination)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách sessions' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: string,
    @Query() query: QuerySessionDto,
  ) {
    return this.sessionsService.findAll(userId, userRole, query);
  }

  /**
   * 📅 GET /sessions/upcoming
   * Lấy sessions sắp tới (7 ngày)
   */
  @Get('upcoming')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy sessions sắp tới' })
  async getUpcoming(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: string,
    @Query('days') days: number = 7,
  ) {
    return this.sessionsService.getUpcoming(userId, userRole, days);
  }

  /**
   * 🔍 GET /sessions/:id
   * Lấy chi tiết 1 session
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết session' })
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionsService.findOne(userId, id);
  }

  /**
   * ✏️ PATCH /sessions/:id
   * Cập nhật thông tin session
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật session' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.update(userId, id, dto);
  }

  /**
   * ✅ POST /sessions/:id/confirm
   * Bác sĩ xác nhận session
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận session (Doctor only)' })
  async confirm(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionsService.confirm(userId, id);
  }

  /**
   * 🏁 POST /sessions/:id/start
   * Bác sĩ bắt đầu session
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bắt đầu session (Doctor only)' })
  async start(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionsService.start(userId, id);
  }

  /**
   * ✔️ POST /sessions/:id/complete
   * Bác sĩ kết thúc session
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kết thúc session (Doctor only)' })
  async complete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.complete(userId, id, dto);
  }

  /**
   * ❌ POST /sessions/:id/cancel
   * Hủy session
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy session' })
  async cancel(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.cancel(userId, id, dto);
  }

  /**
   * 🔄 POST /sessions/:id/reschedule
   * Đổi lịch session
   */
  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi lịch session' })
  async reschedule(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.reschedule(userId, id, dto);
  }

  /**
   * 🗑️ DELETE /sessions/:id
   * Xóa session
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa session' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionsService.remove(userId, id);
  }
}
