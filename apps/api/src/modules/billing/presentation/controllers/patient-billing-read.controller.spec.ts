import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import {
  QueryPatientSubscriptionsDto,
  QueryPublishedPlansDto,
} from '../dto/patient-billing-read.dto';
import { PatientBillingReadController } from './patient-billing-read.controller';

function roles(controller: object, method: string): UserRole[] {
  const handler = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(controller),
    method,
  )?.value as object;
  return Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];
}

describe('Patient Billing read route authorization and query contract', () => {
  const controller = new PatientBillingReadController({} as never);

  it('restricts all self-service reads to Patient', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, PatientBillingReadController),
    ).toEqual([UserRole.PATIENT]);
    expect(roles(controller, 'listPlans')).toBeUndefined();
    expect(roles(controller, 'subscriptions')).toBeUndefined();
    expect(roles(controller, 'usage')).toBeUndefined();
  });

  it('rejects unbounded pages and non-allowlisted Plan sort fields', async () => {
    const errors = await validate(
      plainToInstance(QueryPublishedPlansDto, {
        page: 1,
        limit: 101,
        sortBy: '$where',
        sortOrder: 1,
        patientId: '507f191e810c19729de860ea',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['limit', 'sortBy', 'patientId']),
    );
  });

  it('accepts only Subscription status and stable-sort allowlists', async () => {
    const valid = await validate(
      plainToInstance(QueryPatientSubscriptionsDto, {
        status: 'active',
        sortBy: 'startedAt',
        sortOrder: -1,
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(valid).toEqual([]);

    const invalid = await validate(
      plainToInstance(QueryPatientSubscriptionsDto, {
        status: 'paid',
        sortBy: 'sourceOrderId',
      }),
    );
    expect(invalid.map((error) => error.property)).toEqual(
      expect.arrayContaining(['status', 'sortBy']),
    );
  });
});
