import { IsMongoId } from 'class-validator';
export class CreatePaymentOrderDto {
  @IsMongoId() planId!: string;
}
