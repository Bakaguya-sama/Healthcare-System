import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserRole } from '../../../core/domain/user.enums';
import { PatientProfileService } from './patient-profile.service';

function queryResult<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('PatientProfileService', () => {
  const userId = new Types.ObjectId().toString();

  function createService(options?: {
    user?: Record<string, unknown> | null;
    existing?: Record<string, unknown> | null;
  }) {
    const createdProfile = { _id: new Types.ObjectId(), userId };
    const user =
      options && 'user' in options ? options.user : { _id: userId };
    const patientProfiles = {
      exists: jest.fn().mockReturnValue(queryResult(options?.existing ?? null)),
      create: jest.fn().mockResolvedValue(createdProfile),
    };
    const users = {
      findOne: jest.fn().mockReturnValue(queryResult(user)),
    };
    const service = new PatientProfileService(
      patientProfiles as never,
      users as never,
    );
    return { service, patientProfiles, users, createdProfile };
  }

  it('creates a profile only for an existing patient user', async () => {
    const { service, patientProfiles, users, createdProfile } = createService();

    await expect(service.create(userId)).resolves.toMatchObject({
      statusCode: 201,
      data: createdProfile,
    });
    expect(users.findOne).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(userId), role: UserRole.PATIENT },
    );
    expect(patientProfiles.create).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
    });
  });

  it('rejects profile creation when the authenticated user is not a patient', async () => {
    const { service, patientProfiles } = createService({ user: null });

    await expect(service.create(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(patientProfiles.exists).not.toHaveBeenCalled();
  });

  it('rejects duplicate patient profiles', async () => {
    const { service, patientProfiles } = createService({
      existing: { _id: new Types.ObjectId() },
    });

    await expect(service.create(userId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(patientProfiles.create).not.toHaveBeenCalled();
  });
});
