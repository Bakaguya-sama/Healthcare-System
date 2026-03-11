import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserEntity, UserDocument } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserEntity.name) private userModel: Model<UserDocument>,
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
}
