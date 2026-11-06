import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { ROLES_KEY } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { PaymentOrderStatus } from '../../domain/entities/payment.entity';
import { QueryPatientPaymentOrdersDto } from '../dto/patient-payment-order-read.dto';
import { PaymentsController } from './payments.controller';

function roles(controller: object, method: string): UserRole[] {
  const handler = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(controller),
    method,
  )?.value as object;
  return Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];
}

describe('PaymentsController patient history contract', () => {
  const controller = new PaymentsController(
    {} as never,
    {} as never,
    {} as never,
  );

  it('restricts the list route to Patient without changing Admin evidence authorization', () => {
    expect(roles(controller, 'list')).toEqual([UserRole.PATIENT]);
    expect(roles(controller, 'get')).toEqual([UserRole.PATIENT]);
    expect(roles(controller, 'getEvidence')).toEqual([UserRole.ADMIN]);
  });

  it('accepts the real status allowlist and bounded stable-sort query', async () => {
    const dto = plainToInstance(QueryPatientPaymentOrdersDto, {
      status: PaymentOrderStatus.REFUNDED,
      page: 2,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    expect(dto.sortOrder).toBe(-1);
  });

  it('rejects owner overrides, raw Mongo fields, invalid status/sort and unbounded pages', async () => {
    const errors = await validate(
      plainToInstance(QueryPatientPaymentOrdersDto, {
        patientId: new Types.ObjectId().toHexString(),
        $where: 'return true',
        status: 'completed',
        page: 0,
        limit: 101,
        sortBy: 'amount',
        sortOrder: 0,
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'patientId',
        '$where',
        'status',
        'page',
        'limit',
        'sortBy',
        'sortOrder',
      ]),
    );
  });
});
