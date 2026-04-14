import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Admin, AdminDocument, AdminRole } from './entities/admin.entity';
import {
  CreateAdminDto,
  UpdateAdminDto,
  QueryAdminDto,
} from './dto/create-admin.dto';
import {
  User,
  UserDocument,
  AccountStatus,
} from '../auth/entities/user.schema';
import { UserRole } from '../users/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

type AdminListFilter = {
  adminRole?: AdminRole;
};

type AdminSort = Record<string, 1 | -1>;

@Injectable()
export class AdminsService {
  constructor(
    @InjectModel(Admin.name)
    private adminModel: Model<AdminDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * 📝 TẠO HỒ SƠ ADMIN MỚI (SUPER_ADMIN ONLY)
   */
  async create(currentAdminUserId: string, dto: CreateAdminDto) {
    // Check if current user is super admin
    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(currentAdminUserId),
    });

    if (!currentAdmin || currentAdmin.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only super admins can create new admin accounts',
      );
    }

    const existingUser = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const assignedRole = dto.assignedRole || AdminRole.USER_ADMIN;
    const accountStatus = dto.accountStatus || AccountStatus.ACTIVE;

    const newUser = await this.userModel.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      fullName: dto.fullName,
      role: UserRole.ADMIN,
      accountStatus,
    });

    let admin: AdminDocument;
    try {
      admin = await this.adminModel.create({
        userId: newUser._id,
        adminRole: assignedRole,
      });
    } catch (error) {
      await this.userModel.findByIdAndDelete(newUser._id);
      throw error;
    }

    await admin.populate('userId', 'fullName email accountStatus');

    return {
      statusCode: 201,
      message: 'Admin account created successfully',
      data: admin,
    };
  }

  /**
   * 👤 LẤY HỒ SƠ ADMIN
   */
  async findByUserId(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const admin = await this.adminModel
      .findOne({
        userId: new Types.ObjectId(userId),
      })
      .populate('userId', 'fullName email');

    if (!admin) {
      throw new NotFoundException('Admin profile not found');
    }

    return {
      statusCode: 200,
      message: 'Admin profile retrieved successfully',
      data: admin,
    };
  }

  /**
   * 📊 LẤY TẤT CẢ ADMIN (SUPER_ADMIN ONLY)
   */
  async findAll(currentAdminUserId: string, query: QueryAdminDto) {
    // Check if current user is super admin
    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(currentAdminUserId),
    });

    if (!currentAdmin || currentAdmin.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only super admins can view all admin accounts',
      );
    }

    const filter: AdminListFilter = {};

    if (query.adminRole) {
      filter.adminRole = query.adminRole;
    }

    const skip = (query.page - 1) * query.limit;
    const sort: AdminSort = {};
    const sortOrder: 1 | -1 = query.sortOrder === 1 ? 1 : -1;
    sort[query.sortBy || 'createdAt'] = sortOrder;

    const [data, total] = await Promise.all([
      this.adminModel
        .find(filter)
        .populate('userId', 'fullName email')
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.adminModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Admins retrieved successfully',
      data: {
        admins: data,
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
   * ✏️ CẬP NHẬT HỒ SƠ ADMIN
   */
  async update(
    currentAdminUserId: string,
    adminId: string,
    dto: UpdateAdminDto,
  ) {
    // Check if current user is super admin
    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(currentAdminUserId),
    });

    if (!currentAdmin || currentAdmin.adminRole === AdminRole.AI_ADMIN) {
      throw new ForbiddenException(
        'Only super admins or user admins can update admin accounts',
      );
    }

    if (!Types.ObjectId.isValid(adminId)) {
      throw new BadRequestException('Invalid admin ID');
    }

    const targetAdmin = await this.adminModel.findById(
      new Types.ObjectId(adminId),
    );
    if (!targetAdmin) {
      throw new NotFoundException('Admin profile not found');
    }

    if (targetAdmin.userId.toString() === currentAdminUserId) {
      throw new BadRequestException('Cannot modify your account.');
    }

    const admin = await this.adminModel.findByIdAndUpdate(
      new Types.ObjectId(adminId),
      {
        adminRole: dto.adminRole,
      },
      { new: true, runValidators: true },
    );

    if (!admin) {
      throw new NotFoundException('Admin profile not found');
    }

    return {
      statusCode: 200,
      message: 'Admin profile updated successfully',
      data: admin,
    };
  }

  /**
   * 📝 GHI LẠI ACTION LOG
   */
  async logAction(userId: string, action: string) {
    void action;

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const admin = await this.adminModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!admin) {
      return; // Skip if not an admin
    }

    // Activity logging removed - not in template
  }

  /**
   * 🗑️ XÓA HỒ SƠ ADMIN
   */
  async delete(currentAdminUserId: string, adminId: string) {
    // Check if current user is super admin
    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(currentAdminUserId),
    });

    if (!currentAdmin || currentAdmin.adminRole === AdminRole.AI_ADMIN) {
      throw new ForbiddenException(
        'Only super admins or user admins can delete admin accounts',
      );
    }

    if (!Types.ObjectId.isValid(adminId)) {
      throw new BadRequestException('Invalid admin ID');
    }

    const targetAdmin = await this.adminModel.findById(
      new Types.ObjectId(adminId),
    );
    if (!targetAdmin) {
      throw new NotFoundException('Admin profile not found');
    }

    if (targetAdmin.userId.toString() === currentAdminUserId) {
      throw new BadRequestException('Cannot modify your account.');
    }

    const result = await this.adminModel.findByIdAndDelete(
      new Types.ObjectId(adminId),
    );

    if (!result) {
      throw new NotFoundException('Admin profile not found');
    }

    return {
      statusCode: 200,
      message: 'Admin profile deleted successfully',
    };
  }
}
