import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Violation, ViolationStatus } from './entities/violation.entity';
import {
  CreateViolationDto,
  UpdateViolationDto,
  QueryViolationDto,
} from './dto/create-violation.dto';

@Injectable()
export class ViolationsService {
  constructor(
    @InjectModel(Violation.name) private violationModel: Model<Violation>,
  ) {}

  /**
   * Create violation report
   */
  async create(dto: CreateViolationDto): Promise<Violation> {
    // At least one of reporter_id or reported_user_id should be null (for auto-detection)
    // or both should be present (for user report)
    if (!dto.reporter_id && !dto.reported_user_id) {
      throw new BadRequestException(
        'Either reporter_id or reported_user_id must be provided',
      );
    }

    const violation = new this.violationModel({
      reporter_id: dto.reporter_id || null,
      reported_user_id: dto.reported_user_id || null,
      report_type: dto.report_type,
      reason: dto.reason,
    });

    return violation.save();
  }

  /**
   * Get all violations with filters
   */
  async findAll(query: QueryViolationDto): Promise<{
    data: Violation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { status, report_type, page = 1, limit = 20 } = query;

    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (report_type) {
      filter.report_type = report_type;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.violationModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporter_id', 'email name')
        .populate('reported_user_id', 'email name')
        .lean(),
      this.violationModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Get violation by ID
   */
  async findById(id: string): Promise<Violation> {
    const violation = await this.violationModel
      .findById(id)
      .populate('reporter_id', 'email name')
      .populate('reported_user_id', 'email name')
      .lean();

    if (!violation) {
      throw new NotFoundException(`Violation #${id} not found`);
    }

    return violation;
  }

  /**
   * Get violations for a specific user (reported by or against)
   */
  async findByUserId(userId: string, query: QueryViolationDto): Promise<{
    data: Violation[];
    total: number;
  }> {
    const { status, report_type, page = 1, limit = 20 } = query;

    const filter: any = {
      $or: [{ reporter_id: userId }, { reported_user_id: userId }],
    };

    if (status) {
      filter.status = status;
    }

    if (report_type) {
      filter.report_type = report_type;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.violationModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporter_id', 'email name')
        .populate('reported_user_id', 'email name')
        .lean(),
      this.violationModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Update violation (add note, resolve)
   */
  async update(id: string, dto: UpdateViolationDto): Promise<Violation> {
    const violation = await this.violationModel.findByIdAndUpdate(
      id,
      {
        resolution_note: dto.resolution_note,
        status: dto.status,
        resolved_at: dto.status === ViolationStatus.RESOLVED ? new Date() : null,
        updated_at: new Date(),
      },
      { new: true },
    )
      .populate('reporter_id', 'email name')
      .populate('reported_user_id', 'email name');

    if (!violation) {
      throw new NotFoundException(`Violation #${id} not found`);
    }

    return violation;
  }

  /**
   * Resolve violation
   */
  async resolve(id: string, resolution_note: string): Promise<Violation> {
    return this.update(id, {
      status: ViolationStatus.RESOLVED,
      resolution_note,
    });
  }

  /**
   * Delete violation
   */
  async delete(id: string): Promise<void> {
    const result = await this.violationModel.findByIdAndDelete(id);

    if (!result) {
      throw new NotFoundException(`Violation #${id} not found`);
    }
  }

  /**
   * Get violation statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    resolved: number;
    by_type: Record<string, number>;
  }> {
    const [total, pending, resolved, byType] = await Promise.all([
      this.violationModel.countDocuments(),
      this.violationModel.countDocuments({ status: 'pending' }),
      this.violationModel.countDocuments({ status: 'resolved' }),
      this.violationModel.aggregate([
        {
          $group: {
            _id: '$report_type',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const by_type = {};
    byType.forEach((item) => {
      by_type[item._id] = item.count;
    });

    return {
      total,
      pending,
      resolved,
      by_type,
    };
  }
}
