import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * API 1: Send Message
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi tin nhắn mới' })
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, dto);
  }

  /**
   * API 2: Get Conversation
   */
  @Get('conversation/:otherId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy lịch sử hội thoại với một người dùng' })
  @ApiParam({ name: 'otherId', description: 'ID của người dùng khác' })
  async getConversation(
    @CurrentUser('sub') userId: string,
    @Param('otherId') otherId: string,
    @Query() query: QueryMessageDto,
  ) {
    return this.chatService.getConversation(userId, otherId, query);
  }

  /**
   * API 3: Get All Messages (with filters)
   */
  @Get('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả tin nhắn với bộ lọc' })
  async findAll(@Query() query: QueryMessageDto) {
    return this.chatService.findAll(query);
  }

  /**
   * API 4: Get Single Message
   */
  @Get('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết một tin nhắn' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async findOne(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }

  /**
   * API 5: Update Message
   */
  @Patch('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cập nhật tin nhắn (chỉnh sửa nội dung, reactions, trạng thái)',
  })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async updateMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.chatService.update(userId, id, dto);
  }

  /**
   * API 6: Mark as Read
   */
  @Post('messages/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tin nhắn là đã đọc' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.chatService.markAsRead(userId, id);
  }

  /**
   * API 7: Pin Message
   */
  @Post('messages/:id/pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghim tin nhắn' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async pinMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.chatService.pinMessage(userId, id);
  }

  /**
   * API 8: Unpin Message
   */
  @Post('messages/:id/unpin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bỏ ghim tin nhắn' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async unpinMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.chatService.unpinMessage(userId, id);
  }

  /**
   * API 9: Delete Message
   */
  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa tin nhắn (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async removeMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.chatService.remove(userId, id);
  }

  /**
   * API 10: Get Unread Count
   */
  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy số tin nhắn chưa đọc' })
  @ApiQuery({
    name: 'otherId',
    description: 'ID người dùng (tùy chọn, nếu không có lấy tất cả)',
    required: false,
  })
  async getUnreadCount(
    @CurrentUser('sub') userId: string,
    @Query('otherId') otherId?: string,
  ) {
    return this.chatService.getUnreadCount(userId, otherId);
  }

  /**
   * API 11: Get Pinned Messages
   */
  @Get('conversation/:otherId/pinned')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy các tin nhắn đã ghim trong hội thoại' })
  @ApiParam({ name: 'otherId', description: 'ID của người dùng khác' })
  async getPinnedMessages(
    @CurrentUser('sub') userId: string,
    @Param('otherId') otherId: string,
  ) {
    return this.chatService.getPinnedMessages(userId, otherId);
  }

  /**
   * API 12: Mark Conversation as Read
   */
  @Post('conversation/:otherId/mark-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu toàn bộ hội thoại là đã đọc' })
  @ApiParam({ name: 'otherId', description: 'ID của người dùng khác' })
  async markConversationAsRead(
    @CurrentUser('sub') userId: string,
    @Param('otherId') otherId: string,
  ) {
    return this.chatService.markConversationAsRead(userId, otherId);
  }

  /**
   * API 13: Get Conversation Stats
   */
  @Get('conversation/:otherId/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy thống kê hội thoại' })
  @ApiParam({ name: 'otherId', description: 'ID của người dùng khác' })
  async getConversationStats(
    @CurrentUser('sub') userId: string,
    @Param('otherId') otherId: string,
  ) {
    return this.chatService.getConversationStats(userId, otherId);
  }
}
