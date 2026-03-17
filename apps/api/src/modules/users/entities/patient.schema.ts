import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type PatientDocument = HydratedDocument<Patient>;

@Schema({ timestamps: true })
export class Patient {
  @Prop({ required: true, unique: true, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: false })
  @ApiProperty({ description: 'Date of birth', example: '1990-01-01' })
  dateOfBirth?: string;

  @Prop({ required: false })
  @ApiProperty({ description: 'Blood type', example: 'O+' })
  bloodType?: string;

  @Prop({ required: false })
  @ApiProperty({ description: 'Allergies', example: 'Penicillin' })
  allergies?: string;

  @Prop({ required: false })
  @ApiProperty({ description: 'Medical history notes' })
  medicalHistory?: string;

  @Prop({ required: false })
  @ApiProperty({ description: 'Emergency contact phone' })
  emergencyContactPhone?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
