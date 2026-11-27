import { Model, Types } from 'mongoose';
import { AdminRole, UserRole } from '../../../../core/domain/user.enums';
import { UserDocument } from '../../../users/public-api';
import { MongooseFacilityAdminAuthorityAdapter } from './mongoose-facility-admin-authority.adapter';

describe('MongooseFacilityAdminAuthorityAdapter', () => {
  const actorId = new Types.ObjectId().toHexString();
  const query = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue({ _id: actorId }),
  };
  const users = { findOne: jest.fn().mockReturnValue(query) };
  const adapter = new MongooseFacilityAdminAuthorityAdapter(users as unknown as Model<UserDocument>);

  beforeEach(() => {
    jest.clearAllMocks();
    query.exec.mockResolvedValue({ _id: actorId });
    users.findOne.mockReturnValue(query);
  });

  it('requires an active Admin with the canonical super_admin sub-role', async () => {
    await expect(adapter.isSuperAdmin(actorId)).resolves.toBe(true);
    expect(users.findOne).toHaveBeenCalledWith({
      _id: expect.any(Types.ObjectId),
      role: UserRole.ADMIN,
      accountStatus: 'active',
      'adminProfile.adminRole': AdminRole.SUPER_ADMIN,
    });
    expect(query.select).toHaveBeenCalledWith('_id');
    expect(query.lean).toHaveBeenCalledTimes(1);
  });

  it('denies non-super-admin records and malformed actor IDs', async () => {
    query.exec.mockResolvedValueOnce(null);
    await expect(adapter.isSuperAdmin(actorId)).resolves.toBe(false);
    await expect(adapter.isSuperAdmin('not-an-object-id')).resolves.toBe(false);
    expect(users.findOne).toHaveBeenCalledTimes(1);
  });
});
