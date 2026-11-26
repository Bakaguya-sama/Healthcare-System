import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, type UserDocument } from '../../../users/public-api';
import type {
  FamilyLinkPage,
  FamilyLinkParticipantProfile,
  FamilyLinkReadModel,
  FamilyLinkReadRepository,
} from '../../application/ports/family-link-read.repository';
import { FamilyLink, type FamilyLinkDocument } from './family-link.schema';

@Injectable()
export class MongooseFamilyLinkReadRepository implements FamilyLinkReadRepository {
  constructor(
    @InjectModel(FamilyLink.name)
    private readonly links: Model<FamilyLinkDocument>,
    @InjectModel(User.name)
    private readonly users: Model<UserDocument>,
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
    const pendingRedeemedCondition = {
      familyUserId: { $exists: false },
      status: 'pending',
      pendingRedeemerUserId: userObjectId,
    };
    const filter: Record<string, unknown> =
      input.direction === 'sent'
        ? { patientId: userObjectId }
        : input.direction === 'received'
          ? {
              $or: [{ familyUserId: userObjectId }, pendingRedeemedCondition],
            }
          : {
              $or: [
                { patientId: userObjectId },
                { familyUserId: userObjectId },
                pendingRedeemedCondition,
              ],
            };
    if (input.status) filter.status = input.status;

    const { items, total } = await this.findRawPage(
      filter,
      input.page,
      input.limit,
    );
    const profiles = await this.loadUserProfiles(
      items.map((item) =>
        String(item.patientId) === input.userId
          ? item.familyUserId
          : item.patientId,
      ),
    );

    return {
      items: items.map((item) => {
        const targetId =
          String(item.patientId) === input.userId
            ? item.familyUserId
            : item.patientId;
        const counterparty = targetId
          ? (profiles.get(String(targetId)) ?? null)
          : null;
        return this.map(item, { counterparty });
      }),
      total,
    };
  }

  async findParticipantLink(userId: string, linkId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(linkId)) {
      return null;
    }
    const userObjectId = new Types.ObjectId(userId);
    const link = await this.links
      .findOne({
        _id: new Types.ObjectId(linkId),
        $or: [
          { patientId: userObjectId },
          { familyUserId: userObjectId },
          {
            familyUserId: { $exists: false },
            status: 'pending',
            pendingRedeemerUserId: userObjectId,
          },
        ],
      })
      .lean()
      .exec();
    if (!link) return null;
    const targetId =
      String(link.patientId) === userId ? link.familyUserId : link.patientId;
    const profiles = await this.loadUserProfiles([targetId]);
    const counterparty = targetId
      ? (profiles.get(String(targetId)) ?? null)
      : null;
    return this.map(link, { counterparty });
  }

  async findAdminPage(input: { status?: string; page: number; limit: number }) {
    const { items, total } = await this.findRawPage(
      input.status ? { status: input.status } : {},
      input.page,
      input.limit,
    );
    const profiles = await this.loadUserProfiles(
      items.flatMap((item) => [item.patientId, item.familyUserId]),
    );
    return {
      items: items.map((item) =>
        this.map(item, {
          patient: profiles.get(String(item.patientId)) ?? null,
          companion: item.familyUserId
            ? (profiles.get(String(item.familyUserId)) ?? null)
            : null,
        }),
      ),
      total,
    };
  }

  private async findRawPage(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ) {
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
    return { items, total };
  }

  private async loadUserProfiles(
    ids: Array<Types.ObjectId | undefined>,
  ): Promise<Map<string, FamilyLinkParticipantProfile>> {
    const uniqueIds = new Set<string>();
    for (const id of ids) {
      if (!id) continue;
      const hex = String(id);
      if (Types.ObjectId.isValid(hex)) {
        uniqueIds.add(hex);
      }
    }
    if (uniqueIds.size === 0) {
      return new Map();
    }
    const docs = await this.users
      .find({
        _id: { $in: [...uniqueIds].map((id) => new Types.ObjectId(id)) },
      })
      .select('_id fullName email avatarUrl')
      .lean()
      .exec();
    const map = new Map<string, FamilyLinkParticipantProfile>();
    for (const doc of docs) {
      if (!doc?._id || !doc.fullName) continue;
      map.set(String(doc._id), {
        fullName: doc.fullName,
        ...(doc.email ? { email: doc.email } : {}),
        ...(doc.avatarUrl ? { avatarUrl: doc.avatarUrl } : {}),
      });
    }
    return map;
  }

  private map(
    link: FamilyLink & { _id: unknown },
    profiles?: {
      counterparty?: FamilyLinkParticipantProfile | null;
      patient?: FamilyLinkParticipantProfile | null;
      companion?: FamilyLinkParticipantProfile | null;
    },
  ): FamilyLinkReadModel {
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
      ...(profiles?.counterparty !== undefined
        ? { counterparty: profiles.counterparty }
        : {}),
      ...(profiles?.patient !== undefined
        ? { patient: profiles.patient }
        : {}),
      ...(profiles?.companion !== undefined
        ? { companion: profiles.companion }
        : {}),
    };
  }
}
