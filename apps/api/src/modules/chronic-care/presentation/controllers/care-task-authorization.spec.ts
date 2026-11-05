import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { CareTaskController } from './care-task.controller';
import {
  QueryEnrollmentCareTasksDto,
  SubmitCareTaskResponseDto,
  SubmitDoctorReviewDto,
} from '../dto/care-task.dto';

function roles(controller: object, method: string): UserRole[] {
  const handler = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(controller),
    method,
  )?.value as object;
  return Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];
}

describe('Care Task route authorization and query contract', () => {
  const controller = new CareTaskController({} as never, {} as never);

  it('allows Patient and assigned Doctor to read but excludes Admin', () => {
    expect(roles(controller, 'tasks')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
    ]);
    expect(roles(controller, 'detail')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
    ]);
    expect(roles(controller, 'completionRate')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
    ]);
  });

  it('limits response submission to Patient', () => {
    expect(roles(controller, 'respond')).toEqual([UserRole.PATIENT]);
    expect(roles(controller, 'appointmentLink')).toEqual([UserRole.PATIENT]);
    expect(roles(controller, 'doctorReview')).toEqual([UserRole.DOCTOR]);
  });

  it('rejects raw fields, invalid filters and values above the hard limit', async () => {
    const errors = await validate(
      plainToInstance(QueryEnrollmentCareTasksDto, {
        status: 'terminal-ish',
        type: 'free-form',
        sortBy: '$where',
        limit: 101,
        rawMongoFilter: '{}',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'status',
        'type',
        'sortBy',
        'limit',
        'rawMongoFilter',
      ]),
    );
  });

  it('rejects free-form or unsupported response payloads', async () => {
    const errors = await validate(
      plainToInstance(SubmitCareTaskResponseDto, {
        action: 'clinical-score',
        answer: { arbitrary: true },
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['action', 'answer']),
    );
  });

  it('rejects unbounded check-in arrays and HTML Doctor notes', async () => {
    const checkIn = await validate(
      plainToInstance(SubmitCareTaskResponseDto, {
        overallStatus: 'stable',
        symptomCodes: Array.from({ length: 9 }, (_, index) => `symptom_${index}`),
        severity: 'mild',
      }),
    );
    expect(checkIn.map((error) => error.property)).toContain('symptomCodes');
    const review = await validate(
      plainToInstance(SubmitDoctorReviewDto, {
        reasonCode: 'reviewed_no_action',
        note: '<b>unsafe</b>',
      }),
    );
    expect(review.map((error) => error.property)).toContain('note');
  });
});
