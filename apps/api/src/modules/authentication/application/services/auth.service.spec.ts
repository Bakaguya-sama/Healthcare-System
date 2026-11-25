import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
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
