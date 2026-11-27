import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { AuthSessionSchema } from '../../domain/entities/auth-session.schema';
import { AuthEventSchema } from '../../domain/entities/auth-event.schema';
import { OAuthIdentitySchema } from '../../domain/entities/oauth-identity.schema';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../core/domain/user.enums';

describe('AuthService Phase A lifecycle', () => {
  const user = { _id: { toString: () => 'user-1' }, email: 'patient@example.com', accountStatus: AccountStatus.PENDING_VERIFICATION };

  function setup() {
    const users = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
      updateOne: jest.fn(),
      exists: jest.fn(),
    };
    const events = { create: jest.fn().mockResolvedValue(undefined) };
    const googleAccounts = {
      findByProviderSubject: jest.fn(),
      findEmailOwner: jest.fn(),
      createPatientAccount: jest.fn(),
    };
    const otp = { issue: jest.fn().mockResolvedValue({}), consume: jest.fn().mockResolvedValue(undefined) };
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: jest.fn((key: string) =>
        key === 'GOOGLE_OAUTH_ENABLED' || key === 'GOOGLE_OAUTH_ALLOW_SIGNUP',
      ),
    };
    const service = new AuthService(
      users as never,
      {} as never,
      events as never,
      googleAccounts as never,
      { verify: jest.fn(), sign: jest.fn() } as never,
      outbox as never,
      {} as never,
      config as never,
      otp as never,
    );
    return { service, users, events, googleAccounts, otp, outbox };
  }

  it('keeps OTP delivery secret-free in the outbox event', async () => {
    const { service, users, otp, outbox } = setup();
    users.findOne.mockResolvedValue(user);

    await expect(service.requestEmailVerification(user.email)).resolves.toEqual({
      message: 'If eligible, a verification email has been queued',
    });

    expect(otp.issue).toHaveBeenCalledWith(user.email, 'email_verification');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.otp-delivery.requested.v1',
        payload: { userId: 'user-1', purpose: 'email_verification' },
      }),
    );
    const outboxCalls = outbox.enqueue.mock.calls as unknown as Array<[unknown]>;
    expect(JSON.stringify(outboxCalls[0][0])).not.toContain(user.email);
  });

  it('consumes an OTP before activating a pending account', async () => {
    const { service, users, otp } = setup();
    users.findOne.mockResolvedValue(user);
    users.updateOne.mockResolvedValue({ matchedCount: 1 });

    await expect(service.verifyEmail(user.email, '123456')).resolves.toEqual({
      message: 'Email verified',
    });

    expect(otp.consume).toHaveBeenCalledWith(
      user.email,
      'email_verification',
      '123456',
    );
    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: user._id, accountStatus: AccountStatus.PENDING_VERIFICATION },
      expect.anything(),
    );
    const updateCalls = users.updateOne.mock.calls as unknown as Array<
      [unknown, { $set: { accountStatus: AccountStatus; emailVerifiedAt: Date } }]
    >;
    expect(updateCalls[0][1].$set.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(updateCalls[0][1].$set.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('allows an active Google account to verify an unverified contact email by OTP without changing account status', async () => {
    const { service, users, otp } = setup();
    users.findOne.mockResolvedValue({
      ...user,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
    });
    users.updateOne.mockResolvedValue({ matchedCount: 1 });

    await expect(service.verifyEmail(user.email, '123456')).resolves.toEqual({
      message: 'Email verified',
    });
    expect(users.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: null,
      }),
      { $set: { emailVerifiedAt: expect.any(Date) } },
    );
    expect(otp.consume).toHaveBeenCalledWith(
      user.email,
      'email_verification',
      '123456',
    );
  });

  it('queues a verification OTP for an active account only while its email remains unverified', async () => {
    const { service, users, otp, outbox } = setup();
    users.findOne.mockResolvedValue({
      ...user,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: null,
    });

    await service.requestEmailVerification(user.email);
    expect(otp.issue).toHaveBeenCalledWith(user.email, 'email_verification');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { userId: 'user-1', purpose: 'email_verification' },
      }),
    );
  });

  it('directs a Google collision with a password account to local sign-in', async () => {
    const { service, googleAccounts } = setup();
    googleAccounts.findByProviderSubject.mockResolvedValue(null);
    googleAccounts.findEmailOwner.mockResolvedValue('password_account');

    await expect(
      service.completeGooglePatientAuthentication({
        provider: 'google',
        providerAccountId: 'google-subject',
        email: 'patient@example.com',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_GOOGLE_LOCAL_ACCOUNT_EXISTS',
        message: expect.stringContaining('email and password'),
      },
    });
    expect(googleAccounts.createPatientAccount).not.toHaveBeenCalled();
  });

  it('gives a distinct recovery message when email belongs to another Google account', async () => {
    const { service, googleAccounts } = setup();
    googleAccounts.findByProviderSubject.mockResolvedValue(null);
    googleAccounts.findEmailOwner.mockResolvedValue('google_account');

    await expect(
      service.completeGooglePatientAuthentication({
        provider: 'google',
        providerAccountId: 'different-subject',
        email: 'same@example.com',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_GOOGLE_IDENTITY_EXISTS',
        message: expect.stringContaining('different Google account'),
      },
    });
    expect(googleAccounts.createPatientAccount).not.toHaveBeenCalled();
  });

  it('refuses a legacy linked local account under the independent-login policy', async () => {
    const { service, googleAccounts } = setup();
    googleAccounts.findByProviderSubject.mockResolvedValue({
      id: 'local-user',
      email: 'patient@example.com',
      emailVerified: true,
      fullName: 'Patient',
      role: UserRole.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
      hasPassword: true,
    });

    await expect(
      service.completeGooglePatientAuthentication({
        provider: 'google',
        providerAccountId: 'legacy-subject',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('logs an existing Google subject by provider ID without changing its email', async () => {
    const { service, googleAccounts, users, events } = setup();
    googleAccounts.findByProviderSubject.mockResolvedValue({
      id: 'oauth-user',
      email: 'saved@example.com',
      emailVerified: false,
      fullName: 'Patient',
      role: UserRole.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
      hasPassword: false,
    });
    jest.spyOn(service as never, 'issueSession' as never).mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    } as never);

    await service.completeGooglePatientAuthentication({
      provider: 'google',
      providerAccountId: 'stable-subject',
      email: 'changed-at-provider@example.com',
      emailVerified: true,
    });

    expect(googleAccounts.createPatientAccount).not.toHaveBeenCalled();
    expect(users.updateOne).not.toHaveBeenCalled();
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { provider: 'google' } }),
    );
  });

  it('creates a Google Patient account with normalized email and only trusted verification evidence', async () => {
    const { service, googleAccounts } = setup();
    googleAccounts.findByProviderSubject.mockResolvedValue(null);
    googleAccounts.findEmailOwner.mockResolvedValue(null);
    googleAccounts.createPatientAccount.mockResolvedValue({
      kind: 'created',
      account: {
        id: 'oauth-user-1',
        email: 'verified@example.com',
        emailVerified: true,
        fullName: 'Synthetic Patient',
        role: UserRole.PATIENT,
        accountStatus: AccountStatus.ACTIVE,
        hasPassword: false,
      },
    });
    jest.spyOn(service as never, 'issueSession' as never).mockResolvedValue({} as never);

    await service.completeGooglePatientAuthentication({
      provider: 'google',
      providerAccountId: 'subject-verified',
      email: 'VERIFIED@example.com',
      emailVerified: true,
    });

    expect(googleAccounts.createPatientAccount).toHaveBeenCalledWith({
      provider: 'google',
      providerAccountId: 'subject-verified',
      email: 'verified@example.com',
      emailVerified: true,
      fullName: 'Google user',
    });
  });

  it('never treats an unverified Google email as verified', async () => {
    const { service, googleAccounts } = setup();
    googleAccounts.findByProviderSubject.mockResolvedValue(null);
    googleAccounts.findEmailOwner.mockResolvedValue(null);
    googleAccounts.createPatientAccount.mockResolvedValue({
      kind: 'created',
      account: {
        id: 'oauth-user-2',
        email: 'unverified@example.com',
        emailVerified: false,
        fullName: 'Google user',
        role: UserRole.PATIENT,
        accountStatus: AccountStatus.ACTIVE,
        hasPassword: false,
      },
    });
    jest.spyOn(service as never, 'issueSession' as never).mockResolvedValue({} as never);

    await service.completeGooglePatientAuthentication({
      provider: 'google',
      providerAccountId: 'subject-unverified',
      email: 'unverified@example.com',
      emailVerified: false,
    });

    expect(googleAccounts.createPatientAccount).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false }),
    );
  });

  it('restores rejected Doctor fields without returning a raw document URL', async () => {
    const { service, users } = setup();
    const select = jest.fn().mockResolvedValue({
      email: 'doctor@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 4),
      role: UserRole.DOCTOR,
      fullName: 'Dr. Existing',
      phoneNumber: '0900000000',
      doctorProfile: {
        specialty: 'Cardiology',
        workplace: 'Clinic',
        experienceYears: 5,
        verificationStatus: DoctorVerificationStatus.REJECTED,
        verificationDocuments: ['https://storage.example/private-document.pdf'],
      },
    });
    users.findOne.mockReturnValue({ select });
    const result = await service.restoreDoctorReapplication(
      'doctor@example.com',
      'StrongPass123!',
    );

    expect(result).toMatchObject({
      fullName: 'Dr. Existing',
      specialty: 'Cardiology',
      verificationDocumentCount: 1,
      verificationDocuments: [{ id: 'existing-document-1' }],
    });
    expect(JSON.stringify(result)).not.toContain('private-document.pdf');
  });

  it('does not send another verification OTP for an active rejected Doctor', async () => {
    const { service, users, otp } = setup();
    const existing = {
      _id: { toString: () => 'doctor-1' },
      email: 'doctor@example.com',
      passwordHash: await bcrypt.hash('StrongPass123!', 4),
      role: UserRole.DOCTOR,
      fullName: 'Dr. Existing',
      accountStatus: AccountStatus.ACTIVE,
      doctorProfile: {
        specialty: 'Old specialty',
        workplace: 'Old clinic',
        experienceYears: 1,
        verificationStatus: DoctorVerificationStatus.REJECTED,
        verificationDocuments: ['owned-document-url'],
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
    users.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(existing) });
    await service.registerDoctor({
      email: 'doctor@example.com',
      password: 'StrongPass123!',
      fullName: 'Dr. Existing',
      specialty: 'New specialty',
      workplace: 'New clinic',
      experienceYears: 2,
    });

    expect(existing.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(existing.doctorProfile.verificationStatus).toBe(
      DoctorVerificationStatus.PENDING,
    );
    expect(existing.doctorProfile.verificationDocuments).toEqual([
      'owned-document-url',
    ]);
    expect(otp.issue).not.toHaveBeenCalled();
  });
});

