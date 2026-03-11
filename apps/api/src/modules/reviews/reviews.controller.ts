import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Gửi đánh giá bác sĩ' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({ summary: 'Lấy đánh giá của bác sĩ' })
  findByDoctor(@Param('doctorId') doctorId: string) {
    return this.reviewsService.findByDoctor(doctorId);
  }

  @Get('doctor/:doctorId/rating')
  @ApiOperation({ summary: 'Lấy điểm đánh giá trung bình của bác sĩ' })
  getDoctorRating(@Param('doctorId') doctorId: string) {
    return this.reviewsService.getDoctorRating(doctorId);
  }
}
