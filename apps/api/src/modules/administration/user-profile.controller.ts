import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { UserProfileQueryService } from './user-profile-query.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserProfileController {
  constructor(private readonly profiles: UserProfileQueryService) {}

  @Get(':id/profile')
  @ApiOperation({
    operationId: 'Users_findProfile',
    summary: 'Lấy profile user theo ID (role-aware)',
  })
  findProfile(@Param('id') id: string) {
    return this.profiles.findById(id);
  }
}
