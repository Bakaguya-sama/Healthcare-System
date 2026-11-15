import { ROLES_KEY } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CareEnrollmentController } from './care-enrollment.controller';
import { CareProgramRuleController } from './care-program-rule.controller';
import {
  QueryCareEnrollmentsDto,
  QueryCareProgramsDto,
} from '../dto/chronic-care-read.dto';
import { QueryCareRuleDto } from '../dto/care-rule-read.dto';

function roles(controller: object, method: string): UserRole[] {
  const handler = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(controller),
    method,
  )?.value as object;
  return Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];
}

describe('Chronic Care read route authorization', () => {
  const programs = new CareProgramRuleController(
    {} as never,
    {} as never,
    {} as never,
  );
  const enrollments = new CareEnrollmentController({} as never, {} as never);

  it('allows all authenticated product actors to read the Program catalog', () => {
    expect(roles(programs, 'listPrograms')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);
    expect(roles(programs, 'getProgram')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);
  });

  it('excludes Admin from clinical Enrollment reads until an audit permission exists', () => {
    expect(roles(enrollments, 'list')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
    ]);
    expect(roles(enrollments, 'detail')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
    ]);
  });

  it('allows Doctor/Admin Rule reads but excludes Patient at route metadata', () => {
    expect(roles(programs, 'getRule')).toEqual([
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);
  });

  it('rejects raw fields, non-allowlisted sort keys and limits above the shared hard cap', async () => {
    const programErrors = await validate(
      plainToInstance(QueryCareProgramsDto, {
        sortBy: '$where',
        limit: 101,
        rawMongoFilter: '{ status: { $ne: null } }',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(programErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['sortBy', 'limit', 'rawMongoFilter']),
    );

    const enrollmentErrors = await validate(
      plainToInstance(QueryCareEnrollmentsDto, {
        status: 'not-a-status',
        patientId: 'not-an-object-id',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(enrollmentErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['status', 'patientId']),
    );
  });

  it('accepts only active/draft Rule views and rejects pagination/raw query fields', async () => {
    const valid = await validate(plainToInstance(QueryCareRuleDto, {}), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(valid).toEqual([]);

    const invalid = await validate(
      plainToInstance(QueryCareRuleDto, {
        view: 'retired',
        page: 1,
        rawMongoFilter: '{}',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(invalid.map((error) => error.property)).toEqual(
      expect.arrayContaining(['view', 'page', 'rawMongoFilter']),
    );
  });
});
