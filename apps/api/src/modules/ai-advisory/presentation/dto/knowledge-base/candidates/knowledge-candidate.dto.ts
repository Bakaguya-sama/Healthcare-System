import { IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProposeKnowledgeCandidateDto {
  @ApiProperty({ example: '12345678' })
  @IsString()
  @Matches(/^\d{1,12}$/)
  pmid!: string;

  @ApiProperty({ example: 'Clinical guideline title' })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ example: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  sourceUrl!: string;
}

export class RejectKnowledgeCandidateDto {
  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
