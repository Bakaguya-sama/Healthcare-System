import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import type { CareActor } from '../../application/services/care-program-rule.service';
import { CareTaskSchedulerService } from '../../application/services/care-task-scheduler.service';
import { CareTaskProgressService } from '../../application/services/care-task-progress.service';
import {
  CareTaskDetailDto,
  CareTaskPageDto,
  CareTaskResponseResultDto,
  QueryEnrollmentCareTasksDto,
  SubmitCareTaskResponseDto,
  SubmitDoctorReviewDto,
  LinkCareTaskConsultationDto,
} from '../dto/care-task.dto';

@ApiTags('care-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CareTaskController {
  constructor(
    private readonly scheduler: CareTaskSchedulerService,
    private readonly progress: CareTaskProgressService,
  ) {}

  @Post('care-tasks/schedule')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  schedule() {
    return this.scheduler.scheduleActiveEnrollments();
  }

  @Get('care-enrollments/:id/tasks')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  @ApiOperation({ summary: 'List tasks for an owned or assigned enrollment' })
  @ApiOkResponse({ type: CareTaskPageDto })
  tasks(
    @CurrentUser() actor: CareActor,
    @Param('id') enrollmentId: string,
    @Query() query: QueryEnrollmentCareTasksDto,
  ) {
    return this.progress.list(actor, enrollmentId, query);
  }

  @Get('care-enrollments/:id/completion-rate')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Get adherence completion rate for an enrollment' })
  completionRate(
    @CurrentUser() actor: CareActor,
    @Param('id') enrollmentId: string,
  ) {
    return this.progress.getCompletionRate(actor, enrollmentId);
  }

  @Get('care-tasks/:id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Get a bounded Care Task projection' })
  @ApiOkResponse({ type: CareTaskDetailDto })
  detail(@CurrentUser() actor: CareActor, @Param('id') taskId: string) {
    return this.progress.detail(actor, taskId);
  }

  @Post('care-tasks/:id/responses')
  @Roles(UserRole.PATIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit an approved non-metric Care Task response',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: CareTaskResponseResultDto })
  respond(
    @CurrentUser() actor: CareActor,
    @Param('id') taskId: string,
    @Body() body: SubmitCareTaskResponseDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.progress.respond(actor, taskId, body, idempotencyKey);
  }

  @Post('care-tasks/:id/doctor-review')
  @Roles(UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an assigned Doctor Review Care Task' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: CareTaskResponseResultDto })
  doctorReview(
    @CurrentUser() actor: CareActor,
    @Param('id') taskId: string,
    @Body() body: SubmitDoctorReviewDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.progress.doctorReview(
      actor,
      taskId,
      body,
      idempotencyKey,
    );
  }

  @Post('care-tasks/:id/appointment-link')
  @Roles(UserRole.PATIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link an owned appointment task to a scheduled consultation' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: CareTaskResponseResultDto })
  appointmentLink(
    @CurrentUser() actor: CareActor,
    @Param('id') taskId: string,
    @Body() body: LinkCareTaskConsultationDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.progress.linkAppointment(
      actor,
      taskId,
      body.consultationId,
      idempotencyKey,
    );
  }
}
