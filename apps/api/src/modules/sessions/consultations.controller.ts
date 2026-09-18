import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { ConsultationsService } from './consultations.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';

@ApiTags('consultations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateSessionDto) {
    return this.consultations.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string, @CurrentUser('role') role: string, @Query() query: QuerySessionDto) {
    return this.consultations.findAll(userId, role, query);
  }

  @Get('upcoming')
  upcoming(@CurrentUser('sub') userId: string, @CurrentUser('role') role: string, @Query('days') days = 7) {
    return this.consultations.getUpcoming(userId, role, Number(days));
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.consultations.findOne(userId, id);
  }

  @Patch(':id')
  update(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.consultations.update(userId, id, dto);
  }

  @Post(':id/accept')
  accept(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.consultations.accept(userId, id);
  }

  @Post(':id/decline')
  decline(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.consultations.decline(userId, id, dto.doctorNotes ?? dto.patientNotes);
  }

  @Post(':id/start')
  start(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.consultations.start(userId, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.consultations.complete(userId, id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.consultations.cancel(userId, id, dto);
  }
}
