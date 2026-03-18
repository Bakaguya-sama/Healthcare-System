import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Patient, PatientDocument } from './entities/patient.entity';
import {
  CreatePatientDto,
  UpdatePatientDto,
  QueryPatientDto,
} from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name)
    private patientModel: Model<PatientDocument>,
  ) {}

  /**
   * 📝 TẠO HỒ SƠ BỆNH NHÂN MỚI
   */
  async create(userId: string, dto: CreatePatientDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Check if patient profile already exists for this user
    const existing = await this.patientModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (existing) {
      throw new ConflictException('Patient profile already exists for this user');
    }

    const patient = await this.patientModel.create({
      userId: new Types.ObjectId(userId),
      fullName: dto.fullName,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      status: 'active',
      totalSessions: 0,
      totalReviews: 0,
      averageSessionRating: 0,
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

    const patient = await this.patientModel.findOne({
      userId: new Types.ObjectId(userId),
    });

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
  async findAll(query: QueryPatientDto) {
    const filter: any = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.fullName = { $regex: query.search, $options: 'i' };
    }

    const skip = (query.page - 1) * query.limit;
    const sort: any = {};
    sort[query.sortBy || 'createdAt'] = query.sortOrder || -1;

    const [data, total] = await Promise.all([
      this.patientModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.patientModel.countDocuments(filter),
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
   * ✏️ CẬP NHẬT HỒ SƠ BỆNH NHÂN
   */
  async update(userId: string, dto: UpdatePatientDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const patient = await this.patientModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
      { new: true, runValidators: true },
    );

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return {
      statusCode: 200,
      message: 'Patient profile updated successfully',
      data: patient,
    };
  }

  /**
   * 📈 CẬP NHẬT THỐNG KÊ SESSION
   */
  async updateSessionStats(
    userId: string,
    sessionCount: number,
    rating: number,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const patient = await this.patientModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    const newTotalSessions = patient.totalSessions + sessionCount;
    const newTotalRating = patient.averageSessionRating * patient.totalReviews;
    const newAverageRating = (newTotalRating + rating) / newTotalSessions;

    const updated = await this.patientModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        totalSessions: newTotalSessions,
        totalReviews: newTotalSessions,
        averageSessionRating: Math.round(newAverageRating * 100) / 100,
        lastVisitAt: new Date(),
      },
      { new: true },
    );

    return {
      statusCode: 200,
      message: 'Patient session stats updated',
      data: updated,
    };
  }

  /**
   * 🗑️ XÓA HỒ SƠ BỆNH NHÂN
   */
  async delete(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const result = await this.patientModel.findOneAndDelete({
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
