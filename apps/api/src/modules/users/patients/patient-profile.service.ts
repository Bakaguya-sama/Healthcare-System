import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PatientProfile,
  PatientProfileDocument,
} from './schemas/patient-profile.schema';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { User, UserDocument } from '../entities/user.schema';
import { UserRole } from '../../../core/domain/user.enums';

const PATIENT_READ_PROJECTION = '_id userId createdAt updatedAt';

@Injectable()
export class PatientProfileService {
  constructor(
    @InjectModel(PatientProfile.name)
    private readonly patientProfiles: Model<PatientProfileDocument>,
    @InjectModel(User.name)
    private readonly users: Model<UserDocument>,
  ) {}

  /**
   * 📝 TẠO HỒ SƠ BỆNH NHÂN MỚI
   */
  async create(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const objectId = new Types.ObjectId(userId);
    const user = await this.users
      .findOne({ _id: objectId, role: UserRole.PATIENT })
      .select('_id')
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException('Patient user not found');
    }

    const existing = await this.patientProfiles
      .exists({ userId: objectId })
      .exec();

    if (existing) {
      throw new ConflictException(
        'Patient profile already exists for this user',
      );
    }

    const patient = await this.patientProfiles.create({
      userId: objectId,
    });

    return {
      statusCode: 201,
      message: 'Patient profile created successfully',
      data: patient,
    };
  }

  /**
   * 👤 LẤY HỒ SƠ BỆNH NHÂN
   */
  async findByUserId(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const patient = await this.patientProfiles
      .findOne({
        userId: new Types.ObjectId(userId),
      })
      .select(PATIENT_READ_PROJECTION)
      .populate('userId', 'fullName email phoneNumber avatarUrl')
      .lean()
      .exec();

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return {
      statusCode: 200,
      message: 'Patient profile retrieved successfully',
      data: patient,
    };
  }

  /**
   * 📊 LẤY TẤT CẢ BỆNH NHÂN (ADMIN)
   */
  async findAll(query: QueryPatientsDto) {
    const skip = (query.page - 1) * query.limit;
    const order = query.sortOrder === 1 ? 1 : -1;
    const sort = { [query.sortBy || 'createdAt']: order, _id: order } as const;

    const [data, total] = await Promise.all([
      this.patientProfiles
        .find()
        .select(PATIENT_READ_PROJECTION)
        .populate('userId', 'fullName email')
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.patientProfiles.countDocuments(),
    ]);

    return {
      statusCode: 200,
      message: 'Patients retrieved successfully',
      data: {
        patients: data,
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    };
  }

  /**
   * ️ XÓA HỒ SƠ BỆNH NHÂN
   */
  async delete(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const result = await this.patientProfiles.findOneAndDelete({
      userId: new Types.ObjectId(userId),
    });

    if (!result) {
      throw new NotFoundException('Patient profile not found');
    }

    return {
      statusCode: 200,
      message: 'Patient profile deleted successfully',
    };
  }
}
