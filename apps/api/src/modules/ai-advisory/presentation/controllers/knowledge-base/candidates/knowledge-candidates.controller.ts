import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../../core/guards/roles.guard';
import type { UserPayload } from '../../../../../authentication/public-api';
import { KnowledgeCandidatesService } from '../../../../application/services/knowledge-base/candidates/knowledge-candidates.service';
import {
  ProposeKnowledgeCandidateDto,
  RejectKnowledgeCandidateDto,
} from '../../../../presentation/dto/knowledge-base/candidates/knowledge-candidate.dto';

@ApiTags('AI Knowledge Candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('ai-knowledge-candidates')
export class KnowledgeCandidatesController {
  constructor(private readonly candidates: KnowledgeCandidatesService) {}

  @Get()
  @ApiOperation({ summary: 'List quarantined external literature candidates' })
  list(@CurrentUser() user: UserPayload) {
    return this.candidates.list(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Propose a PubMed reference without storing its abstract',
  })
  propose(
    @CurrentUser() user: UserPayload,
    @Body() dto: ProposeKnowledgeCandidateDto,
  ) {
    return this.candidates.propose(user.id, dto);
  }

  @Post(':id/promote')
  @ApiOperation({
    summary: 'Promote candidate into a pending PubMed reference document',
  })
  promote(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.candidates.promote(id, user.id);
  }

  @Post(':id/reject') reject(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: RejectKnowledgeCandidateDto,
  ) {
    return this.candidates.reject(id, user.id, dto.reason);
  }
}
