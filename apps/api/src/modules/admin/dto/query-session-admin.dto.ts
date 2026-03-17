import { IsNumberString, IsOptional, IsEnum } from 'class-validator';

export class QuerySessionAdminDto {
  @IsNumberString()
  page?: number = 1;

  @IsNumberString()
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
