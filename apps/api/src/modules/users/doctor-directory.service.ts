import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.schema';
import { AccountStatus, DoctorVerificationStatus, UserRole } from '../../core/domain/user.enums';
import { QueryDoctorsDto } from './dto/query-doctors.dto';

const DOCTOR_PROJECTION = '_id fullName email phoneNumber avatarUrl doctorProfile';

@Injectable()
export class DoctorDirectoryService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async searchDoctors(query: QueryDoctorsDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const filter: Record<string, unknown> = {
      role: UserRole.DOCTOR,
      accountStatus: AccountStatus.ACTIVE,
      'doctorProfile.verificationStatus': DoctorVerificationStatus.APPROVED,
    };
    if (query.specialty?.trim()) filter['doctorProfile.specialty'] = query.specialty.trim();
    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [{ fullName: pattern }, { email: pattern }, { 'doctorProfile.specialty': pattern }];
    }
    const sort = query.sortOrder === 1 ? { _id: 1 as const } : { _id: -1 as const };
    const [items, total] = await Promise.all([
      this.userModel.find(filter).select(DOCTOR_PROJECTION).sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.userModel.countDocuments(filter),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }
}