describe('AuthService session lifecycle, ObjectId schemas, and auth profile', () => {
  function setupSessionSuite() {
    const userFindById = jest.fn<
      { select: jest.Mock<Promise<unknown>, [string]> },
      [unknown]
    >();
    const users = {
      findById: userFindById,
    };

    const sessionFindOne = jest.fn<
      { select: jest.Mock<Promise<unknown>, [string]> },
      [Record<string, unknown>]
    >();
    const sessionFind = jest.fn<
      {
        sort: jest.Mock<
          { lean: jest.Mock<Promise<unknown[]>, []> },
          [Record<string, unknown>]
        >;
      },
      [Record<string, unknown>]
    >();
    const sessionCreate = jest.fn<
      Promise<unknown>,
      [Record<string, unknown>]
    >();
    const sessionUpdateOne = jest.fn<
      Promise<{ matchedCount?: number; modifiedCount?: number }>,
      [Record<string, unknown>, Record<string, unknown>]
    >();
    const sessionUpdateMany = jest.fn<
      Promise<{ modifiedCount?: number }>,
      [Record<string, unknown>, Record<string, unknown>]
    >();
    const sessions = {
      findOne: sessionFindOne,
      find: sessionFind,
      create: sessionCreate,
      updateOne: sessionUpdateOne,
      updateMany: sessionUpdateMany,
    };

    const eventCreate = jest.fn<Promise<void>, [Record<string, unknown>]>()
      .mockResolvedValue(undefined);
    const events = { create: eventCreate };

    const jwtVerify = jest.fn<unknown, [string]>();
    const jwtSign = jest.fn<string, [Record<string, unknown>, Record<string, unknown>]>();

    const service = new AuthService(
      users as never,
      sessions as never,
      events as never,
      {} as never,
      { verify: jwtVerify, sign: jwtSign } as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      {} as never,
    );

    return {
      service,
      userFindById,
      sessionFindOne,
      sessionFind,
      sessionCreate,
      sessionUpdateOne,
      sessionUpdateMany,
      eventCreate,
      jwtVerify,
      jwtSign,
    };
  }

  it('compiles userId and replacedBySessionId as ObjectId paths in auth Mongoose schemas', () => {
    expect(AuthSessionSchema.path('userId').instance).toBe('ObjectId');
    expect(AuthSessionSchema.path('replacedBySessionId').instance).toBe(
      'ObjectId',
    );
    expect(AuthEventSchema.path('userId').instance).toBe('ObjectId');
    expect(OAuthIdentitySchema.path('userId').instance).toBe('ObjectId');
  });

  it('queries AuthSession with ObjectId keys and atomically rotates refresh tokens', async () => {
    const {
      service,
      userFindById,
      sessionFindOne,
      sessionCreate,
      sessionUpdateOne,
      jwtVerify,
      jwtSign,
    } = setupSessionSuite();

    const userId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId().toString();
    const rawRefreshToken = 'raw-refresh-token';
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    jwtVerify.mockReturnValue({ sub: userId, jti: sessionId });
    jwtSign
      .mockReturnValueOnce('next-access-token')
      .mockReturnValueOnce('next-refresh-token');

    const sessionSelect = jest.fn<Promise<unknown>, [string]>().mockResolvedValue({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
      familyId: 'family-1',
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessionFindOne.mockReturnValue({ select: sessionSelect });

    const userSelect = jest.fn<Promise<unknown>, [string]>().mockResolvedValue({
      _id: new Types.ObjectId(userId),
      email: 'patient@example.com',
      emailVerifiedAt: new Date(),
      fullName: 'Local Patient',
      role: UserRole.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: 'bcrypt-hash',
    });
    userFindById.mockReturnValue({ select: userSelect });
    sessionUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    sessionCreate.mockResolvedValue(undefined);

    const result = await service.refreshToken(rawRefreshToken, {
      userAgent: 'TestAgent/1.0',
    });

    const queryFilter = sessionFindOne.mock.calls[0][0];
    expect(queryFilter._id).toBeInstanceOf(Types.ObjectId);
    expect(queryFilter.userId).toBeInstanceOf(Types.ObjectId);
    expect(sessionSelect).toHaveBeenCalledWith('+refreshTokenHash');
    expect(userSelect).toHaveBeenCalledWith('+passwordHash');

    const rotationUpdate = sessionUpdateOne.mock.calls[0][1] as {
      $set: { revokeReason: string; replacedBySessionId: unknown };
    };
    expect(rotationUpdate.$set.revokeReason).toBe('rotated');
    expect(rotationUpdate.$set.replacedBySessionId).toBeInstanceOf(
      Types.ObjectId,
    );
    expect(result.user).toMatchObject({
      id: userId,
      hasPassword: true,
      authProvider: 'local',
    });
  });

  it('revokes the token family if concurrent refresh rotation already consumed the session', async () => {
    const {
      service,
      userFindById,
      sessionFindOne,
      sessionUpdateOne,
      sessionUpdateMany,
      jwtVerify,
    } = setupSessionSuite();

    const userId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId().toString();
    const rawRefreshToken = 'concurrent-refresh-token';
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    jwtVerify.mockReturnValue({ sub: userId, jti: sessionId });
    sessionFindOne.mockReturnValue({
      select: jest.fn<Promise<unknown>, [string]>().mockResolvedValue({
        _id: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(userId),
        familyId: 'family-race',
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });
    userFindById.mockReturnValue({
      select: jest.fn<Promise<unknown>, [string]>().mockResolvedValue({
        _id: new Types.ObjectId(userId),
        role: UserRole.PATIENT,
        accountStatus: AccountStatus.ACTIVE,
      }),
    });
    sessionUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    sessionUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    await expect(service.refreshToken(rawRefreshToken)).rejects.toThrow(
      'Refresh token is invalid',
    );
    const [replayFilter, replayUpdate] = sessionUpdateMany.mock.calls[0] as [
      Record<string, unknown>,
      { $set: { revokeReason: string; revokedAt: Date } },
    ];
    expect(replayFilter).toEqual({ familyId: 'family-race', revokedAt: null });
    expect(replayUpdate.$set.revokeReason).toBe('refresh_replay');
    expect(replayUpdate.$set.revokedAt).toBeInstanceOf(Date);
  });

  it('lists active unrevoked sessions using ObjectId and detects current sid', async () => {
    const { service, sessionFind } = setupSessionSuite();
    const userId = new Types.ObjectId().toString();
    const currentSid = new Types.ObjectId();
    const otherSid = new Types.ObjectId();

    const lean = jest.fn<Promise<unknown[]>, []>().mockResolvedValue([
      {
        _id: currentSid,
        deviceLabel: 'Device A',
        issuedAt: new Date('2026-11-27T01:00:00Z'),
        lastActiveAt: new Date('2026-11-27T02:00:00Z'),
        revokedAt: null,
      },
      {
        _id: otherSid,
        deviceLabel: null,
        issuedAt: new Date('2026-11-26T01:00:00Z'),
        lastActiveAt: new Date('2026-11-26T02:00:00Z'),
        revokedAt: null,
      },
    ]);
    const sort = jest.fn<{ lean: typeof lean }, [Record<string, unknown>]>().mockReturnValue({ lean });
    sessionFind.mockReturnValue({ sort });

    const rows = await service.listSessions(userId, currentSid.toString());
    const filter = sessionFind.mock.calls[0][0];
    expect(filter.userId).toBeInstanceOf(Types.ObjectId);
    expect(filter.revokedAt).toBeNull();
    expect(rows).toEqual([
      expect.objectContaining({ id: currentSid.toString(), current: true }),
      expect.objectContaining({
        id: otherSid.toString(),
        deviceLabel: 'Unknown device',
        current: false,
      }),
    ]);
  });

  it('revokes single session and all user sessions using ObjectId filters', async () => {
    const { service, sessionUpdateOne, sessionUpdateMany } = setupSessionSuite();
    const userId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId().toString();
    sessionUpdateOne.mockResolvedValue({ matchedCount: 1 });
    sessionUpdateMany.mockResolvedValue({ modifiedCount: 2 });

    await expect(service.revokeSession(userId, sessionId)).resolves.toEqual({
      message: 'Session revoked',
    });
    const revokeFilter = sessionUpdateOne.mock.calls[0][0];
    expect(revokeFilter._id).toBeInstanceOf(Types.ObjectId);
    expect(revokeFilter.userId).toBeInstanceOf(Types.ObjectId);

    await expect(service.revokeAllSessions(userId)).resolves.toEqual({
      message: 'All sessions revoked',
    });
    const revokeAllFilter = sessionUpdateMany.mock.calls[0][0];
    expect(revokeAllFilter.userId).toBeInstanceOf(Types.ObjectId);
  });

  it('returns hasPassword and authProvider in getProfile without exposing passwordHash', async () => {
    const { service, userFindById } = setupSessionSuite();

    const localUser = {
      _id: new Types.ObjectId(),
      email: 'local@example.com',
      fullName: 'Local User',
      role: UserRole.PATIENT,
      passwordHash: 'secret-bcrypt-hash',
    };
    const googleUser = {
      _id: new Types.ObjectId(),
      email: 'google@example.com',
      fullName: 'Google User',
      role: UserRole.PATIENT,
      passwordHash: undefined,
    };

    userFindById
      .mockReturnValueOnce({
        select: jest.fn<Promise<unknown>, [string]>().mockReturnValue({
          lean: jest.fn<Promise<unknown>, []>().mockResolvedValue(localUser),
        } as never),
      } as never)
      .mockReturnValueOnce({
        select: jest.fn<Promise<unknown>, [string]>().mockReturnValue({
          lean: jest.fn<Promise<unknown>, []>().mockResolvedValue(googleUser),
        } as never),
      } as never);

    const localProfile = await service.getProfile(localUser._id.toString());
    expect(localProfile).toMatchObject({
      email: 'local@example.com',
      hasPassword: true,
      authProvider: 'local',
    });
    expect(localProfile).not.toHaveProperty('passwordHash');

    const googleProfile = await service.getProfile(googleUser._id.toString());
    expect(googleProfile).toMatchObject({
      email: 'google@example.com',
      hasPassword: false,
      authProvider: 'google',
    });
    expect(googleProfile).not.toHaveProperty('passwordHash');
  });
});
