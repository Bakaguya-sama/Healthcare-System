import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ClientSession, Model, Types } from 'mongoose';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../core/domain/user.enums';
import {
  User,
  UserDocument,
} from '../../../users/domain/entities/users/user.schema';
import {
  OAuthIdentity,
  OAuthIdentityDocument,
} from '../../domain/entities/oauth-identity.schema';
import type {
  CreateGooglePatientAccountResult,
  GoogleEmailOwner,
  GooglePatientAccount,
  GooglePatientAccountRepositoryPort,
} from '../../application/ports/google-patient-account.repository.port';

@Injectable()
export class MongooseGooglePatientAccountRepository implements GooglePatientAccountRepositoryPort {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(OAuthIdentity.name)
    private readonly identities: Model<OAuthIdentityDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findByProviderSubject(
    provider: 'google',
    providerAccountId: string,
  ): Promise<GooglePatientAccount | null> {
    const identity = await this.identities
      .findOne({ provider, providerAccountId })
      .select('userId')
      .lean()
      .exec();
    if (!identity) return null;
    const user = await this.users
      .findById(identity.userId)
      .select(
        '+passwordHash role accountStatus email emailVerifiedAt fullName avatarUrl doctorProfile.verificationStatus',
      )
      .lean()
      .exec();
    return user ? this.toAccount(user) : null;
  }

  findEmailOwner(email: string): Promise<GoogleEmailOwner> {
    return this.emailOwner(email);
  }

  async createPatientAccount(input: {
    provider: 'google';
    providerAccountId: string;
    email?: string;
    emailVerified: boolean;
    fullName: string;
  }): Promise<CreateGooglePatientAccountResult> {
    const session = await this.connection.startSession();
    let result: CreateGooglePatientAccountResult | undefined;
    try {
      await session.withTransaction(async () => {
        result = undefined;
        const existingIdentity = await this.identities
          .findOne({
            provider: input.provider,
            providerAccountId: input.providerAccountId,
          })
          .select('userId')
          .session(session)
          .lean()
          .exec();
        if (existingIdentity) {
          const existingUser = await this.users
            .findById(existingIdentity.userId)
            .select(
              '+passwordHash role accountStatus email emailVerifiedAt fullName avatarUrl doctorProfile.verificationStatus',
            )
            .session(session)
            .lean()
            .exec();
          result = existingUser
            ? {
                kind: 'existing_subject',
                account: this.toAccount(existingUser),
              }
            : { kind: 'dangling_identity' };
          return;
        }

        if (input.email) {
          const owner = await this.emailOwner(input.email, session);
          if (owner) {
            result = { kind: owner };
            return;
          }
        }

        const now = new Date();
        const [user] = await this.users.create(
          [
            {
              fullName: input.fullName || 'Google user',
              ...(input.email ? { email: input.email } : {}),
              ...(input.email && input.emailVerified
                ? { emailVerifiedAt: now }
                : {}),
              role: UserRole.PATIENT,
              accountStatus: AccountStatus.ACTIVE,
            },
          ],
          { session },
        );
        await this.identities.create(
          [
            {
              provider: input.provider,
              providerAccountId: input.providerAccountId,
              providerEmail: input.email ?? null,
              providerEmailVerified: Boolean(
                input.email && input.emailVerified,
              ),
              userId: user._id,
              linkedAt: now,
            },
          ],
          { session },
        );
        result = {
          kind: 'created',
          account: this.toAccount(user),
        };
      });
      if (result) return result;
      return { kind: 'conflict' };
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;
      // A concurrent transaction may have created this subject or claimed its email.
      const exactSubject = await this.findByProviderSubject(
        input.provider,
        input.providerAccountId,
      );
      if (exactSubject)
        return { kind: 'existing_subject', account: exactSubject };
      const owner = input.email ? await this.emailOwner(input.email) : null;
      return owner ? { kind: owner } : { kind: 'conflict' };
    } finally {
      await session.endSession();
    }
  }

  private async emailOwner(
    email: string,
    session?: ClientSession,
  ): Promise<GoogleEmailOwner> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedEmailFilter = {
      $expr: {
        $eq: [
          { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
          normalizedEmail,
        ],
      },
    };
    const localAccountQuery = this.users
      .findOne({
        ...normalizedEmailFilter,
        passwordHash: { $type: 'string' },
      })
      .select('_id')
      .lean();
    if (session) localAccountQuery.session(session);
    if (await localAccountQuery.exec()) return 'password_account';

    const matchingUsersQuery = this.users
      .find(normalizedEmailFilter)
      .select('_id')
      .lean();
    if (session) matchingUsersQuery.session(session);
    const matchingUsers = await matchingUsersQuery.exec();
    if (matchingUsers.length) {
      const googleIdentityQuery = this.identities.exists({
        provider: 'google',
        userId: { $in: matchingUsers.map((user) => user._id) },
      });
      if (session) googleIdentityQuery.session(session);
      if (await googleIdentityQuery) return 'google_account';
      return 'other_account';
    }

    // Legacy identities may retain providerEmail while their User has no email.
    const identityQuery = this.identities.exists({
      provider: 'google',
      $expr: {
        $eq: [
          {
            $toLower: {
              $trim: { input: { $ifNull: ['$providerEmail', ''] } },
            },
          },
          normalizedEmail,
        ],
      },
    });
    if (session) identityQuery.session(session);
    return (await identityQuery) ? 'google_account' : null;
  }

  private toAccount(user: {
    _id: Types.ObjectId;
    email?: string;
    emailVerifiedAt?: Date | null;
    fullName: string;
    avatarUrl?: string;
    role: UserRole;
    accountStatus: AccountStatus;
    passwordHash?: string;
    doctorProfile?: { verificationStatus?: DoctorVerificationStatus };
  }): GooglePatientAccount {
    return {
      id: String(user._id),
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      accountStatus: user.accountStatus,
      hasPassword: Boolean(user.passwordHash),
      doctorVerificationStatus: user.doctorProfile?.verificationStatus,
    };
  }

  private isDuplicateKeyError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
