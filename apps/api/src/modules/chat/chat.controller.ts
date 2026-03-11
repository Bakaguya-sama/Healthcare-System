import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversation/:otherId')
  @ApiOperation({ summary: 'Lấy lịch sử hội thoại với một người dùng' })
  getConversation(
    @CurrentUser('userId') userId: string,
    @Param('otherId') otherId: string,
  ) {
    return this.chatService.getConversation(userId, otherId);
  }
}
