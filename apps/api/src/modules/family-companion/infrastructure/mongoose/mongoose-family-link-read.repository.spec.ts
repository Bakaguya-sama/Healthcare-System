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
    find: jest.fn().mockReturnValue(findChain),
    countDocuments: jest.fn().mockResolvedValue(docs.length),
    findOne: jest.fn().mockReturnValue(findOneChain),
  };
  return { model, findChain, findOneChain };
}

describe('MongooseFamilyLinkReadRepository', () => {
  const userId = '6b084138ea1594fabbda9ec9';
  const linkId = '6b08414fea1594fabbda9f03';

  it('compiles FamilyLinkSchema ObjectId reference paths as ObjectId instead of Mixed', () => {
    expect(FamilyLinkSchema.path('patientId')?.instance).toBe('ObjectId');
    expect(FamilyLinkSchema.path('familyUserId')?.instance).toBe('ObjectId');
    expect(FamilyLinkSchema.path('pendingRedeemerUserId')?.instance).toBe(
      'ObjectId',
    );
  });

  it('queries sent links using Types.ObjectId for patientId', async () => {
    const sampleDoc = {
      _id: new Types.ObjectId(linkId),
      patientId: new Types.ObjectId(userId),
      relationship: 'parent',
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'shared_link',
      invitedAt: new Date('2026-11-26T14:00:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:00:00Z'),
      permissions: ['missed_task_reminder'],
    };
    const { model } = createMockLinkModel([sampleDoc]);
    const repo = new MongooseFamilyLinkReadRepository(model as never);

    const page = await repo.findParticipantPage({
      userId,
      direction: 'sent',
      status: 'active',
      page: 1,
      limit: 50,
    });

    expect(page.total).toBe(1);
    expect(page.items[0]?.id).toBe(linkId);
    expect(model.find).toHaveBeenCalledTimes(1);
    const filter = model.find.mock.calls[0][0] as {
      patientId: Types.ObjectId;
      status: string;
    };
    expect(filter.patientId).toBeInstanceOf(Types.ObjectId);
    expect(filter.patientId.toHexString()).toBe(userId);
    expect(filter.status).toBe('active');
    expect(model.countDocuments).toHaveBeenCalledWith(filter);
  });

  it('queries received links using Types.ObjectId for familyUserId', async () => {
    const { model } = createMockLinkModel([]);
    const repo = new MongooseFamilyLinkReadRepository(model as never);

    await repo.findParticipantPage({
      userId,
      direction: 'received',
      page: 1,
      limit: 20,
    });

    const filter = model.find.mock.calls[0][0] as {
      familyUserId: Types.ObjectId;
    };
    expect(filter.familyUserId).toBeInstanceOf(Types.ObjectId);
    expect(filter.familyUserId.toHexString()).toBe(userId);
  });

  it('queries all participant links using Types.ObjectId in $or filter', async () => {
    const { model } = createMockLinkModel([]);
    const repo = new MongooseFamilyLinkReadRepository(model as never);

    await repo.findParticipantPage({
      userId,
      direction: 'all',
      page: 1,
      limit: 20,
    });

    const filter = model.find.mock.calls[0][0] as {
      $or: Array<{ patientId?: Types.ObjectId; familyUserId?: Types.ObjectId }>;
    };
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0]?.patientId).toBeInstanceOf(Types.ObjectId);
    expect(filter.$or[0]?.patientId?.toHexString()).toBe(userId);
    expect(filter.$or[1]?.familyUserId).toBeInstanceOf(Types.ObjectId);
    expect(filter.$or[1]?.familyUserId?.toHexString()).toBe(userId);
  });

  it('returns empty page without querying DB when userId is not a valid ObjectId', async () => {
    const { model } = createMockLinkModel([]);
    const repo = new MongooseFamilyLinkReadRepository(model as never);

    const page = await repo.findParticipantPage({
      userId: 'invalid-user-id',
      direction: 'sent',
      page: 1,
      limit: 20,
    });

    expect(page).toEqual({ items: [], total: 0 });
    expect(model.find).not.toHaveBeenCalled();
    expect(model.countDocuments).not.toHaveBeenCalled();
  });

  it('queries participant link by Types.ObjectId and guards invalid IDs', async () => {
    const sampleDoc = {
      _id: new Types.ObjectId(linkId),
      patientId: new Types.ObjectId(userId),
      relationship: 'sibling',
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'selected_contact',
      invitedAt: new Date('2026-11-26T14:00:00Z'),
      invitationExpiresAt: new Date('2026-11-27T14:00:00Z'),
      permissions: [],
    };
    const { model } = createMockLinkModel([], sampleDoc);
    const repo = new MongooseFamilyLinkReadRepository(model as never);

    const result = await repo.findParticipantLink(userId, linkId);
    expect(result?.id).toBe(linkId);
    const filter = model.findOne.mock.calls[0][0] as {
      _id: Types.ObjectId;
      $or: Array<{ patientId?: Types.ObjectId; familyUserId?: Types.ObjectId }>;
    };
    expect(filter._id).toBeInstanceOf(Types.ObjectId);
    expect(filter._id.toHexString()).toBe(linkId);
    expect(filter.$or[0]?.patientId).toBeInstanceOf(Types.ObjectId);
    expect(filter.$or[0]?.patientId?.toHexString()).toBe(userId);
    expect(filter.$or[1]?.familyUserId).toBeInstanceOf(Types.ObjectId);
    expect(filter.$or[1]?.familyUserId?.toHexString()).toBe(userId);

    const invalidUserResult = await repo.findParticipantLink('bad-id', linkId);
    const invalidLinkResult = await repo.findParticipantLink(userId, 'bad-id');
    expect(invalidUserResult).toBeNull();
    expect(invalidLinkResult).toBeNull();
    expect(model.findOne).toHaveBeenCalledTimes(1);
  });
});

