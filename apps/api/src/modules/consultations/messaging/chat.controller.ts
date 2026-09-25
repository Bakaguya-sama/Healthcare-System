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
  UseInterceptors,
  UploadedFiles,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto, UploadedAttachment } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { ChatGateway } from './chat.gateway';
import { QueryMessageDto } from './dto/query-message.dto';
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_UPLOAD_LIMIT,
} from '../../../common/upload/upload-limits';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * API 1: Send Message
   */
  @Post('consultation/messages')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('attachments', CHAT_ATTACHMENT_UPLOAD_LIMIT, {
      limits: {
        fileSize: CHAT_ATTACHMENT_MAX_BYTES,
      },
    }),
  )
  @ApiOperation({ summary: 'Gửi tin nhắn mới' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['consultationId', 'senderType', 'content'],
      properties: {
        consultationId: { type: 'string' },
        senderType: { type: 'string', enum: ['patient', 'doctor'] },
        content: { type: 'string' },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() attachments?: UploadedAttachment[],
  ) {
    const result = await this.chatService.sendMessage(userId, dto, attachments);

    const message = result.data || result;
    this.chatGateway.server
      .to(dto.consultationId)
      .emit('consultation_message', message);

    return result;
  }

  @Get('consultation/:consultationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get consultation message history (cursor)' })
  async getConsultationMessages(
    @CurrentUser('sub') userId: string,
    @Param('consultationId') consultationId: string,
    @Query() query: QueryMessageDto,
  ) {
    const consultation = await this.chatService.getConsultationDetails(
      consultationId,
      userId,
    );
    if (!consultation)
      throw new ForbiddenException('Not a participant of this consultation');
    return this.chatService.getConsultationMessages(consultationId, query);
  }

  /**
   * API 3: Get All Messages
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả tin nhắn' })
  async findAll(@Query() query: QueryMessageDto) {
    return this.chatService.findAll(query);
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
