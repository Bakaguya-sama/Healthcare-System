import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class QuerySessionAdminDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  doctorId?: string;

  @IsOptional()
  patientId?: string;

  @IsOptional()
  status?: string;

  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
