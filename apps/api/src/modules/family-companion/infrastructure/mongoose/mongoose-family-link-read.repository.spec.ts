import { Types } from 'mongoose';
import { FamilyLinkSchema } from './family-link.schema';
import { MongooseFamilyLinkReadRepository } from './mongoose-family-link-read.repository';

function createMockLinkModel(docs: unknown[] = [], single: unknown = null) {
  const findChain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(docs),
  };
  const findOneChain = {
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(single),
  };
  const model = {
    find: jest
      .fn<typeof findChain, [Record<string, unknown>]>()
      .mockReturnValue(findChain),
    countDocuments: jest
      .fn<Promise<number>, [Record<string, unknown>]>()
      .mockResolvedValue(docs.length),
    findOne: jest
      .fn<typeof findOneChain, [Record<string, unknown>]>()
      .mockReturnValue(findOneChain),
  };
  return { model, findChain, findOneChain };
}

function createMockUserModel(
  users: Array<{
    _id: Types.ObjectId;
    fullName: string;
    email?: string;
    avatarUrl?: string;
  }> = [],
) {
  const findChain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(users),
  };
  const model = {
    find: jest
      .fn<typeof findChain, [Record<string, unknown>]>()
      .mockReturnValue(findChain),
  };
  return { model, findChain };
}

