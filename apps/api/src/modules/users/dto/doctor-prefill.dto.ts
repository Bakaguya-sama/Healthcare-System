import { ApiProperty } from '@nestjs/swagger';
import { DoctorVerificationStatus } from '../entities/doctor.schema';

export class DoctorPrefillData {
  @ApiProperty({ example: 'doctor@example.com' })
  email: string;

  @ApiProperty({ example: '0912345678' })
  phoneNumber: string;

  @ApiProperty({ example: 'Dr. John Doe' })
  fullName: string;

  @ApiProperty({ example: 'Cardiology' })
  specialty?: string;

  @ApiProperty({ example: 'City Hospital' })
  workplace?: string;

  @ApiProperty({ example: 10 })
  experienceYears?: number;

  @ApiProperty({
    example: [
      'https://cloudinary.com/doc1.pdf',
      'https://cloudinary.com/doc2.jpg',
    ],
  })
  verificationDocuments?: string[];

  @ApiProperty({
    enum: DoctorVerificationStatus,
    example: DoctorVerificationStatus.REJECTED,
  })
  verificationStatus: DoctorVerificationStatus;

  @ApiProperty({ example: 'Documents were blurry.' })
  rejectReason?: string;
}
