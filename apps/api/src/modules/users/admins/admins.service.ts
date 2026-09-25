import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import {
  AccountStatus,
  AdminRole,
  UserRole,
} from '../../../core/domain/user.enums';
import {
  CreateAdminDto,
  AdminApiRole,
  QueryAdminDto,
  UpdateAdminDto,
} from './dto/create-admin.dto';
import { User, UserDocument } from '../entities/user.schema';

@Injectable()
export class AdminsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  private async requireAdmin(userId: string) {
    const admin = await this.users
      .findOne({ _id: userId, role: UserRole.ADMIN })
      .select('_id adminProfile')
      .exec();
    if (!admin?.adminProfile) {
      throw new ForbiddenException('Admin profile is required');
    }
    return admin;
  }

  private toAdminResponse(user: UserDocument | Record<string, any>) {
    const source: Record<string, any> =
      typeof (user as UserDocument).toObject === 'function'
        ? ((user as UserDocument).toObject({
            versionKey: false,
          }) as Record<string, any>)
        : (user as Record<string, any>);
    return {
      _id: source._id,
      userId: source,
      adminRole: this.toApiRole(source.adminProfile?.adminRole),
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  private toCanonicalRole(role?: AdminApiRole): AdminRole | undefined {
    if (role === AdminApiRole.SUPER_ADMIN) return AdminRole.SUPER_ADMIN;
    if (role === AdminApiRole.AI_ADMIN) return AdminRole.AI_MANAGER;
    if (role === AdminApiRole.USER_ADMIN) return AdminRole.USER_MANAGER;
    return undefined;
  }

  private toApiRole(role?: AdminRole): AdminApiRole | undefined {
    if (role === AdminRole.SUPER_ADMIN) return AdminApiRole.SUPER_ADMIN;
    if (role === AdminRole.AI_MANAGER) return AdminApiRole.AI_ADMIN;
    if (role === AdminRole.USER_MANAGER) return AdminApiRole.USER_ADMIN;
    return undefined;
  }

  async create(currentAdminUserId: string, dto: CreateAdminDto) {
    const currentAdmin = await this.requireAdmin(currentAdminUserId);
    if (currentAdmin.adminProfile?.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only super admins can create new admin accounts',
      );
    }
    if (await this.users.exists({ email: dto.email.toLowerCase() })) {
      throw new ConflictException('Email already in use');
    }
    const user = await this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash: await bcrypt.hash(dto.password, 12),
      fullName: dto.fullName,
      role: UserRole.ADMIN,
      accountStatus: dto.accountStatus ?? AccountStatus.ACTIVE,
      adminProfile: {
        adminRole:
          this.toCanonicalRole(dto.assignedRole) ?? AdminRole.USER_MANAGER,
      },
    });
    return {
      statusCode: 201,
      message: 'Admin account created successfully',
      data: this.toAdminResponse(user),
    };
  }

  async findByUserId(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    const admin = await this.users
      .findOne({
        _id: userId,
        role: UserRole.ADMIN,
        adminProfile: { $exists: true },
      })
      .select(
        '_id fullName email accountStatus adminProfile createdAt updatedAt',
      )
      .lean();
    if (!admin) throw new NotFoundException('Admin profile not found');
    return {
      statusCode: 200,
      message: 'Admin profile retrieved successfully',
      data: this.toAdminResponse(admin),
    };
  }

  async findAll(currentAdminUserId: string, query: QueryAdminDto) {
    const currentAdmin = await this.requireAdmin(currentAdminUserId);
    if (currentAdmin.adminProfile?.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only super admins can view all admin accounts',
      );
    }
    const filter: Record<string, unknown> = { role: UserRole.ADMIN };
    if (query.adminRole) {
      filter['adminProfile.adminRole'] = this.toCanonicalRole(query.adminRole);
    }
    const sortField =
      query.sortBy === 'adminRole'
        ? 'adminProfile.adminRole'
        : query.sortBy || 'createdAt';
    const order = query.sortOrder === 1 ? 1 : -1;
    const [admins, total] = await Promise.all([
      this.users
        .find(filter)
        .select(
          '_id fullName email accountStatus adminProfile createdAt updatedAt',
        )
        .sort({ [sortField]: order, _id: order })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.users.countDocuments(filter),
    ]);
    return {
      statusCode: 200,
      message: 'Admins retrieved successfully',
      data: {
        admins: admins.map((admin) => this.toAdminResponse(admin)),
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    };
  }

  async update(
    currentAdminUserId: string,
    userId: string,
    dto: UpdateAdminDto,
  ) {
    const currentAdmin = await this.requireAdmin(currentAdminUserId);
    if (currentAdmin.adminProfile?.adminRole === AdminRole.AI_MANAGER) {
      throw new ForbiddenException(
        'Only super admins or user managers can update admin accounts',
      );
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (userId === currentAdminUserId) {
      throw new BadRequestException('Cannot modify your account.');
    }
    const admin = await this.users.findOneAndUpdate(
      { _id: userId, role: UserRole.ADMIN, adminProfile: { $exists: true } },
      dto.adminRole
        ? {
            $set: {
              'adminProfile.adminRole': this.toCanonicalRole(dto.adminRole),
            },
          }
        : {},
      { new: true, runValidators: true },
    );
    if (!admin) throw new NotFoundException('Admin profile not found');
    return {
      statusCode: 200,
      message: 'Admin profile updated successfully',
      data: this.toAdminResponse(admin),
    };
  }

  async logAction(userId: string, _action: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    await this.users.exists({
      _id: userId,
      role: UserRole.ADMIN,
      adminProfile: { $exists: true },
    });
  }

  async delete(currentAdminUserId: string, userId: string) {
    const currentAdmin = await this.requireAdmin(currentAdminUserId);
    if (currentAdmin.adminProfile?.adminRole === AdminRole.AI_MANAGER) {
      throw new ForbiddenException(
        'Only super admins or user managers can delete admin accounts',
      );
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (userId === currentAdminUserId) {
      throw new BadRequestException('Cannot modify your account.');
    }
    const result = await this.users.updateOne(
      { _id: userId, role: UserRole.ADMIN, adminProfile: { $exists: true } },
      {
        $unset: { adminProfile: '' },
        $set: { accountStatus: AccountStatus.BANNED },
      },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Admin profile not found');
    }
    return { statusCode: 200, message: 'Admin profile deleted successfully' };
  }
}
