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
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  QueryNotificationDto,
} from './dto/create-notification.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 📝 POST /notifications
   * Tạo thông báo mới (INTERNAL - gọi từ service khác)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo thông báo mới' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationsService.create(userId, dto);
  }

  /**
   * 📬 GET /notifications
   * Lấy danh sách thông báo của user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách thông báo' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationsService.findAll(userId, query);
  }

  /**
   * 👁️ GET /notifications/:id
   * Lấy chi tiết thông báo (auto mark as read)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết thông báo' })
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.findOne(userId, notificationId);
  }

  /**
   * ✏️ PATCH /notifications/:id
   * Cập nhật thông báo (status, read, active)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông báo' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') notificationId: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(userId, notificationId, dto);
  }

  /**
   * 📌 PATCH /notifications/mark-all-as-read
   * Đánh dấu tất cả là đã đọc
   */
  @Patch('/mark-all-as-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo là đã đọc' })
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * 🗑️ DELETE /notifications/:id
   * Xóa thông báo
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa thông báo' })
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.delete(userId, notificationId);
  }

  /**
   * 📊 GET /notifications/unread/count
   * Đếm thông báo chưa đọc
   */
  @Get('unread/count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đếm thông báo chưa đọc' })
  async countUnread(@CurrentUser('sub') userId: string) {
    return this.notificationsService.countUnread(userId);
  }
}
