import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HealthMetricsService } from './health-metrics.service';
import { CreateHealthMetricDto } from './dto/create-health-metric.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('health-metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health-metrics')
export class HealthMetricsController {
  constructor(private readonly healthMetricsService: HealthMetricsService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi nhận chỉ số sức khỏe mới' })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateHealthMetricDto,
  ) {
    return this.healthMetricsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy lịch sử chỉ số sức khỏe' })
  findAll(@CurrentUser('userId') userId: string, @Query('type') type?: string) {
    return this.healthMetricsService.findByUser(userId, type);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Lấy chỉ số mới nhất theo từng loại' })
  getLatest(@CurrentUser('userId') userId: string) {
    return this.healthMetricsService.findLatestByType(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa chỉ số sức khỏe' })
  remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.healthMetricsService.delete(id, userId);
  }
}
