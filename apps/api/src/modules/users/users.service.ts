import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/entities/user.schema';
import { Patient, PatientDocument } from '../patients/entities/patient.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Patient.name) private patientModel: Model<PatientDocument>,
  ) {}

  async findAll() {
    return this.userModel.find().select('-password -refreshToken');
  }

  async findDoctors() {
    return this.userModel
      .find({ role: UserRole.DOCTOR, isActive: true })
      .select('-password -refreshToken');
  }

  async findById(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .select('-password -refreshToken');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deactivate(id: string) {
    const user = await this.userModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .select('-password -refreshToken');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * 👤 POST /users/profile
   * Bệnh nhân tạo profile
   */
  async createPatientProfile(
    userId: string,
    dto: CreatePatientProfileDto,
  ) {
    // Kiểm tra user tồn tại và là patient
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.PATIENT) {
      throw new ConflictException('User is not a patient');
    }

    // Kiểm tra patient profile chưa tồn tại
    const existing = await this.patientModel.findOne({ userId });
    if (existing) {
      throw new ConflictException('Patient profile already exists');
    }

    // Tạo patient profile
    const patient = await this.patientModel.create({
      userId: new Types.ObjectId(userId),
      ...dto,
    });

    return patient.toObject({ versionKey: false });
  }

  /**
   * 👤 GET /users/profile
   * Xem patient profile của mình
   */
  async getPatientProfile(userId: string) {
    const patient = await this.patientModel
      .findOne({ userId })
      .populate('userId', 'name email phoneNumber avatar');

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return patient.toObject({ versionKey: false });
  }

  /**
   * 👤 PATCH /users/profile
   * Cập nhật patient profile
   */
  async updatePatientProfile(
    userId: string,
    dto: CreatePatientProfileDto,
  ) {
    const patient = await this.patientModel.findOneAndUpdate(
      { userId },
      dto,
      { new: true },
    );

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return patient.toObject({ versionKey: false });
  }
}
