import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ViolationsService } from './violations.service';
import {
  CreateViolationDto,
  UpdateViolationDto,
  QueryViolationDto,
} from './dto/create-violation.dto';
import { Violation } from './entities/violation.entity';
import { JwtAuthGuard } from './../../core/guards/jwt-auth.guard';
import { RolesGuard } from './../../core/guards/roles.guard';
import { CurrentUser } from './../../core/decorators/current-user.decorator';
import { Roles } from './../../core/decorators/roles.decorator';
import { UserRole } from './../users/enums/user-role.enum';
import type { UserPayload } from './../auth/auth.payload';

@ApiTags('Violations')
@Controller('violations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ViolationsController {
  constructor(private readonly violationsService: ViolationsService) {}

  /**
   * 📝 POST /violations
   * Create violation report
   */
  @Post()
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Report user violation' })
  @ApiResponse({ status: 201, description: 'Report created', type: Violation })
  async create(@Body() dto: CreateViolationDto): Promise<Violation> {
    return this.violationsService.create(dto);
  }

  /**
   * 📋 GET /violations
   * Get all violations (ADMIN only)
   */
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all violation reports (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'List of violations' })
  async findAll(@Query() query: QueryViolationDto) {
    return this.violationsService.findAll(query);
  }

  /**
   * 👁️ GET /violations/:id
   * Get violation detail
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get violation detail (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Violation found', type: Violation })
  async findById(@Param('id') id: string): Promise<Violation> {
    return this.violationsService.findById(id);
  }

  /**
   * 👤 GET /violations/user/:userId
   * Get violations for user (reported by or against)
   */
  @Get('user/:userId')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user violations' })
  @ApiResponse({ status: 200, description: 'User violations' })
  async findByUserId(
    @Param('userId') userId: string,
    @Query() query: QueryViolationDto,
  ) {
    return this.violationsService.findByUserId(userId, query);
  }

  /**
   * ✏️ PATCH /violations/:id
   * Update violation (add note, resolve)
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update violation (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Violation updated', type: Violation })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateViolationDto,
  ): Promise<Violation> {
    return this.violationsService.update(id, dto);
  }

  /**
   * ✓ POST /violations/:id/resolve
   * Resolve violation
   */
  @Post(':id/resolve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resolve violation (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Violation resolved', type: Violation })
  async resolve(
    @Param('id') id: string,
    @Body('resolution_note') resolution_note: string,
  ): Promise<Violation> {
    return this.violationsService.resolve(id, resolution_note);
  }

  /**
   * 🗑️ DELETE /violations/:id
   * Delete violation
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete violation (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Violation deleted' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.violationsService.delete(id);
  }

  /**
   * 📊 GET /violations/stats/overview
   * Get violation statistics
   */
  @Get('stats/overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get violation statistics (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Statistics' })
  async getStats() {
    return this.violationsService.getStats();
  }
}
