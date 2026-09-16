import { IsIn, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PageSortQueryDto } from '../../../common/pagination';

export const MESSAGE_SORT_FIELDS = ['sentAt', 'createdAt'] as const;
export type MessageSortField = (typeof MESSAGE_SORT_FIELDS)[number];

export class QueryMessageDto extends PageSortQueryDto {
  @ApiProperty({ example: '65e456def789abc012345678', required: false })
  @IsOptional()
  @IsMongoId()
  doctorSessionId?: string;

  @ApiProperty({ enum: MESSAGE_SORT_FIELDS, required: false })
  @IsOptional()
  @IsIn(MESSAGE_SORT_FIELDS)
  sortBy: MessageSortField = 'sentAt';
}
