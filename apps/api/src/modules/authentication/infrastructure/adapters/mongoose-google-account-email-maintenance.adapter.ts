import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
} from '../../../users/domain/entities/users/user.schema';
import { UserRole } from '../../../../core/domain/user.enums';
import {
  AuthEvent,
  AuthEventDocument,
  AuthEventType,
} from '../../domain/entities/auth-event.schema';
import {
  OAuthIdentity,
  OAuthIdentityDocument,
} from '../../domain/entities/oauth-identity.schema';
import type {
  GoogleAccountEmailMaintenancePort,
  GoogleEmailBackfillCandidate,
  GoogleEmailConsistencyReport,
} from '../../application/ports/google-account-email-maintenance.port';

@Injectable()
export class MongooseGoogleAccountEmailMaintenanceAdapter implements GoogleAccountEmailMaintenancePort {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(OAuthIdentity.name)
    private readonly identities: Model<OAuthIdentityDocument>,
    @InjectModel(AuthEvent.name)
    private readonly events: Model<AuthEventDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async listCandidates(
    afterUserId: string | undefined,
    limit: number,
  ): Promise<GoogleEmailBackfillCandidate[]> {
    const filter: Record<string, unknown> = {
      role: UserRole.PATIENT,
      passwordHash: { $in: [null] },
      $or: [{ email: { $exists: false } }, { email: null }, { email: '' }],
    };
    if (afterUserId && Types.ObjectId.isValid(afterUserId))
      filter._id = { $gt: new Types.ObjectId(afterUserId) };
    const users = await this.users
      .find(filter)
      .select('_id')
      .sort({ _id: 1 })
      .limit(limit)
      .lean()
      .exec();
    return users.map((user) => ({ userId: String(user._id) }));
  }

  async findGoogleIdentityEmail(userId: string): Promise<string | null> {
    const identity = await this.identities
      .findOne({ userId: new Types.ObjectId(userId), provider: 'google' })
      .select('providerEmail')
      .lean()
      .exec();
    return identity?.providerEmail ?? null;
  }

  async hasNormalizedEmailCollision(
    email: string,
    exceptUserId: string,
  ): Promise<boolean> {
    const existing = await this.users
      .findOne({
        _id: { $ne: new Types.ObjectId(exceptUserId) },
        $expr: {
          $eq: [
            { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
            email,
          ],
        },
      })
      .select('_id')
      .lean()
      .exec();
    return Boolean(existing);
  }

  async assignEmailIfStillMissing(
    userId: string,
    email: string,
  ): Promise<boolean> {
    const id = new Types.ObjectId(userId);
    const session = await this.connection.startSession();
    let updated = false;
    try {
      await session.withTransaction(async () => {
        // MongoDB may retry the transaction callback after a transient conflict.
        updated = false;
        const identity = await this.identities
          .findOne({
            userId: id,
            provider: 'google',
            $expr: {
              $eq: [
                {
                  $toLower: {
                    $trim: { input: { $ifNull: ['$providerEmail', ''] } },
                  },
                },
                email,
              ],
            },
          })
          .select('_id')
          .session(session)
          .exec();
        if (!identity) return;

        const collision = await this.users
          .findOne({
            _id: { $ne: id },
            $expr: {
              $eq: [
                { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
                email,
              ],
            },
          })
          .select('_id')
          .session(session)
          .lean()
          .exec();
        if (collision) return;

        const result = await this.users
          .updateOne(
            {
              _id: id,
              role: UserRole.PATIENT,
              passwordHash: { $in: [null] },
              $or: [
                { email: { $exists: false } },
                { email: null },
                { email: '' },
              ],
            },
            { $set: { email } },
            { session },
          )
          .exec();
        if (result.modifiedCount !== 1) return;

        await this.events.create(
          [
            {
              userId: id,
              eventType: AuthEventType.OAUTH_EMAIL_BACKFILLED,
              metadata: { source: 'google_identity', emailVerified: false },
            },
          ],
          { session },
        );
        updated = true;
      });
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async verifyConsistency(): Promise<GoogleEmailConsistencyReport> {
    const orphanIdentities = await this.identities
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $match: { user: { $size: 0 } } },
        { $count: 'count' },
      ])
      .exec();
    const oauthOnlyMissingIdentity = await this.users
      .aggregate([
        { $match: { role: UserRole.PATIENT, passwordHash: { $in: [null] } } },
        {
          $lookup: {
            from: 'oauth_identities',
            localField: '_id',
            foreignField: 'userId',
            as: 'identities',
          },
        },
        { $match: { identities: { $size: 0 } } },
        { $count: 'count' },
      ])
      .exec();
    const emailCollisions = await this.users
      .aggregate([
        { $match: { email: { $type: 'string', $ne: '' } } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$email' } } },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $count: 'count' },
      ])
      .exec();
    const verificationMismatches = await this.identities
      .aggregate([
        {
          $match: {
            provider: 'google',
            providerEmailVerified: true,
            providerEmail: { $type: 'string' },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $match: {
            $expr: {
              $or: [
                {
                  $ne: [
                    { $toLower: { $ifNull: ['$user.email', ''] } },
                    { $toLower: '$providerEmail' },
                  ],
                },
                { $eq: [{ $ifNull: ['$user.emailVerifiedAt', null] }, null] },
              ],
            },
          },
        },
        { $count: 'count' },
      ])
      .exec();
    return {
      orphanOAuthIdentities: orphanIdentities[0]?.count ?? 0,
      oauthOnlyPatientsMissingIdentity: oauthOnlyMissingIdentity[0]?.count ?? 0,
      normalizedEmailCollisionGroups: emailCollisions[0]?.count ?? 0,
      providerVerificationMismatches: verificationMismatches[0]?.count ?? 0,
    };
  }
}
