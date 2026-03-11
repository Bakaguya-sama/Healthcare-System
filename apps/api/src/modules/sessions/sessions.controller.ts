import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionStatus } from './entities/session.entity';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Đặt lịch tư vấn với bác sĩ' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Lấy lịch tư vấn của bệnh nhân' })
  getMySessionsAsPatient(@CurrentUser('userId') userId: string) {
    return this.sessionsService.findByPatient(userId);
  }

  @Get('doctor')
  @ApiOperation({ summary: 'Lấy lịch tư vấn của bác sĩ' })
  getMySessionsAsDoctor(@CurrentUser('userId') userId: string) {
    return this.sessionsService.findByDoctor(userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái lịch tư vấn' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body('status') status: SessionStatus,
  ) {
    return this.sessionsService.updateStatus(id, userId, status);
  }
}
