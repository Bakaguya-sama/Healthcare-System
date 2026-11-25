import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccountStatus, UserRole } from '../../../../core/domain/user.enums';
import { User, UserDocument } from '../../domain/entities/users/user.schema';
import type {
  FamilyCompanionContactDirectory,
  FamilyCompanionContactSearch,
} from '../../application/ports/family-companion-contact-directory.port';

@Injectable()
export class MongooseFamilyCompanionContactDirectory
  implements FamilyCompanionContactDirectory
{
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  async searchEligiblePatients(
    search: string,
    page: number,
    limit: number,
  ): Promise<FamilyCompanionContactSearch> {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escapedSearch, 'i');
    const filter = {
      role: UserRole.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: { $ne: null },
      $or: [
        { fullName: pattern },
        { email: pattern },
        { phoneNumber: pattern, phoneVerifiedAt: { $ne: null } },
      ],
    };
    const [records, total] = await Promise.all([
      this.users
        .find(filter)
        .select('_id fullName email phoneNumber phoneVerifiedAt')
        .sort({ fullName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.users.countDocuments(filter).exec(),
    ]);
    return {
      items: records.map((record) => ({
        id: String(record._id),
        fullName: record.fullName,
        email: record.email,
        phoneNumber: record.phoneVerifiedAt ? record.phoneNumber : undefined,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
