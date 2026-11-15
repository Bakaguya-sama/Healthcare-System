import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { CareProgramRuleService } from '../../application/services/care-program-rule.service';
import type { CareActor } from '../../application/services/care-program-rule.service';
import {
  CreateCareProgramDto,
  CreateCareRuleDto,
  LifecycleReasonDto,
  UpdateCareProgramDto,
  UpdateCareRuleDto,
} from '../dto/care-program-rule.dto';
import { ChronicCareReadService } from '../../application/services/chronic-care-read.service';
import {
  CareProgramDetailDto,
  CareProgramPageDto,
  QueryCareProgramsDto,
} from '../dto/chronic-care-read.dto';
import { CareRuleReadService } from '../../application/services/care-rule-read.service';
import {
  AdminCareRuleProjectionDto,
  DoctorCareRuleProjectionDto,
  QueryCareRuleDto,
} from '../dto/care-rule-read.dto';

const IDEMPOTENCY = ApiHeader({
  name: 'Idempotency-Key',
  required: true,
  description:
    'Stable client command key; reuse only with the identical request.',
});

@ApiTags('care-programs')
@ApiBearerAuth()
@ApiExtraModels(DoctorCareRuleProjectionDto, AdminCareRuleProjectionDto)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('care-programs')
export class CareProgramRuleController {
  constructor(
    private readonly catalog: CareProgramRuleService,
    private readonly reads: ChronicCareReadService,
    private readonly ruleReads: CareRuleReadService,
  ) {}

  @Get()
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List Care Programs using an actor-safe projection',
  })
  @ApiOkResponse({ type: CareProgramPageDto })
  @ApiForbiddenResponse({
    description: 'Actor is inactive or Doctor is not approved',
  })
  async listPrograms(
    @CurrentUser() actor: CareActor,
    @Query() query: QueryCareProgramsDto,
  ) {
    return this.reads.listPrograms(actor, query);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Read one Care Program using an actor-safe projection',
  })
  @ApiOkResponse({ type: CareProgramDetailDto })
  @ApiForbiddenResponse({
    description: 'Actor is inactive or Doctor is not approved',
  })
  @ApiNotFoundResponse({
    description: 'Program does not exist or is outside the actor catalog scope',
  })
  async getProgram(@CurrentUser() actor: CareActor, @Param('id') id: string) {
    return this.reads.getProgram(actor, id);
  }

  @Get(':id/rules')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Read the current Care Rule using an actor-safe projection',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DoctorCareRuleProjectionDto) },
        { $ref: getSchemaPath(AdminCareRuleProjectionDto) },
      ],
    },
  })
  @ApiForbiddenResponse({
    description:
      'Patient, inactive/unapproved Doctor, or Doctor requesting draft',
  })
  @ApiNotFoundResponse({
    description: 'Program/Rule is missing or outside the actor/view scope',
  })
  @ApiServiceUnavailableResponse({
    description:
      'The stored Rule cannot be mapped into the validated actor-safe projection',
  })
  async getRule(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Query() query: QueryCareRuleDto,
  ) {
    return this.ruleReads.getCurrentRule(actor, id, query.view);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @IDEMPOTENCY
  @ApiOperation({
    summary: 'Create a new immutable-versioned Care Program draft',
  })
  async createProgram(
    @CurrentUser() actor: CareActor,
    @Body() dto: CreateCareProgramDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.createProgram(actor, dto, key);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @IDEMPOTENCY
  @ApiOperation({ summary: 'Update a Care Program draft only' })
  async updateProgram(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: UpdateCareProgramDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.updateProgram(actor, id, dto, key);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @IDEMPOTENCY
  @ApiOperation({ summary: 'Publish an immutable Care Program version' })
  async publishProgram(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: LifecycleReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.publishProgram(
      actor,
      id,
      dto.expectedRevision,
      dto.reason,
      key,
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @IDEMPOTENCY
  @ApiOperation({ summary: 'Retire a published Care Program version' })
  async retireProgram(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: LifecycleReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.retireProgram(
      actor,
      id,
      dto.expectedRevision,
      dto.reason,
      key,
    );
  }

  @Post(':id/rules')
  @Roles(UserRole.ADMIN)
  @IDEMPOTENCY
  @ApiOperation({ summary: 'Create a Care Rule draft' })
  async createRule(
    @CurrentUser() actor: CareActor,
    @Param('id') programId: string,
    @Body() dto: CreateCareRuleDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.createRule(actor, programId, dto, key);
  }

  @Patch(':id/rules/:ruleId')
  @Roles(UserRole.ADMIN)
  @IDEMPOTENCY
  @ApiOperation({ summary: 'Update a Care Rule draft only' })
  async updateRule(
    @CurrentUser() actor: CareActor,
    @Param('id') programId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateCareRuleDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.updateRule(actor, programId, ruleId, dto, key);
  }

  @Post(':id/rules/:ruleId/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @IDEMPOTENCY
  @ApiOperation({
    summary:
      'Activate a validated Rule and retire the previous active Rule atomically',
  })
  async activateRule(
    @CurrentUser() actor: CareActor,
    @Param('id') programId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: LifecycleReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.activateRule(
      actor,
      programId,
      ruleId,
      dto.expectedRevision,
      dto.reason,
      key,
    );
  }

  @Post(':id/rules/:ruleId/retire')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @IDEMPOTENCY
  @ApiOperation({ summary: 'Retire an active Care Rule' })
  async retireRule(
    @CurrentUser() actor: CareActor,
    @Param('id') programId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: LifecycleReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.catalog.retireRule(
      actor,
      programId,
      ruleId,
      dto.expectedRevision,
      dto.reason,
      key,
    );
  }
}
