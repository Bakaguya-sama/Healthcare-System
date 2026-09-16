import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../../common/pagination';
import { SessionStatus } from '../../sessions/entities/session.entity';

export class QuerySessionAdminDto extends PageQueryDto {
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @IsOptional()
  @IsIn(Object.values(SessionStatus))
  status?: SessionStatus;

  @IsOptional()
  @IsIn(['createdAt', 'scheduledAt', 'updatedAt'])
  sortBy?: 'createdAt' | 'scheduledAt' | 'updatedAt' = 'createdAt';

  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
