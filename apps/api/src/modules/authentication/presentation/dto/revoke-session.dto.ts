import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class RevokeSessionDto { @ApiProperty() @IsMongoId() sessionId!: string; }