describe('MongooseFamilyLinkReadRepository', () => {
  const userId = '6b084138ea1594fabbda9ec9';
  const companionId = '6a0fbcdff8eff67e3e0b0bea';
  const thirdUserId = '6a0fbcdff8eff67e3e0b0beb';
  const linkId = '6b08414fea1594fabbda9f03';
  const secondLinkId = '6b0841bfea1594fabbda9fa6';

  it('compiles FamilyLinkSchema ObjectId reference paths as ObjectId instead of Mixed', () => {
    expect(FamilyLinkSchema.path('patientId')?.instance).toBe('ObjectId');
    expect(FamilyLinkSchema.path('familyUserId')?.instance).toBe('ObjectId');
    expect(FamilyLinkSchema.path('pendingRedeemerUserId')?.instance).toBe(
      'ObjectId',
    );
  });

  it('queries sent links with ObjectId, batch-loads accepted counterparties, and never leaks pendingRedeemerUserId', async () => {
    const activeSentDoc = {
      _id: new Types.ObjectId(linkId),
      patientId: new Types.ObjectId(userId),
      familyUserId: new Types.ObjectId(companionId),
      relationship: 'parent',
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'shared_link',
      invitedAt: new Date('2026-11-26T14:00:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:00:00Z'),
      permissions: ['missed_task_reminder'],
    };
    const pendingShareDoc = {
      _id: new Types.ObjectId(secondLinkId),
      patientId: new Types.ObjectId(userId),
      pendingRedeemerUserId: new Types.ObjectId(thirdUserId),
      relationship: 'sibling',
      status: 'pending',
      invitationVersion: 1,
      invitationDelivery: 'shared_link',
      invitedAt: new Date('2026-11-26T14:05:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:05:00Z'),
      permissions: [],
    };
    const { model: linkModel } = createMockLinkModel([
      activeSentDoc,
      pendingShareDoc,
    ]);
    const { model: userModel, findChain: userChain } = createMockUserModel([
      {
        _id: new Types.ObjectId(companionId),
        fullName: 'Nguyen Van B',
        email: 'companion@example.com',
        avatarUrl: 'https://cdn.example.com/b.png',
      },
      {
        _id: new Types.ObjectId(thirdUserId),
        fullName: 'Should Not Leak',
        email: 'leak@example.com',
      },
    ]);
    const repo = new MongooseFamilyLinkReadRepository(
      linkModel as never,
      userModel as never,
    );

    const page = await repo.findParticipantPage({
      userId,
      direction: 'sent',
      status: 'active',
      page: 1,
      limit: 50,
    });

    expect(page.total).toBe(2);
    expect(page.items[0]?.id).toBe(linkId);
    expect(page.items[0]?.counterparty).toEqual({
      fullName: 'Nguyen Van B',
      email: 'companion@example.com',
      avatarUrl: 'https://cdn.example.com/b.png',
    });
    expect(page.items[1]?.counterparty).toBeNull();

    const filter = linkModel.find.mock.calls[0][0] as {
      patientId: Types.ObjectId;
      status: string;
    };
    expect(filter.patientId).toBeInstanceOf(Types.ObjectId);
    expect(filter.patientId.toHexString()).toBe(userId);
    expect(filter.status).toBe('active');
    expect(linkModel.countDocuments).toHaveBeenCalledWith(filter);

    expect(userModel.find).toHaveBeenCalledTimes(1);
    const userFilter = userModel.find.mock.calls[0][0] as {
      _id: { $in: Types.ObjectId[] };
    };
    expect(userFilter._id.$in.map((id) => id.toHexString())).toEqual([
      companionId,
    ]);
    expect(userChain.select).toHaveBeenCalledWith(
      '_id fullName email avatarUrl',
    );
  });

  it('queries received links including pendingRedeemerUserId and batch-loads inviter counterparty', async () => {
    const redeemedPendingDoc = {
      _id: new Types.ObjectId(linkId),
      patientId: new Types.ObjectId(companionId),
      pendingRedeemerUserId: new Types.ObjectId(userId),
      relationship: 'child',
      status: 'pending',
      invitationVersion: 1,
      invitationDelivery: 'shared_link',
      invitedAt: new Date('2026-11-26T14:00:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:00:00Z'),
      permissions: [],
    };
    const { model: linkModel } = createMockLinkModel([redeemedPendingDoc]);
    const { model: userModel } = createMockUserModel([
      {
        _id: new Types.ObjectId(companionId),
        fullName: 'Inviter Patient',
        email: 'inviter@example.com',
      },
    ]);
    const repo = new MongooseFamilyLinkReadRepository(
      linkModel as never,
      userModel as never,
    );

    const page = await repo.findParticipantPage({
      userId,
      direction: 'received',
      page: 1,
      limit: 20,
    });

    expect(page.items[0]?.counterparty).toEqual({
      fullName: 'Inviter Patient',
      email: 'inviter@example.com',
    });
    const filter = linkModel.find.mock.calls[0][0] as {
      $or: Array<{
        familyUserId?: unknown;
        status?: string;
        pendingRedeemerUserId?: Types.ObjectId;
      }>;
    };
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0]?.familyUserId).toBeInstanceOf(Types.ObjectId);
    expect((filter.$or[0]?.familyUserId as Types.ObjectId).toHexString()).toBe(
      userId,
    );
    expect(filter.$or[1]?.status).toBe('pending');
    expect(filter.$or[1]?.pendingRedeemerUserId).toBeInstanceOf(Types.ObjectId);
    expect(filter.$or[1]?.pendingRedeemerUserId?.toHexString()).toBe(userId);
  });

  it('queries all participant links and batch-loads mixed counterparties in a single User query', async () => {
    const sentDoc = {
      _id: new Types.ObjectId(linkId),
      patientId: new Types.ObjectId(userId),
      familyUserId: new Types.ObjectId(companionId),
      relationship: 'parent',
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'shared_link',
      invitedAt: new Date('2026-11-26T14:00:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:00:00Z'),
      permissions: [],
    };
    const receivedDoc = {
      _id: new Types.ObjectId(secondLinkId),
      patientId: new Types.ObjectId(thirdUserId),
      familyUserId: new Types.ObjectId(userId),
      relationship: 'sibling',
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'selected_contact',
      invitedAt: new Date('2026-11-26T14:05:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:05:00Z'),
      permissions: [],
    };
    const { model: linkModel } = createMockLinkModel([sentDoc, receivedDoc]);
    const { model: userModel } = createMockUserModel([
      {
        _id: new Types.ObjectId(companionId),
        fullName: 'Sent Companion',
        email: 'sent@example.com',
      },
      {
        _id: new Types.ObjectId(thirdUserId),
        fullName: 'Received Inviter',
        email: 'received@example.com',
      },
    ]);
    const repo = new MongooseFamilyLinkReadRepository(
      linkModel as never,
      userModel as never,
    );

    const page = await repo.findParticipantPage({
      userId,
      direction: 'all',
      page: 1,
      limit: 20,
    });

    expect(userModel.find).toHaveBeenCalledTimes(1);
    expect(page.items[0]?.counterparty?.fullName).toBe('Sent Companion');
    expect(page.items[1]?.counterparty?.fullName).toBe('Received Inviter');

    const filter = linkModel.find.mock.calls[0][0] as {
      $or: Array<{
        patientId?: Types.ObjectId;
        familyUserId?: unknown;
        pendingRedeemerUserId?: Types.ObjectId;
      }>;
    };
    expect(filter.$or).toHaveLength(3);
    expect(filter.$or[0]?.patientId).toBeInstanceOf(Types.ObjectId);
    expect(filter.$or[1]?.familyUserId).toBeInstanceOf(Types.ObjectId);
    expect(filter.$or[2]?.pendingRedeemerUserId).toBeInstanceOf(Types.ObjectId);
  });

  it('returns empty page without querying DB when userId is not a valid ObjectId', async () => {
    const { model: linkModel } = createMockLinkModel([]);
    const { model: userModel } = createMockUserModel([]);
    const repo = new MongooseFamilyLinkReadRepository(
      linkModel as never,
      userModel as never,
    );

    const page = await repo.findParticipantPage({
      userId: 'invalid-user-id',
      direction: 'sent',
      page: 1,
      limit: 20,
    });

    expect(page).toEqual({ items: [], total: 0 });
    expect(linkModel.find).not.toHaveBeenCalled();
    expect(linkModel.countDocuments).not.toHaveBeenCalled();
    expect(userModel.find).not.toHaveBeenCalled();
  });

  it('queries participant link by ObjectId, includes pendingRedeemerUserId, resolves counterparty, and guards invalid IDs', async () => {
    const sampleDoc = {
      _id: new Types.ObjectId(linkId),
      patientId: new Types.ObjectId(companionId),
      pendingRedeemerUserId: new Types.ObjectId(userId),
      relationship: 'sibling',
      status: 'pending',
      invitationVersion: 1,
      invitationDelivery: 'shared_link',
      invitedAt: new Date('2026-11-26T14:00:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:00:00Z'),
      permissions: [],
    };
    const { model: linkModel } = createMockLinkModel([], sampleDoc);
    const { model: userModel } = createMockUserModel([
      {
        _id: new Types.ObjectId(companionId),
        fullName: 'Owner Patient',
        email: 'owner@example.com',
      },
    ]);
    const repo = new MongooseFamilyLinkReadRepository(
      linkModel as never,
      userModel as never,
    );

    const result = await repo.findParticipantLink(userId, linkId);
    expect(result?.id).toBe(linkId);
    expect(result?.counterparty).toEqual({
      fullName: 'Owner Patient',
      email: 'owner@example.com',
    });
    const filter = linkModel.findOne.mock.calls[0][0] as {
      _id: Types.ObjectId;
      $or: Array<{
        patientId?: Types.ObjectId;
        familyUserId?: unknown;
        pendingRedeemerUserId?: Types.ObjectId;
      }>;
    };
    expect(filter._id).toBeInstanceOf(Types.ObjectId);
    expect(filter._id.toHexString()).toBe(linkId);
    expect(filter.$or).toHaveLength(3);
    expect(filter.$or[0]?.patientId?.toHexString()).toBe(userId);
    expect((filter.$or[1]?.familyUserId as Types.ObjectId).toHexString()).toBe(
      userId,
    );
    expect(filter.$or[2]?.pendingRedeemerUserId?.toHexString()).toBe(userId);

    const invalidUserResult = await repo.findParticipantLink('bad-id', linkId);
    const invalidLinkResult = await repo.findParticipantLink(userId, 'bad-id');
    expect(invalidUserResult).toBeNull();
    expect(invalidLinkResult).toBeNull();
    expect(linkModel.findOne).toHaveBeenCalledTimes(1);
  });

  it('batch-loads patient and companion profiles for admin audit page', async () => {
    const activeDoc = {
      _id: new Types.ObjectId(linkId),
      patientId: new Types.ObjectId(userId),
      familyUserId: new Types.ObjectId(companionId),
      relationship: 'parent',
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'selected_contact',
      invitedAt: new Date('2026-11-26T14:00:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:00:00Z'),
      permissions: ['missed_task_reminder'],
    };
    const pendingShareDoc = {
      _id: new Types.ObjectId(secondLinkId),
      patientId: new Types.ObjectId(userId),
      relationship: 'sibling',
      status: 'pending',
      invitationVersion: 1,
      invitationDelivery: 'shared_link',
      invitedAt: new Date('2026-11-26T14:05:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:05:00Z'),
      permissions: [],
    };
    const { model: linkModel } = createMockLinkModel([
      activeDoc,
      pendingShareDoc,
    ]);
    const { model: userModel } = createMockUserModel([
      {
        _id: new Types.ObjectId(userId),
        fullName: 'Patient One',
        email: 'patient1@example.com',
      },
      {
        _id: new Types.ObjectId(companionId),
        fullName: 'Companion Two',
        email: 'companion2@example.com',
      },
    ]);
    const repo = new MongooseFamilyLinkReadRepository(
      linkModel as never,
      userModel as never,
    );

    const page = await repo.findAdminPage({ page: 1, limit: 20 });

    expect(userModel.find).toHaveBeenCalledTimes(1);
    expect(page.items[0]?.patient).toEqual({
      fullName: 'Patient One',
      email: 'patient1@example.com',
    });
    expect(page.items[0]?.companion).toEqual({
      fullName: 'Companion Two',
      email: 'companion2@example.com',
    });
    expect(page.items[1]?.patient).toEqual({
      fullName: 'Patient One',
      email: 'patient1@example.com',
    });
    expect(page.items[1]?.companion).toBeNull();
  });
});
