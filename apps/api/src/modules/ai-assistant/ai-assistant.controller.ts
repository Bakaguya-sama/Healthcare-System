import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiAssistantService } from './ai-assistant.service';
import { AskAiDto } from './dto/ask-ai.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@ApiTags('ai-assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Post('ask')
  @ApiOperation({ summary: 'Hỏi trợ lý AI về sức khỏe (Gemini 2.0 Flash)' })
  ask(@Body() dto: AskAiDto) {
    return this.aiAssistantService.ask(dto);
  }
}
