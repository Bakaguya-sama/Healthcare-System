import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdminRole, UserRole } from '../../../../core/domain/user.enums';
import { User, UserDocument } from '../../../users/public-api';
import type { FacilityAdminAuthority } from '../../application/ports/care-directory.ports';

@Injectable()
export class MongooseFacilityAdminAuthorityAdapter implements FacilityAdminAuthority {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}
  async isSuperAdmin(actorId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(actorId)) return false;
    const user = await this.users
      .findOne({
        _id: new Types.ObjectId(actorId),
        role: UserRole.ADMIN,
        accountStatus: 'active',
        'adminProfile.adminRole': AdminRole.SUPER_ADMIN,
      })
      .select('_id')
      .lean()
      .exec();
    return Boolean(user);
  }
}
