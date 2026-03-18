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
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
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
   * API 2: Get Session Messages
   */
  @Get('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tin nhắn trong phiên tư vấn' })
  @ApiParam({ name: 'sessionId', description: 'ID của phiên tư vấn' })
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: string = 'sentAt',
    @Query('sortOrder') sortOrder: 1 | -1 = -1,
  ) {
    return this.chatService.getSessionMessages(sessionId, { page, limit, sortBy, sortOrder });
  }

  /**
   * API 3: Get All Messages
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả tin nhắn' })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: string = 'sentAt',
    @Query('sortOrder') sortOrder: 1 | -1 = -1,
  ) {
    return this.chatService.findAll({ page, limit, sortBy, sortOrder });
  }

  /**
   * API 4: Get Single Message
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết một tin nhắn' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async findOne(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }

  /**
   * API 5: Update Message
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật tin nhắn' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async updateMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.chatService.update(userId, id, dto);
  }

  /**
   * API 6: Delete Message
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa tin nhắn' })
  @ApiParam({ name: 'id', description: 'ID của tin nhắn' })
  async removeMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.chatService.remove(userId, id);
  }
}
