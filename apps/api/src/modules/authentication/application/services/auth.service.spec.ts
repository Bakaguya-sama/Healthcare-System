import { ConflictException, ForbiddenException } from '@nestjs/common';
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
    const identities = {
      findOne: jest.fn(),
      exists: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      deleteOne: jest.fn(),
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
      identities as never,
      { verify: jest.fn(), sign: jest.fn() } as never,
      outbox as never,
      {} as never,
      config as never,
      otp as never,
    );
    return { service, users, events, identities, otp, outbox };
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

  it('rejects Google signup when its email belongs to a local account', async () => {
    const { service, identities, users } = setup();
    identities.findOne.mockResolvedValue(null);
    users.exists.mockResolvedValue({ _id: 'local-user' });

    await expect(
      service.completeGooglePatientAuthentication({
        provider: 'google',
        providerAccountId: 'google-subject',
        email: 'patient@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('refuses a legacy linked local account under the independent-login policy', async () => {
    const { service, identities, users } = setup();
    identities.findOne.mockResolvedValue({ userId: 'local-user' });
    users.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        role: UserRole.PATIENT,
        passwordHash: 'local-password-hash',
      }),
    });

    await expect(
      service.completeGooglePatientAuthentication({
        provider: 'google',
        providerAccountId: 'legacy-subject',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a second Google subject carrying an existing OAuth-only email', async () => {
    const { service, identities, users } = setup();
    identities.findOne.mockResolvedValue(null);
    identities.exists.mockResolvedValue({ _id: 'other-google-identity' });

    await expect(
      service.completeGooglePatientAuthentication({
        provider: 'google',
        providerAccountId: 'second-google-subject',
        email: 'same-google-email@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
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
