import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FamilyLinkPage,
  FamilyLinkReadModel,
  FamilyLinkReadRepository,
} from '../../application/ports/family-link-read.repository';
import { FamilyLink, FamilyLinkDocument } from './family-link.schema';

@Injectable()
export class MongooseFamilyLinkReadRepository implements FamilyLinkReadRepository {
  constructor(
    @InjectModel(FamilyLink.name)
    private readonly links: Model<FamilyLinkDocument>,
  ) {}

  async findParticipantPage(input: {
    userId: string;
    direction: 'sent' | 'received' | 'all';
    status?: string;
    page: number;
    limit: number;
  }): Promise<FamilyLinkPage> {
    if (!Types.ObjectId.isValid(input.userId)) {
      return { items: [], total: 0 };
    }
    const userObjectId = new Types.ObjectId(input.userId);
    const filter: Record<string, unknown> =
      input.direction === 'sent'
        ? { patientId: userObjectId }
        : input.direction === 'received'
          ? { familyUserId: userObjectId }
          : {
              $or: [
                { patientId: userObjectId },
                { familyUserId: userObjectId },
              ],
            };
    if (input.status) filter.status = input.status;
    return this.findPage(filter, input.page, input.limit);
  }

  async findParticipantLink(userId: string, linkId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(linkId)) {
      return null;
    }
    const userObjectId = new Types.ObjectId(userId);
    const link = await this.links
      .findOne({
        _id: new Types.ObjectId(linkId),
        $or: [{ patientId: userObjectId }, { familyUserId: userObjectId }],
      })
      .lean()
      .exec();
    return link ? this.map(link) : null;
  }

  async findAdminPage(input: { status?: string; page: number; limit: number }) {
    return this.findPage(
      input.status ? { status: input.status } : {},
      input.page,
      input.limit,
    );
  }

  private async findPage(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<FamilyLinkPage> {
    const [items, total] = await Promise.all([
      this.links
        .find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.links.countDocuments(filter),
    ]);
    return { items: items.map((item) => this.map(item)), total };
  }

  private map(link: FamilyLink & { _id: unknown }): FamilyLinkReadModel {
    return {
      id: String(link._id),
      patientId: String(link.patientId),
      relationship: link.relationship,
      status: link.status,
      invitationVersion: link.invitationVersion,
      invitationDelivery: link.invitationDelivery,
      invitationExpiresAt: link.invitationExpiresAt,
      shortCodeExpiresAt: link.shortCodeExpiresAt,
      permissions: link.permissions,
      consentVersion: link.consentVersion,
      invitedAt: link.invitedAt,
      acceptedAt: link.acceptedAt,
      pausedAt: link.pausedAt,
      resumedAt: link.resumedAt,
      declinedAt: link.declinedAt,
      expiredAt: link.expiredAt,
      revokedAt: link.revokedAt,
    };
  }
}
