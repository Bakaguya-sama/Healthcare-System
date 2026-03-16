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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * 📝 CREATE REVIEW
   */
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Patient tạo đánh giá cho doctor' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  /**
   * 📊 GET ALL REVIEWS (with filters & pagination)
   */
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Lấy tất cả đánh giá (có filter & phân trang)' })
  findAll(@Query() query: QueryReviewDto) {
    return this.reviewsService.findAll(query);
  }

  /**
   * ⭐ GET DOCTOR RATING STATISTICS
   */
  @Get('doctor/:doctorId/rating')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lấy điểm đánh giá trung bình của doctor' })
  getDoctorRating(@Param('doctorId') doctorId: string) {
    return this.reviewsService.getDoctorRating(doctorId);
  }

  /**
   * 📊 GET REVIEWS BY DOCTOR
   */
  @Get('doctor/:doctorId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của doctor' })
  findByDoctor(
    @Param('doctorId') doctorId: string,
    @Query() query?: Partial<QueryReviewDto>,
  ) {
    return this.reviewsService.findByDoctor(doctorId, query);
  }

  /**
   * 📈 GET TOP REVIEWED DOCTORS
   */
  @Get('top/doctors')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lấy top 10 doctors được đánh giá cao nhất' })
  getTopDoctors(@Query('limit') limit?: number) {
    return this.reviewsService.getTopDoctors(limit);
  }

  /**
   * 🔍 GET ONE REVIEW
   */
  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lấy chi tiết 1 đánh giá' })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  /**
   * ✏️ UPDATE REVIEW
   */
  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Patient cập nhật đánh giá của mình' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(userId, id, dto);
  }

  /**
   * 👍 MARK REVIEW AS HELPFUL
   */
  @Post(':id/helpful')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark review as helpful' })
  markHelpful(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.reviewsService.markHelpful(userId, id);
  }

  /**
   * ❌ UNMARK REVIEW AS HELPFUL
   */
  @Delete(':id/helpful')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unmark review as helpful' })
  unmarkHelpful(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.reviewsService.unmarkHelpful(userId, id);
  }

  /**
   * 🗑️ DELETE REVIEW
   */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Patient xóa đánh giá của mình' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.reviewsService.remove(userId, id);
  }

  /**
   * 🚩 FLAG REVIEW (ADMIN)
   */
  @Post(':id/flag')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin flag review (inappropriate content)' })
  flagReview(
    @Param('id') id: string,
    @Body() body: { adminNotes: string },
  ) {
    return this.reviewsService.flagReview(id, body.adminNotes);
  }
}
