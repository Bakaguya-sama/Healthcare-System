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
import { CreateAdminDto, UpdateAdminDto, QueryAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AdminsService {
  constructor(
    @InjectModel(Admin.name)
    private adminModel: Model<AdminDocument>,
  ) {}

  /**
   * 📝 TẠO HỒSƠ ADMIN MỚI (SUPER_ADMIN ONLY)
   */
  async create(currentAdminUserId: string, dto: CreateAdminDto) {
    // Check if current user is super admin
    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(currentAdminUserId),
    });

    if (
      !currentAdmin ||
      currentAdmin.adminRole !== AdminRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only super admins can create new admin accounts',
      );
    }

    // Check if admin profile already exists
    if (!dto.adminRole) {
      dto.adminRole = AdminRole.USER_MANAGER;
    }

    const admin = await this.adminModel.create({
      fullName: dto.fullName,
      adminRole: dto.adminRole,
      department: dto.department,
      permissions: dto.permissions || [],
      isActive: true,
      totalActionsPerformed: 0,
    });

    return {
      statusCode: 201,
      message: 'Admin profile created successfully',
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

    const admin = await this.adminModel.findOne({
      userId: new Types.ObjectId(userId),
    });

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

    if (
      !currentAdmin ||
      currentAdmin.adminRole !== AdminRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only super admins can view all admin accounts',
      );
    }

    const filter: any = {};

    if (query.adminRole) {
      filter.adminRole = query.adminRole;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const skip = (query.page - 1) * query.limit;
    const sort: any = {};
    sort[query.sortBy || 'createdAt'] = query.sortOrder || -1;

    const [data, total] = await Promise.all([
      this.adminModel
        .find(filter)
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

    if (
      !currentAdmin ||
      currentAdmin.adminRole !== AdminRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only super admins can update admin accounts',
      );
    }

    if (!Types.ObjectId.isValid(adminId)) {
      throw new BadRequestException('Invalid admin ID');
    }

    const admin = await this.adminModel.findByIdAndUpdate(
      new Types.ObjectId(adminId),
      {
        fullName: dto.fullName,
        adminRole: dto.adminRole,
        isActive: dto.isActive,
        department: dto.department,
        permissions: dto.permissions,
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
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const admin = await this.adminModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!admin) {
      return; // Skip if not an admin
    }

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action}`;

    await this.adminModel.findByIdAndUpdate(admin._id, {
      activityLog: [...(admin.activityLog || []), logEntry].slice(-100), // Keep last 100 logs
      totalActionsPerformed: admin.totalActionsPerformed + 1,
      lastLoginAt: new Date(),
    });
  }

  /**
   * 🗑️ XÓA HỒ SƠ ADMIN
   */
  async delete(currentAdminUserId: string, adminId: string) {
    // Check if current user is super admin
    const currentAdmin = await this.adminModel.findOne({
      userId: new Types.ObjectId(currentAdminUserId),
    });

    if (
      !currentAdmin ||
      currentAdmin.adminRole !== AdminRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only super admins can delete admin accounts',
      );
    }

    if (!Types.ObjectId.isValid(adminId)) {
      throw new BadRequestException('Invalid admin ID');
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
