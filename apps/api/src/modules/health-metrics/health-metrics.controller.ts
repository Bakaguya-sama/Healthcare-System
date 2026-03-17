import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HealthMetricsService } from './health-metrics.service';
import { CreateHealthMetricDto } from './dto/create-health-metric.dto';
import { UpdateHealthMetricDto } from './dto/update-health-metric.dto';
import { QueryHealthMetricDto } from './dto/query-health-metric.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('health-metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health-metrics')
export class HealthMetricsController {
  constructor(private readonly healthMetricsService: HealthMetricsService) {}

  /**
   * 📝 POST /health-metrics
   * Ghi nhận chỉ số sức khỏe mới
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ghi nhận chỉ số sức khỏe mới' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateHealthMetricDto,
  ) {
    return this.healthMetricsService.create(userId, dto);
  }

  /**
   * 📊 GET /health-metrics
   * Lấy danh sách chỉ số sức khỏe (có filter & pagination)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách chỉ số sức khỏe' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryHealthMetricDto,
  ) {
    return this.healthMetricsService.findAll(userId, query);
  }

  /**
   * 📈 GET /health-metrics/statistics/:type
   * Lấy thống kê theo loại chỉ số
   */
  @Get('statistics/:type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy thống kê chỉ số sức khỏe' })
  async getStatistics(
    @CurrentUser('sub') userId: string,
    @Param('type') type: string,
  ) {
    return this.healthMetricsService.getStatistics(userId, type);
  }

  /**
   * 🔴 GET /health-metrics/alerts
   * Lấy danh sách cảnh báo
   */
  @Get('alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách cảnh báo' })
  async getAlerts(@CurrentUser('sub') userId: string) {
    return this.healthMetricsService.getAlerts(userId);
  }

  /**
   * 🔍 GET /health-metrics/:id
   * Lấy chi tiết 1 chỉ số
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết chỉ số sức khỏe' })
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.healthMetricsService.findOne(userId, id);
  }

  /**
   * ✏️ PATCH /health-metrics/:id
   * Cập nhật chỉ số sức khỏe
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật chỉ số sức khỏe' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHealthMetricDto,
  ) {
    return this.healthMetricsService.update(userId, id, dto);
  }

  /**
   * ✅ POST /health-metrics/:id/review
   * Đánh dấu chỉ số đã review (xóa cảnh báo)
   */
  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu chỉ số đã review' })
  async markAsReviewed(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.healthMetricsService.markAsReviewed(userId, id);
  }

  /**
   * 🗑️ DELETE /health-metrics/:id
   * Xóa chỉ số sức khỏe
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa chỉ số sức khỏe' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.healthMetricsService.remove(userId, id);
  }
}
