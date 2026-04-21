import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { AiAssistantService } from './ai-assistant.service';
import {
  StartConversationDto,
  AiSendMessageDto,
  RateConversationDto,
  ArchiveConversationDto,
  UpdateConversationDto,
  QueryConversationDto,
} from './dto/conversation.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('ai-assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  /**
   * API 1: Start Conversation
   */
  @Post('conversations/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bắt đầu cuộc trò chuyện mới với AI' })
  async startConversation(
    @CurrentUser('sub') userId: string,
    @Body() dto: StartConversationDto,
  ) {
    return this.aiAssistantService.startConversation(userId, dto);
  }

  /**
   * API 2: Send Message to AI
   */
  @Post('conversations/:conversationId/message')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('images', 5))
  @ApiOperation({ summary: 'Gửi tin nhắn cho AI trong cuộc trò chuyện' })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        conversationType: {
          type: 'string',
          enum: [
            'health_inquiry',
            'symptom_analysis',
            'health_education',
            'test_result_explanation',
            'medication_info',
            'general_consultation',
          ],
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: AiSendMessageDto,
    @UploadedFiles() images?: any[],
  ) {
    return this.aiAssistantService.sendMessage(
      userId,
      conversationId,
      dto,
      images,
    );
  }

  /**
   * API 3: Get All Conversations
   */
  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách tất cả cuộc trò chuyện của người dùng',
  })
  async getConversations(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryConversationDto,
  ) {
    return this.aiAssistantService.getConversations(userId, query);
  }

  /**
   * API 4: Get Single Conversation
   */
  @Get('conversations/:conversationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết một cuộc trò chuyện' })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  async getConversation(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiAssistantService.getConversation(userId, conversationId);
  }

  /**
   * API 5: Toggle Favorite
   */
  @Post('conversations/:conversationId/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thêm/Bỏ cuộc trò chuyện vào danh sách yêu thích' })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  async toggleFavorite(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiAssistantService.toggleFavorite(userId, conversationId);
  }

  /**
   * API 6: Archive Conversation
   */
  @Post('conversations/:conversationId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lưu trữ/Bỏ lưu trữ cuộc trò chuyện' })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  async archiveConversation(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: ArchiveConversationDto,
  ) {
    return this.aiAssistantService.archiveConversation(
      userId,
      conversationId,
      dto,
    );
  }

  /**
   * API 7: Rate Conversation
   */
  @Post('conversations/:conversationId/rate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh giá cuộc trò chuyện' })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  async rateConversation(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: RateConversationDto,
  ) {
    return this.aiAssistantService.rateConversation(
      userId,
      conversationId,
      dto,
    );
  }

  /**
   * API 8: Update Conversation
   */
  @Patch('conversations/:conversationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cập nhật thông tin cuộc trò chuyện (tiêu đề, ghi chú, tags)',
  })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  async updateConversation(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.aiAssistantService.updateConversation(
      userId,
      conversationId,
      dto,
    );
  }

  /**
   * API 9: Delete Conversation
   */
  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa cuộc trò chuyện' })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  async deleteConversation(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiAssistantService.deleteConversation(userId, conversationId);
  }

  /**
   * API 10: Get Conversation Statistics
   */
  @Get('conversations/:conversationId/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy thống kê cuộc trò chuyện' })
  @ApiParam({ name: 'conversationId', description: 'ID của cuộc trò chuyện' })
  async getConversationStats(
    @CurrentUser('sub') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiAssistantService.getConversationStats(userId, conversationId);
  }

  /**
   * API 11: Get User Summary
   */
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy tổng hợp thông tin cuộc trò chuyện của người dùng',
  })
  async getUserConversationSummary(@CurrentUser('sub') userId: string) {
    return this.aiAssistantService.getUserConversationSummary(userId);
  }

  /**
   * API 12: Search Conversations
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tìm kiếm cuộc trò chuyện' })
  @ApiQuery({
    name: 'q',
    description: 'Từ khóa tìm kiếm',
    required: true,
  })
  async searchConversations(
    @CurrentUser('sub') userId: string,
    @Query('q') searchQuery: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: number = -1,
  ) {
    const query: QueryConversationDto = {
      page,
      limit,
      sortBy,
      sortOrder,
    };
    return this.aiAssistantService.searchConversations(
      userId,
      searchQuery,
      query,
    );
  }
}
