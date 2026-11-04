import { ROLES_KEY } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { AvailabilitySlotsController } from './availability/availability-slots.controller';
import { ConsultationsController } from './consultations/consultations.controller';

describe('booking route authorization metadata', () => {
  const rolesFor = (prototype: object, method: string): UserRole[] => {
    const handler = Object.getOwnPropertyDescriptor(prototype, method)
      ?.value as ((...args: unknown[]) => unknown) | undefined;
    return Reflect.getMetadata(ROLES_KEY, handler!) as UserRole[];
  };

  it.each(['create', 'listMine', 'update', 'block', 'remove'] as const)(
    'restricts AvailabilitySlotsController.%s to doctors',
    (method) => {
      expect(rolesFor(AvailabilitySlotsController.prototype, method)).toEqual([
        UserRole.DOCTOR,
      ]);
    },
  );

  it('restricts patient slot discovery to patients', () => {
    expect(
      rolesFor(AvailabilitySlotsController.prototype, 'listAvailable'),
    ).toEqual([UserRole.PATIENT]);
  });

  it.each(['createScheduled', 'reschedule'] as const)(
    'restricts ConsultationsController.%s to patients',
    (method) => {
      expect(rolesFor(ConsultationsController.prototype, method)).toEqual([
        UserRole.PATIENT,
      ]);
    },
  );

  it('restricts consultation listing to patient and doctor actors', () => {
    expect(rolesFor(ConsultationsController.prototype, 'findAll')).toEqual([
      UserRole.PATIENT,
      UserRole.DOCTOR,
    ]);
  });
});
