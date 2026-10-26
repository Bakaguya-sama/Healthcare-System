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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HealthMetricsService } from '../../application/services/health-metrics.service';
import { CreateHealthMetricDto } from '../dto/create-health-metric.dto';
import {
  CorrectHealthMetricDto,
  VoidHealthMetricDto,
} from '../dto/correct-health-metric.dto';
import { QueryHealthMetricDto } from '../dto/query-health-metric.dto';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';

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
    @CurrentUser('role') userRole: string,
    @Query() query: QueryHealthMetricDto,
  ) {
    return this.healthMetricsService.findAll(userId, userRole, query);
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
    @Query() query: QueryHealthMetricDto,
  ) {
    return this.healthMetricsService.getStatistics(userId, type, query);
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
  async findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.healthMetricsService.findOne(userId, id);
  }

  @Post(':id/corrections')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bản ghi hiệu chỉnh chỉ số sức khỏe' })
  correct(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CorrectHealthMetricDto,
  ) {
    return this.healthMetricsService.correct(userId, id, dto);
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

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu chỉ số sức khỏe không còn hợp lệ' })
  void(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: VoidHealthMetricDto,
  ) {
    return this.healthMetricsService.void(userId, id, dto.reason);
  }
}
