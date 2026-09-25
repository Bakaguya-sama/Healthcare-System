import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserRole } from '../../core/domain/user.enums';
import { RegisterDto } from './dto/register.dto';

describe('AuthService legacy characterization', () => {
  const userId = new Types.ObjectId();
  let userModel: Record<string, jest.Mock>;
  let jwtService: { sign: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    userModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue(null),
    };
    jwtService = {
      sign: jest.fn((_payload, options: { expiresIn: string }) =>
        options.expiresIn === '7d'
          ? 'legacy-refresh-token'
          : 'legacy-access-token',
      ),
    };

    service = new AuthService(
      userModel as never,
      jwtService as never,
      { sendOtpEmail: jest.fn() } as never,
      { uploadMultiple: jest.fn(), deleteFile: jest.fn() } as never,
    );
  });

  it('registers a patient and returns the legacy token envelope', async () => {
    const createdUser = {
      _id: userId,
      email: 'patient@example.com',
      fullName: 'Patient One',
      role: UserRole.PATIENT,
      avatarUrl: undefined,
    };
    userModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    userModel.create.mockResolvedValue(createdUser);

    const result = await service.register({
      email: createdUser.email,
      password: 'StrongPassword123!',
      fullName: createdUser.fullName,
      role: UserRole.PATIENT,
    } as RegisterDto);

    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: createdUser.email,
        role: UserRole.PATIENT,
      }),
    );
    expect(result).toMatchObject({
      accessToken: 'legacy-access-token',
      refreshToken: 'legacy-refresh-token',
      user: { id: userId, role: UserRole.PATIENT },
    });
  });

  it('creates a pending doctor profile during doctor registration', async () => {
    const createdUser = {
      _id: userId,
      email: 'doctor@example.com',
      fullName: 'Doctor One',
      role: UserRole.DOCTOR,
      avatarUrl: undefined,
    };
    userModel.findOne.mockResolvedValue(null);
    userModel.create.mockResolvedValue(createdUser);
    await service.register({
      email: createdUser.email,
      password: 'StrongPassword123!',
      fullName: createdUser.fullName,
      role: UserRole.DOCTOR,
      specialty: 'Cardiology',
      workplace: 'City Hospital',
      experienceYears: 5,
    } as RegisterDto);

    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorProfile: expect.objectContaining({
          verificationStatus: 'pending',
          specialty: 'Cardiology',
          workplace: 'City Hospital',
          experienceYears: 5,
        }),
      }),
    );
  });

  it('logs in an active patient with a matching password', async () => {
    const password = 'StrongPassword123!';
    const user = {
      _id: userId,
      email: 'patient@example.com',
      password: await bcrypt.hash(password, 4),
      fullName: 'Patient One',
      role: UserRole.PATIENT,
      accountStatus: 'active',
    };
    userModel.findOne.mockResolvedValue(user);

    const result = await service.login({ email: user.email, password });

    expect(result.accessToken).toBe('legacy-access-token');
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
      refreshToken: expect.any(String),
    });
  });

  it('refreshes tokens without validating the legacy refresh token', async () => {
    const user = {
      _id: userId,
      email: 'patient@example.com',
      fullName: 'Patient One',
      role: UserRole.PATIENT,
    };
    userModel.findById.mockResolvedValue(user);

    const result = await service.refreshToken(
      userId.toString(),
      'unverified-token',
    );

    expect(result.refreshToken).toBe('legacy-refresh-token');
  });

  it('returns the legacy logout response without persistence', async () => {
    await expect(service.logout(userId.toString())).resolves.toEqual({
      message: 'Logged out successfully',
    });
  });
});
