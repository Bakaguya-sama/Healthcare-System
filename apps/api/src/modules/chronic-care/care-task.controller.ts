import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { UserRole } from '../../core/domain/user.enums';
import type { CareActor } from './application/care-program-rule.service';
import { CareTaskSchedulerService } from './care-task-scheduler.service';
import { CareTaskProgressService } from './care-task-progress.service';

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
  @Roles(UserRole.PATIENT)
  tasks(@CurrentUser() actor: CareActor, @Param('id') enrollmentId: string) {
    return this.progress.listForPatient(actor.id, enrollmentId);
  }

  @Get('care-enrollments/:id/completion-rate')
  @Roles(UserRole.PATIENT)
  completionRate(@Param('id') enrollmentId: string) {
    return this.progress.getCompletionRate(enrollmentId);
  }
}
