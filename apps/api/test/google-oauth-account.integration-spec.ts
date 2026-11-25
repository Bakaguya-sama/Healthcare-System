import { randomBytes } from 'node:crypto';
import mongoose, { Connection } from 'mongoose';
import { User, UserSchema } from '../src/modules/users/domain/entities/users/user.schema';
import { OAuthIdentity, OAuthIdentitySchema } from '../src/modules/authentication/domain/entities/oauth-identity.schema';
import { AuthEvent, AuthEventSchema } from '../src/modules/authentication/domain/entities/auth-event.schema';
import { AuthSession, AuthSessionSchema } from '../src/modules/authentication/domain/entities/auth-session.schema';
import { MongooseGooglePatientAccountRepository } from '../src/modules/authentication/infrastructure/adapters/mongoose-google-patient-account.repository';
import { UserRole } from '../src/core/domain/user.enums';
import { GoogleAccountEmailBackfillService } from '../src/modules/authentication/application/services/google-account-email-backfill.service';
import { MongooseGoogleAccountEmailMaintenanceAdapter } from '../src/modules/authentication/infrastructure/adapters/mongoose-google-account-email-maintenance.adapter';

describe('Google OAuth account persistence integration', () => {
  let connection: Connection;
  let users: mongoose.Model<any>;
  let identities: mongoose.Model<any>;
  let events: mongoose.Model<any>;
  let dbName: string;

  beforeAll(async () => {
    const uri = process.env.TEST_MONGODB_URI ??
      'mongodb://127.0.0.1:27018/admin?replicaSet=rs0&directConnection=true';
    dbName = `healthcare_oauth_${randomBytes(4).toString('hex')}`;
    connection = mongoose.createConnection(uri, {
      dbName,
      serverSelectionTimeoutMS: 5_000,
    });
    await connection.asPromise();
    users = connection.model(User.name, UserSchema);
    identities = connection.model(OAuthIdentity.name, OAuthIdentitySchema);
    events = connection.model(AuthEvent.name, AuthEventSchema);
    connection.model(AuthSession.name, AuthSessionSchema);
    await Promise.all([users.init(), identities.init()]);
  });

  afterAll(async () => {
    if (/^healthcare_oauth_[a-f0-9]{8}$/.test(dbName))
      await connection.dropDatabase();
    await connection.close();
  });

  function createRepository() {
    return new MongooseGooglePatientAccountRepository(
      users as never,
      identities as never,
      connection,
    );
  }

  beforeEach(async () => {
    await connection.dropDatabase();
    await Promise.all([users.init(), identities.init()]);
  });

  function createBackfillService() {
    return new GoogleAccountEmailBackfillService(
      new MongooseGoogleAccountEmailMaintenanceAdapter(
        users as never,
        identities as never,
        events as never,
        connection,
      ),
    );
  }

  it('persists User and OAuthIdentity in one transaction and distinguishes verified email', async () => {
    const repository = createRepository();
    const created = await repository.createPatientAccount({
      provider: 'google',
      providerAccountId: 'synthetic-verified-subject',
      email: 'verified@example.test',
      emailVerified: true,
      fullName: 'Synthetic Patient',
    });
    expect(created).toMatchObject({
      kind: 'created',
      account: { email: 'verified@example.test', emailVerified: true },
    });
    expect((await users.findOne({ email: 'verified@example.test' }).lean())?.emailVerifiedAt)
      .toBeInstanceOf(Date);
    expect((await identities.findOne({ providerAccountId: 'synthetic-verified-subject' }).lean())?.providerEmailVerified)
      .toBe(true);
    expect(await users.countDocuments()).toBe(1);
    expect(await identities.countDocuments()).toBe(1);

    const unverified = await repository.createPatientAccount({
      provider: 'google',
      providerAccountId: 'synthetic-unverified-subject',
      email: 'unverified@example.test',
      emailVerified: false,
      fullName: 'Synthetic Patient',
    });
    expect(unverified).toMatchObject({
      kind: 'created',
      account: { email: 'unverified@example.test', emailVerified: false },
    });
    expect((await users.findOne({ email: 'unverified@example.test' }).lean())?.emailVerifiedAt)
      .toBeNull();
    expect((await identities.findOne({ providerAccountId: 'synthetic-unverified-subject' }).lean())?.providerEmailVerified)
      .toBe(false);
  });

  it('rolls back User creation if OAuthIdentity persistence fails', async () => {
    const repository = createRepository();
    const createIdentity = jest
      .spyOn(identities, 'create')
      .mockRejectedValueOnce(new Error('synthetic identity write failure'));
    await expect(
      repository.createPatientAccount({
        provider: 'google',
        providerAccountId: 'synthetic-rollback-subject',
        email: 'rollback@example.test',
        emailVerified: true,
        fullName: 'Synthetic Patient',
      }),
    ).rejects.toThrow('synthetic identity write failure');
    createIdentity.mockRestore();
    expect(await users.countDocuments()).toBe(0);
    expect(await identities.countDocuments()).toBe(0);
  });

  it('does not mark an absent email as verified even if a malformed principal claims it', async () => {
    const result = await createRepository().createPatientAccount({
      provider: 'google',
      providerAccountId: 'synthetic-no-email-subject',
      emailVerified: true,
      fullName: 'Synthetic Patient',
    });
    expect(result).toMatchObject({ kind: 'created', account: { emailVerified: false } });
    const identity = await identities.findOne({ providerAccountId: 'synthetic-no-email-subject' }).lean();
    expect(identity.providerEmailVerified).toBe(false);
    const user = await users.findById(identity.userId).lean();
    expect(user.emailVerifiedAt).toBeNull();
  });

  it('enforces provider-subject uniqueness under concurrent signup without orphan accounts', async () => {
    const repository = createRepository();
    const input = {
      provider: 'google',
      providerAccountId: 'synthetic-concurrent-subject',
      email: 'concurrent@example.test',
      emailVerified: true,
    } as const;
    const results = await Promise.allSettled([
      repository.createPatientAccount({ ...input, fullName: 'Synthetic Patient' }),
      repository.createPatientAccount({ ...input, fullName: 'Synthetic Patient' }),
    ]);
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    expect(await users.countDocuments()).toBe(1);
    expect(await identities.countDocuments()).toBe(1);
  });

  it('distinguishes case-insensitive local and Google email collisions without creating another account', async () => {
    const repository = createRepository();
    const [local] = await users.create([
      {
        fullName: 'Synthetic local patient',
        email: 'Local@Example.test',
        passwordHash: 'synthetic-password-hash',
        role: UserRole.PATIENT,
        accountStatus: 'active',
      },
    ]);
    const localCollision = await repository.findEmailOwner('local@example.test');
    expect(localCollision).toBe('password_account');
    expect(await users.countDocuments()).toBe(1);

    await users.deleteOne({ _id: local._id });
    const [oauthUser] = await users.create([
      {
        fullName: 'Synthetic Google patient',
        email: 'google@example.test',
        role: UserRole.PATIENT,
        accountStatus: 'active',
      },
    ]);
    await identities.create({
      provider: 'google',
      providerAccountId: 'existing-google-subject',
      providerEmail: 'google@example.test',
      providerEmailVerified: true,
      userId: oauthUser._id,
    });

    expect(await repository.findEmailOwner('GOOGLE@example.test')).toBe('google_account');
    const conflict = await repository.createPatientAccount({
      provider: 'google',
      providerAccountId: 'different-google-subject',
      email: 'google@example.test',
      emailVerified: true,
      fullName: 'Different Google Patient',
    });
    expect(conflict).toEqual({ kind: 'google_account' });
    expect(await users.countDocuments()).toBe(1);
    expect(await identities.countDocuments()).toBe(1);
  });

  it('backfills a legacy OAuth email in a transaction without marking it verified', async () => {
    const [user] = await users.create([
      { fullName: 'Synthetic legacy user', role: UserRole.PATIENT, accountStatus: 'active' },
    ]);
    await identities.create({
      provider: 'google',
      providerAccountId: 'synthetic-backfill-subject',
      providerEmail: ' Historic@Example.test ',
      providerEmailVerified: false,
      userId: user._id,
    });
    const service = createBackfillService();

    const dryRun = await service.execute({ apply: false, limit: 10 });
    expect(dryRun).toMatchObject({ mode: 'dry-run', eligible: 1, applied: 0 });
    expect(JSON.stringify(dryRun)).not.toContain('historic@example.test');
    expect((await users.findById(user._id).lean()).email).toBeUndefined();

    const applied = await service.execute({ apply: true, limit: 10 });
    const updated = await users.findById(user._id).lean();
    expect(applied.applied).toBe(1);
    expect(updated.email).toBe('historic@example.test');
    expect(updated.emailVerifiedAt).toBeNull();
    expect(await events.countDocuments({ userId: user._id })).toBe(1);
  });

  it('detects normalized case-insensitive collisions before backfill', async () => {
    const [candidate] = await users.create([
      { fullName: 'Synthetic candidate', role: UserRole.PATIENT, accountStatus: 'active' },
    ]);
    const ownerId = new mongoose.Types.ObjectId();
    await users.collection.insertOne({
      _id: ownerId,
      fullName: 'Synthetic existing owner',
      email: 'HISTORIC@example.test',
      role: UserRole.PATIENT,
      accountStatus: 'active',
    });
    await identities.create({
      provider: 'google',
      providerAccountId: 'synthetic-collision-subject',
      providerEmail: 'historic@example.test',
      providerEmailVerified: false,
      userId: candidate._id,
    });
    const service = createBackfillService();
    const result = await service.execute({ apply: true, limit: 10 });
    expect(result.collision).toBe(1);
    expect((await users.findById(candidate._id).lean()).email).toBeUndefined();
    expect((await users.findById(ownerId).lean()).email).toBe('HISTORIC@example.test');
  });
});
