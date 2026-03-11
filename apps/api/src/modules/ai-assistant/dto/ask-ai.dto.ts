import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskAiDto {
  @ApiProperty({ example: 'Huyết áp 140/90 có nguy hiểm không?' })
  @IsNotEmpty()
  @IsString()
  question: string;

  @ApiProperty({
    required: false,
    description: 'Lịch sử hội thoại để duy trì ngữ cảnh',
  })
  @IsOptional()
  @IsArray()
  history?: { role: 'user' | 'model'; content: string }[];
}
