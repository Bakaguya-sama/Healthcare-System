import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createConnection, type Connection, type Model } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { verifyDatabase } from '../src/database/verify-database';
import {
  MedicalFacility,
  MedicalFacilityRevision,
  MedicalFacilityRevisionSchema,
  MedicalFacilitySchema,
  type MedicalFacilityDocument,
  type MedicalFacilityRevisionDocument,
} from '../src/modules/care-directory/infrastructure/mongoose/medical-facility.schema';
import {
  MedicalSpecialty,
  MedicalSpecialtySchema,
  type MedicalSpecialtyDocument,
} from '../src/modules/care-directory/infrastructure/mongoose/medical-specialty.schema';
import {
  DiseaseSpecialtyMapping,
  DiseaseSpecialtyMappingSchema,
  type DiseaseSpecialtyMappingDocument,
} from '../src/modules/care-directory/infrastructure/mongoose/disease-specialty-mapping.schema';
import {
  FacilityCommandReceipt,
  FacilityCommandReceiptSchema,
  type FacilityCommandReceiptDocument,
} from '../src/modules/care-directory/infrastructure/mongoose/facility-command-receipt.schema';
import {
  FacilityDuplicateGuard,
  FacilityDuplicateGuardSchema,
  type FacilityDuplicateGuardDocument,
} from '../src/modules/care-directory/infrastructure/mongoose/facility-duplicate-review.schema';
import { FacilityCommandTransaction } from '../src/modules/care-directory/infrastructure/mongoose/facility-command-transaction';
import { MongooseMedicalFacilityRepository } from '../src/modules/care-directory/infrastructure/mongoose/mongoose-medical-facility.repository';
import { MongooseCareDirectoryQueryRepository } from '../src/modules/care-directory/infrastructure/mongoose/mongoose-care-directory-query.repository';
import { MongooseDiseaseSpecialtyMappingRepository } from '../src/modules/care-directory/infrastructure/mongoose/mongoose-disease-specialty-mapping.repository';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/public-api';
import { Types } from 'mongoose';
import type { FacilityDetails } from '../src/modules/care-directory/domain/care-directory.types';
import { normalizeFacilityName } from '../src/modules/care-directory/domain/care-directory.types';
import { ManageMedicalFacilities } from '../src/modules/care-directory/application/use-cases/manage-medical-facilities.use-case';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  User,
  UserSchema,
  type UserDocument,
} from '../src/modules/users/public-api';
import { JwtStrategy } from '../src/modules/authentication/infrastructure/strategies/jwt.strategy';
import { MongooseFacilityAdminAuthorityAdapter } from '../src/modules/care-directory/infrastructure/adapters/mongoose-facility-admin-authority.adapter';
import { GooglePlacesAdapter } from '../src/modules/care-directory/infrastructure/adapters/google-places.adapter';
import { AdminMedicalFacilitiesController } from '../src/modules/care-directory/presentation/controllers/admin-medical-facilities.controller';
import { SearchMapFacilityCandidates } from '../src/modules/care-directory/application/use-cases/search-map-facility-candidates.use-case';

jest.setTimeout(120_000);

function fetchRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function parseFetchRequestBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string')
    throw new Error('Expected a JSON request body in the Places adapter test.');
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('Medical Facility Directory MongoDB integration', () => {
  let connection: Connection;
  let testUri: string;
  let command: FacilityCommandTransaction;
  let facilityRepository: MongooseMedicalFacilityRepository;
  let queryRepository: MongooseCareDirectoryQueryRepository;
  let specialtyModel: Model<MedicalSpecialtyDocument>;
  let facilityModel: Model<MedicalFacilityDocument>;
  let mappingRepository: MongooseDiseaseSpecialtyMappingRepository;
  let duplicateGuardModel: Model<FacilityDuplicateGuardDocument>;
  const actorId = new Types.ObjectId();
  const auditCollectionName = 'auditlogs';

  beforeAll(async () => {
    const baseUri = new URL(
      process.env.TEST_MONGODB_URI ??
        'mongodb://127.0.0.1:27018/healthcare_e3_test?replicaSet=rs0&directConnection=true',
    );
    const databaseName = `e3_${randomUUID().replaceAll('-', '')}`;
    baseUri.pathname = `/${databaseName}`;
    testUri = baseUri.toString();
    const client = new MongoClient(testUri);
    try {
      await client.connect();
      const migration = await migrateDatabase(client.db());
      expect(migration.applied).toContain(
        '202611251100-e3-medical-facility-directory',
      );
      expect(migration.applied).toContain(
        '202611271000-e3-facility-duplicate-review',
      );
      const noOp = await migrateDatabase(client.db());
      expect(noOp.skipped).toContain(
        '202611251100-e3-medical-facility-directory',
      );
      expect(noOp.skipped).toContain(
        '202611271000-e3-facility-duplicate-review',
      );
      const verification = await verifyDatabase(client.db());
      expect(verification.currentVersion).toBeGreaterThanOrEqual(202611271000);
      expect(
        await client
          .db(databaseName)
          .listCollections(
            { name: 'facilityduplicatedecisions' },
            { nameOnly: true },
          )
          .hasNext(),
      ).toBe(false);
    } catch (error) {
      if (/^e3_[a-f0-9]{32}$/.test(databaseName))
        await client
          .db(databaseName)
          .dropDatabase()
          .catch(() => undefined);
      throw error;
    } finally {
      await client.close();
    }

    connection = await createConnection(testUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    const receiptModel = connection.model<FacilityCommandReceiptDocument>(
      FacilityCommandReceipt.name,
      FacilityCommandReceiptSchema,
    );
    const auditModel = connection.model(AuditLog.name, AuditLogSchema);
    specialtyModel = connection.model<MedicalSpecialtyDocument>(
      MedicalSpecialty.name,
      MedicalSpecialtySchema,
    );
    const mappingModel = connection.model<DiseaseSpecialtyMappingDocument>(
      DiseaseSpecialtyMapping.name,
      DiseaseSpecialtyMappingSchema,
    );
    facilityModel = connection.model<MedicalFacilityDocument>(
      MedicalFacility.name,
      MedicalFacilitySchema,
    );
    const revisionModel = connection.model<MedicalFacilityRevisionDocument>(
      MedicalFacilityRevision.name,
      MedicalFacilityRevisionSchema,
    );
    duplicateGuardModel = connection.model<FacilityDuplicateGuardDocument>(
      FacilityDuplicateGuard.name,
      FacilityDuplicateGuardSchema,
    );
    command = new FacilityCommandTransaction(
      receiptModel,
      auditModel,
      connection,
    );
    facilityRepository = new MongooseMedicalFacilityRepository(
      facilityModel,
      revisionModel,
      specialtyModel,
      duplicateGuardModel,
      command,
    );
    mappingRepository = new MongooseDiseaseSpecialtyMappingRepository(
      mappingModel,
      specialtyModel,
      command,
    );
    queryRepository = new MongooseCareDirectoryQueryRepository(
      specialtyModel,
      mappingModel,
      facilityModel,
    );
    await specialtyModel.create({
      code: 'cardiology',
      nameVi: 'Tim mạch',
      synonyms: [],
      status: 'active',
      revision: 1,
      createdBy: actorId,
    });
  });

  afterAll(async () => {
    await connection?.close();
    if (!testUri) return;
    const databaseName = new URL(testUri).pathname.slice(1);
    if (!/^e3_[a-f0-9]{32}$/.test(databaseName)) return;
    const client = new MongoClient(testUri);
    await client.connect();
    await client.db(databaseName).dropDatabase();
    await client.close();
  });

  const details = (
    name: string,
    longitude: number,
    district = 'Quận 1',
  ): FacilityDetails => ({
    name,
    normalizedName: normalizeFacilityName(name),
    facilityType: 'clinic' as const,
    address: {
      district,
      province: 'Thành phố Hồ Chí Minh',
      provinceCode: 'HCMC' as const,
      country: 'VN' as const,
    },
    location: {
      type: 'Point' as const,
      coordinates: [longitude, 10.77] as [number, number],
    },
    specialtyCodes: ['cardiology'],
    contact: { phone: '0000000000', website: 'https://example.org' },
    officialSourceUrl: 'https://example.org/official-source',
  });
  const placePreview = (placeId: string) => ({
    placeId,
    name: 'Synthetic unrelated branch',
    address: 'Synthetic address, District 10',
    location: { longitude: 106.67, latitude: 10.77 },
    attribution: 'Google Maps' as const,
  });

  it('keeps one idempotent draft and audit when the command is replayed', async () => {
    await connection.collection(auditCollectionName).deleteMany({});
    const input = {
      details: details('Synthetic Clinic', 106.7),
      actorId: actorId.toHexString(),
      key: 'e3-idempotency-key-0001',
    };
    const first = await facilityRepository.createFacilityDraft(input);
    const replay = await facilityRepository.createFacilityDraft(input);
    expect(replay).toEqual(first);
    await expect(
      facilityRepository.createFacilityDraft({
        ...input,
        details: { ...input.details, name: 'Different payload' },
      }),
    ).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    expect(
      await connection.collection('medicalfacilities').countDocuments({}),
    ).toBe(1);
    expect(
      await connection
        .collection(auditCollectionName)
        .countDocuments({ action: 'facility_draft_created' }),
    ).toBe(1);
  });

  it('uses Place Details only as a response preview and replays without Google', async () => {
    const findPlace = jest
      .fn()
      .mockResolvedValueOnce({
        placeId: 'synthetic-place-123',
        name: 'Synthetic Clinic',
        address: 'Synthetic address',
        location: { longitude: 106.7, latitude: 10.7 },
        attribution: 'Google Maps',
      })
      .mockRejectedValue(new Error('provider unavailable'));
    const useCase = new ManageMedicalFacilities(
      facilityRepository,
      queryRepository,
      { isSuperAdmin: async () => true },
      { findPlace } as never,
      { get: () => true } as never,
    );
    const key = 'e3-map-replay-test-key-001';
    const first = await useCase.createDraftFromMapCandidate(
      actorId.toHexString(),
      key,
      'synthetic-place-123',
    );
    const replay = await useCase.createDraftFromMapCandidate(
      actorId.toHexString(),
      key,
      'synthetic-place-123',
    );
    expect(first.data).toMatchObject({
      status: 'draft',
      googlePlaceId: 'synthetic-place-123',
      providerPreview: {
        name: 'Synthetic Clinic',
        address: 'Synthetic address',
        source: 'google_maps',
        verifiedInternally: false,
      },
    });
    expect(replay.data).toMatchObject({ id: first.data!.id, status: 'draft' });
    expect(replay.data).not.toHaveProperty('providerPreview');
    expect(findPlace).toHaveBeenCalledTimes(1);
    await expect(
      useCase.createDraftFromMapCandidate(
        actorId.toHexString(),
        key,
        'synthetic-place-other',
      ),
    ).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    expect(findPlace).toHaveBeenCalledTimes(1);
    expect(
      await connection
        .collection('medicalfacilities')
        .countDocuments({ googlePlaceId: 'synthetic-place-123' }),
    ).toBe(1);
    expect(
      await connection.collection(auditCollectionName).countDocuments({
        entityId: new Types.ObjectId(first.data!.id),
        action: 'facility_draft_created_from_map_candidate',
      }),
    ).toBe(1);
    const facility = await connection
      .collection('medicalfacilities')
      .findOne({ _id: new Types.ObjectId(first.data!.id) });
    const receipt = await connection
      .collection('facilitycommandreceipts')
      .findOne({ operation: 'facility.create-draft-from-map' });
    expect(facility).not.toHaveProperty('name');
    expect(facility).not.toHaveProperty('address');
    expect(receipt?.result).not.toHaveProperty('providerPreview');
    expect(receipt?.result).not.toHaveProperty('name');
    expect(facility).not.toHaveProperty('location');
    expect(receipt?.result).not.toHaveProperty('location');
  });

  it('does not create a receipt on provider failure and permits a later retry', async () => {
    const findPlace = jest
      .fn()
      .mockRejectedValueOnce(new Error('synthetic outage'))
      .mockResolvedValueOnce({ placeId: 'synthetic-recovery-place' });
    const useCase = new ManageMedicalFacilities(
      facilityRepository,
      queryRepository,
      { isSuperAdmin: async () => true },
      { findPlace } as never,
      { get: () => true } as never,
    );
    const key = 'e3-map-recovery-test-key-001';
    await expect(
      useCase.createDraftFromMapCandidate(
        actorId.toHexString(),
        key,
        'synthetic-recovery-place',
      ),
    ).rejects.toThrow('MAP_PROVIDER_UNAVAILABLE');
    const result = await useCase.createDraftFromMapCandidate(
      actorId.toHexString(),
      key,
      'synthetic-recovery-place',
    );
    expect(result.data?.status).toBe('draft');
    expect(findPlace).toHaveBeenCalledTimes(2);
  });

  it('prevents a second Facility draft for an already selected Place ID', async () => {
    const placeId = 'synthetic-place-unique-0001';
    await facilityRepository.createFacilityDraftFromPlace({
      placeId,
      providerPreview: placePreview(placeId),
      actorId: actorId.toHexString(),
      key: 'e3-place-unique-first-0001',
    });

    await expect(
      facilityRepository.createFacilityDraftFromPlace({
        placeId,
        providerPreview: placePreview(placeId),
        actorId: actorId.toHexString(),
        key: 'e3-place-unique-second-01',
      }),
    ).rejects.toThrow('FACILITY_GOOGLE_PLACE_ALREADY_LINKED');
    expect(
      await connection
        .collection('medicalfacilities')
        .countDocuments({ googlePlaceId: placeId }),
    ).toBe(1);
  });

  it('requires a pair-specific decision on create and reuses it after Facility fields change', async () => {
    const first = await facilityRepository.createFacilityDraft({
      details: details('Phòng khám Minh An', 106.681, 'Quận 3'),
      actorId: actorId.toHexString(),
      key: 'e3-duplicate-first-create-0001',
    });
    await facilityRepository.verifyFacility({
      id: first.id,
      revisionId: first.draftRevisionId!,
      expectedRevision: first.revision,
      actorId: actorId.toHexString(),
      key: 'e3-duplicate-first-verify-001',
    });
    const secondDetails = details('Phòng khám Minh An', 106.6811, 'Quận 3');
    const secondCommand = {
      details: secondDetails,
      actorId: actorId.toHexString(),
      key: 'e3-duplicate-second-create-01',
    };
    await expect(
      facilityRepository.createFacilityDraft(secondCommand),
    ).rejects.toThrow('FACILITY_POSSIBLE_DUPLICATE');

    const second = await facilityRepository.createFacilityDraft({
      ...secondCommand,
      key: 'e3-duplicate-second-confirm-01',
      duplicateReview: {
        confirmedDistinct: true,
        reason: 'Hai cơ sở cùng tên nhưng ở hai địa chỉ riêng biệt.',
        reviewedFacilityIds: [first.id],
      },
    });
    expect(second.duplicateDecisions).toEqual([
      expect.objectContaining({
        candidateFacilityId: first.id,
        reviewedBy: actorId.toHexString(),
      }),
    ]);
    expect(
      (await facilityModel.findById(second.id).lean().exec())?.duplicateReviews,
    ).toHaveLength(1);
    expect(
      (
        await facilityModel.findById(second.id).lean().exec()
      )?.duplicateReviews?.[0]?.candidateFacilityId.toString(),
    ).toBe(first.id);

    const firstRevision = await facilityRepository.createFacilityRevision({
      id: first.id,
      actorId: actorId.toHexString(),
      key: 'e3-duplicate-first-revision-01',
    });
    const firstAfterRevision = await facilityRepository.getAdminFacility(
      first.id,
    );
    const editedFirst = await facilityRepository.updateFacilityDraft({
      id: first.id,
      revisionId: firstRevision.id,
      expectedRevision: firstAfterRevision!.revision,
      details: details('Phòng khám Minh An', 106.6812, 'Quận 3'),
      actorId: actorId.toHexString(),
      key: 'e3-duplicate-first-update-001',
    });
    await facilityRepository.verifyFacility({
      id: first.id,
      revisionId: firstRevision.id,
      expectedRevision: editedFirst.revision,
      actorId: actorId.toHexString(),
      key: 'e3-duplicate-first-reverify-01',
    });

    const verifiedSecond = await facilityRepository.verifyFacility({
      id: second.id,
      revisionId: second.draftRevisionId!,
      expectedRevision: second.revision,
      actorId: actorId.toHexString(),
      key: 'e3-duplicate-second-verify-01',
    });
    expect(verifiedSecond.status).toBe('verified');
    expect(
      (await facilityModel.findById(second.id).lean().exec())?.duplicateReviews,
    ).toHaveLength(1);
  });

  it('rejects a distinct decision for a Facility that is not a current candidate', async () => {
    const existing = await facilityRepository.createFacilityDraft({
      details: details('Phòng khám đối chiếu riêng biệt', 106.72, 'Quận 10'),
      actorId: actorId.toHexString(),
      key: 'e3-review-current-candidate-owner',
    });

    await expect(
      facilityRepository.createFacilityDraft({
        details: details('Trung tâm y tế hoàn toàn khác', 106.81, 'Quận 1'),
        actorId: actorId.toHexString(),
        key: 'e3-review-current-candidate-stale',
        duplicateReview: {
          confirmedDistinct: true,
          reason: 'Đã rà soát và xác nhận khác cơ sở.',
          reviewedFacilityIds: [existing.id],
        },
      }),
    ).rejects.toThrow('FACILITY_DUPLICATE_REVIEW_CANDIDATE_NOT_CURRENT');

    expect(
      await connection.collection('medicalfacilities').countDocuments({
        'duplicateReviews.candidateFacilityId': new Types.ObjectId(existing.id),
      }),
    ).toBe(0);
  });

  it('rechecks verification and accepts a decision for a newly surfaced candidate', async () => {
    const owner = await facilityRepository.createFacilityDraft({
      details: details('Phòng khám An Tâm', 106.695, 'Quận 5'),
      actorId: actorId.toHexString(),
      key: 'e3-verify-duplicate-owner-create',
    });
    const waiting = await facilityRepository.createFacilityDraft({
      details: { name: 'Completely different temporary record' },
      actorId: actorId.toHexString(),
      key: 'e3-verify-duplicate-waiting-create',
    });
    await facilityRepository.verifyFacility({
      id: owner.id,
      revisionId: owner.draftRevisionId!,
      expectedRevision: owner.revision,
      actorId: actorId.toHexString(),
      key: 'e3-verify-duplicate-owner-verify',
    });
    const updated = await facilityRepository.updateFacilityDraft({
      id: waiting.id,
      expectedRevision: waiting.revision,
      details: details('Phòng khám An Tâm', 106.6951, 'Quận 5'),
      actorId: actorId.toHexString(),
      key: 'e3-verify-duplicate-waiting-update',
    });
    const verifyInput = {
      id: waiting.id,
      revisionId: updated.draftRevisionId!,
      expectedRevision: updated.revision,
      actorId: actorId.toHexString(),
    };
    await expect(
      facilityRepository.verifyFacility({
        ...verifyInput,
        key: 'e3-verify-duplicate-new-candidate',
      }),
    ).rejects.toThrow('FACILITY_POSSIBLE_DUPLICATE');

    const verified = await facilityRepository.verifyFacility({
      ...verifyInput,
      key: 'e3-verify-duplicate-confirm-new',
      duplicateReview: {
        confirmedDistinct: true,
        reason: 'Hai phòng khám dùng cùng thương hiệu nhưng khác cơ sở.',
        reviewedFacilityIds: [owner.id],
      },
    });
    expect(verified.status).toBe('verified');
    expect(verified.duplicateDecisions).toEqual([
      expect.objectContaining({ candidateFacilityId: owner.id }),
    ]);
  });

  it('serializes concurrent verification so only one similar Facility is published without review', async () => {
    const first = await facilityRepository.createFacilityDraft({
      details: { name: 'Temporary alpha record' },
      actorId: actorId.toHexString(),
      key: 'e3-verify-race-first-create-01',
    });
    const second = await facilityRepository.createFacilityDraft({
      details: { name: 'Temporary beta record' },
      actorId: actorId.toHexString(),
      key: 'e3-verify-race-second-create-01',
    });
    const firstUpdated = await facilityRepository.updateFacilityDraft({
      id: first.id,
      expectedRevision: first.revision,
      details: details('Phòng khám Bình An', 106.701, 'Quận 7'),
      actorId: actorId.toHexString(),
      key: 'e3-verify-race-first-update-01',
    });
    const secondUpdated = await facilityRepository.updateFacilityDraft({
      id: second.id,
      expectedRevision: second.revision,
      details: details('Phòng khám Bình An', 106.7011, 'Quận 7'),
      actorId: actorId.toHexString(),
      key: 'e3-verify-race-second-update-01',
    });
    const outcomes = await Promise.allSettled([
      facilityRepository.verifyFacility({
        id: first.id,
        revisionId: firstUpdated.draftRevisionId!,
        expectedRevision: firstUpdated.revision,
        actorId: actorId.toHexString(),
        key: 'e3-verify-race-first-verify-01',
      }),
      facilityRepository.verifyFacility({
        id: second.id,
        revisionId: secondUpdated.draftRevisionId!,
        expectedRevision: secondUpdated.revision,
        actorId: actorId.toHexString(),
        key: 'e3-verify-race-second-verify-01',
      }),
    ]);
    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === 'fulfilled',
    );
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    if (fulfilled.length !== 1)
      throw new Error(
        `unexpected verification outcomes: ${outcomes
          .map((outcome) =>
            outcome.status === 'rejected'
              ? `${String(outcome.reason?.message ?? outcome.reason)}${
                  Array.isArray(outcome.reason?.candidates)
                    ? ` [${outcome.reason.candidates
                        .map(
                          (candidate: {
                            id?: string;
                            status?: string;
                            name?: string;
                          }) =>
                            `${candidate.status}:${candidate.id}:${candidate.name}`,
                        )
                        .join('|')}]`
                    : ''
                }`
              : 'fulfilled',
          )
          .join(', ')}`,
      );
    expect(rejected?.status === 'rejected' ? rejected.reason.message : '').toBe(
      'FACILITY_POSSIBLE_DUPLICATE',
    );
    expect(
      await facilityModel.countDocuments({
        _id: { $in: [first.id, second.id] },
        status: 'verified',
      }),
    ).toBe(1);
  });

  it('links Place ID transactionally, replays without duplicate audit, and reports an owner conflict', async () => {
    const first = await facilityRepository.createFacilityDraft({
      details: { name: 'Manual Facility for Place link' },
      actorId: actorId.toHexString(),
      key: 'e3-place-link-first-create-01',
    });
    const commandInput = {
      id: first.id,
      placeId: 'synthetic-place-link-owner',
      expectedRevision: first.revision,
      actorId: actorId.toHexString(),
      key: 'e3-place-link-command-0001',
    };
    const linked =
      await facilityRepository.updateFacilityMetadata(commandInput);
    const replay =
      await facilityRepository.updateFacilityMetadata(commandInput);
    expect(linked).toEqual(replay);
    expect(linked).toMatchObject({
      googlePlaceId: commandInput.placeId,
      revision: 2,
    });
    expect(
      await connection.collection(auditCollectionName).countDocuments({
        entityId: new Types.ObjectId(first.id),
        action: 'facility_google_place_id_linked',
      }),
    ).toBe(1);

    const second = await facilityRepository.createFacilityDraft({
      details: { name: 'Second Manual Facility for Place link' },
      actorId: actorId.toHexString(),
      key: 'e3-place-link-second-create-01',
    });
    await expect(
      facilityRepository.updateFacilityMetadata({
        ...commandInput,
        id: second.id,
        expectedRevision: second.revision,
        key: 'e3-place-link-second-command-1',
      }),
    ).rejects.toThrow('FACILITY_GOOGLE_PLACE_ALREADY_LINKED');
  });

  it('requires official-source confirmation before verifying a Place draft', async () => {
    const draft = await facilityRepository.createFacilityDraftFromPlace({
      placeId: 'synthetic-place-verification',
      providerPreview: placePreview('synthetic-place-verification'),
      actorId: actorId.toHexString(),
      key: 'e3-place-verify-create-0001',
    });
    const updated = await facilityRepository.updateFacilityDraft({
      id: draft.id,
      details: details('Officially sourced clinic', 106.71),
      expectedRevision: draft.revision,
      actorId: actorId.toHexString(),
      key: 'e3-place-verify-details-01',
    });
    const command = {
      id: draft.id,
      revisionId: updated.draftRevisionId!,
      expectedRevision: updated.revision,
      actorId: actorId.toHexString(),
    };

    await expect(
      facilityRepository.verifyFacility({
        ...command,
        key: 'e3-place-verify-no-confirm-01',
      }),
    ).rejects.toThrow('FACILITY_PROVIDER_DATA_REVIEW_CONFIRMATION_REQUIRED');
    expect(
      await queryRepository.getVerifiedFacility(draft.id, new Date(), 180),
    ).toBeNull();

    const verified = await facilityRepository.verifyFacility({
      ...command,
      providerDataReviewedAgainstOfficialSource: true,
      key: 'e3-place-verify-confirmed-01',
    });
    expect(verified.status).toBe('verified');
    expect(
      await connection
        .collection('medicalfacilities')
        .findOne({ _id: new Types.ObjectId(draft.id) }),
    ).toHaveProperty('googlePlaceId', 'synthetic-place-verification');
  });

  it('returns a committed concurrent receipt when the provider request fails', async () => {
    const key = 'e3-map-concurrent-replay-001';
    const placeId = 'synthetic-concurrent-place';
    const findPlace = jest.fn(async () => {
      await facilityRepository.createFacilityDraftFromPlace({
        actorId: actorId.toHexString(),
        key,
        placeId,
        providerPreview: placePreview(placeId),
      });
      throw new Error('synthetic outage');
    });
    const useCase = new ManageMedicalFacilities(
      facilityRepository,
      queryRepository,
      { isSuperAdmin: async () => true },
      { findPlace } as never,
      { get: () => true } as never,
    );
    const result = await useCase.createDraftFromMapCandidate(
      actorId.toHexString(),
      key,
      placeId,
    );
    expect(result.data?.status).toBe('draft');
    expect(
      await connection
        .collection('medicalfacilities')
        .countDocuments({ googlePlaceId: placeId }),
    ).toBe(1);
  });

  it('enforces JWT, persisted Admin sub-role and map replay through the HTTP controller', async () => {
    const secret = 'synthetic-e3-test-signing-secret-only';
    const userModel = connection.model<UserDocument>(User.name, UserSchema);
    const superId = new Types.ObjectId();
    const managerId = new Types.ObjectId();
    await connection.collection('users').insertMany([
      {
        _id: superId,
        fullName: 'Synthetic admin',
        role: 'admin',
        accountStatus: 'active',
        adminProfile: { adminRole: 'super_admin' },
      },
      {
        _id: managerId,
        fullName: 'Synthetic manager',
        role: 'admin',
        accountStatus: 'active',
        adminProfile: { adminRole: 'ai_manager' },
      },
    ]);
    const authority = new MongooseFacilityAdminAuthorityAdapter(userModel);
    const config = {
      get: (key: string, fallback?: unknown) =>
        (
          ({
            FACILITY_DIRECTORY_ENABLED: true,
            GOOGLE_MAPS_PLACES_ENABLED: true,
            GOOGLE_MAPS_API_KEY: 'synthetic-key',
          }) as Record<string, unknown>
        )[key] ?? fallback,
      getOrThrow: () => secret,
    };
    const provider = new GooglePlacesAdapter(config as never, {
      assertAllowed: async () => undefined,
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) => {
        const url = fetchRequestUrl(input);
        return {
          ok: true,
          json: async () =>
            url.endsWith('places:searchText')
              ? {
                  places: [
                    {
                      id: 'synthetic-search-place',
                      displayName: { text: 'Synthetic Clinic' },
                      formattedAddress: 'Quận 3, Thành phố Hồ Chí Minh',
                    },
                  ],
                }
              : {
                  id: 'synthetic-http-place',
                  displayName: { text: 'Synthetic' },
                  formattedAddress: 'Synthetic',
                },
        } as Response;
      });
    const useCase = new ManageMedicalFacilities(
      facilityRepository,
      queryRepository,
      authority,
      provider,
      config as never,
    );
    const searchCandidates = new SearchMapFacilityCandidates(
      queryRepository,
      authority,
      provider,
      facilityRepository,
      config as never,
    );
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AdminMedicalFacilitiesController],
      providers: [
        JwtStrategy,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: ConfigService, useValue: config },
        { provide: ManageMedicalFacilities, useValue: useCase },
        { provide: SearchMapFacilityCandidates, useValue: searchCandidates },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    const jwt = new JwtService({ secret });
    const token = (id: Types.ObjectId) =>
      jwt.sign({ sub: String(id), role: 'admin' });
    try {
      const route = '/admin/medical-facilities/from-map-candidate';
      const key = 'e3-http-map-idempotency-001';
      await request(app.getHttpServer())
        .post(route)
        .set('Authorization', `Bearer ${token(managerId)}`)
        .set('Idempotency-Key', key)
        .send({ placeId: 'synthetic-http-place' })
        .expect(403);
      await request(app.getHttpServer())
        .post(route)
        .set('Idempotency-Key', key)
        .send({ placeId: 'synthetic-http-place' })
        .expect(401);
      const first = await request(app.getHttpServer())
        .post(route)
        .set('Authorization', `Bearer ${token(superId)}`)
        .set('Idempotency-Key', key)
        .send({ placeId: 'synthetic-http-place' })
        .expect(201);
      fetchSpy.mockRejectedValue(new Error('synthetic upstream unavailable'));
      const replay = await request(app.getHttpServer())
        .post(route)
        .set('Authorization', `Bearer ${token(superId)}`)
        .set('Idempotency-Key', key)
        .send({ placeId: 'synthetic-http-place' })
        .expect(201);
      expect(first.body.data.providerPreview).toMatchObject({
        name: 'Synthetic',
        address: 'Synthetic',
        source: 'google_maps',
        verifiedInternally: false,
      });
      expect(replay.body.data.id).toBe(first.body.data.id);
      expect(replay.body.data).not.toHaveProperty('providerPreview');
      await request(app.getHttpServer())
        .post(route)
        .set('Authorization', `Bearer ${token(superId)}`)
        .set('Idempotency-Key', key)
        .send({ placeId: 'synthetic-other-place' })
        .expect(409);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockImplementation(async (input) => {
        const url = fetchRequestUrl(input);
        return {
          ok: true,
          json: async () =>
            url.endsWith('places:searchText')
              ? {
                  places: [
                    {
                      id: 'synthetic-search-place',
                      displayName: { text: 'Synthetic Clinic' },
                      formattedAddress: 'Quận 3, Thành phố Hồ Chí Minh',
                    },
                  ],
                }
              : {
                  id: 'synthetic-http-place',
                  displayName: { text: 'Synthetic' },
                  formattedAddress: 'Synthetic',
                },
        } as Response;
      });

      const searchRoute = '/admin/medical-facilities/map-candidates';
      const querySearch = await request(app.getHttpServer())
        .post(searchRoute)
        .set('Authorization', `Bearer ${token(superId)}`)
        .send({
          query: 'Phòng khám Minh An chi nhánh Quận 3',
          placeType: 'hospital',
        })
        .expect(201);
      expect(querySearch.body.data.items[0]).toMatchObject({
        placeId: 'synthetic-search-place',
        name: 'Synthetic Clinic',
      });
      const queryBody = parseFetchRequestBody(fetchSpy.mock.calls.at(-1)?.[1]);
      expect(queryBody).toMatchObject({
        textQuery:
          'Phòng khám Minh An chi nhánh Quận 3 tại Thành phố Hồ Chí Minh',
        includedType: 'hospital',
        strictTypeFiltering: true,
      });

      await request(app.getHttpServer())
        .post(searchRoute)
        .set('Authorization', `Bearer ${token(superId)}`)
        .send({ specialtyCode: 'cardiology', area: 'Quận 1' })
        .expect(201);
      const specialtyBody = parseFetchRequestBody(
        fetchSpy.mock.calls.at(-1)?.[1],
      );
      expect(specialtyBody.textQuery).toBe(
        'Tim mạch cơ sở y tế tại Quận 1, Thành phố Hồ Chí Minh',
      );

      const callsBeforeInvalidRequests = fetchSpy.mock.calls.length;
      await request(app.getHttpServer())
        .post(searchRoute)
        .set('Authorization', `Bearer ${token(superId)}`)
        .send({
          query: 'Bệnh viện A',
          specialtyCode: 'cardiology',
          area: 'Quận 1',
        })
        .expect(400);
      await request(app.getHttpServer())
        .post(searchRoute)
        .set('Authorization', `Bearer ${token(superId)}`)
        .send({ query: '   ' })
        .expect(400);
      await request(app.getHttpServer())
        .post(searchRoute)
        .set('Authorization', `Bearer ${token(superId)}`)
        .send({ query: 'Bệnh viện A', placeType: 'clinic' })
        .expect(400);
      await request(app.getHttpServer())
        .post(searchRoute)
        .set('Authorization', `Bearer ${token(superId)}`)
        .send({ specialtyCode: 'not-active', area: 'Quận 1' })
        .expect(400);
      await request(app.getHttpServer())
        .post(searchRoute)
        .set('Authorization', `Bearer ${token(managerId)}`)
        .send({ query: 'Bệnh viện A' })
        .expect(403);
      expect(fetchSpy).toHaveBeenCalledTimes(callsBeforeInvalidRequests);
    } finally {
      fetchSpy.mockRestore();
      await app.close();
    }
  });

  it('stores an incomplete draft but rejects verification until required details are supplied', async () => {
    const draft = await facilityRepository.createFacilityDraft({
      details: { name: 'Incomplete synthetic clinic' },
      actorId: actorId.toHexString(),
      key: 'e3-partial-draft-test-0001',
    });
    expect(draft.status).toBe('draft');
    expect(
      (await facilityRepository.getAdminFacility(draft.id))?.draftDetails,
    ).toMatchObject({ name: 'Incomplete synthetic clinic' });
    await expect(
      facilityRepository.verifyFacility({
        id: draft.id,
        revisionId: draft.draftRevisionId!,
        expectedRevision: draft.revision,
        actorId: actorId.toHexString(),
        key: 'e3-partial-verify-test-001',
      }),
    ).rejects.toThrow('FACILITY_DETAILS_INCOMPLETE');
    expect(
      await queryRepository.getVerifiedFacility(draft.id, new Date(), 180),
    ).toBeNull();
  });

  it('serializes concurrent replay of the same command to one aggregate and audit', async () => {
    const beforeFacilities = await connection
      .collection('medicalfacilities')
      .countDocuments({});
    const beforeAudits = await connection
      .collection(auditCollectionName)
      .countDocuments({ action: 'facility_draft_created' });
    const input = {
      details: details('Concurrent Synthetic Clinic', 106.71),
      actorId: actorId.toHexString(),
      key: 'e3-concurrent-idempotency-001',
    };
    const results = await Promise.all([
      facilityRepository.createFacilityDraft(input),
      facilityRepository.createFacilityDraft(input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(
      await connection.collection('medicalfacilities').countDocuments({}),
    ).toBe(beforeFacilities + 1);
    expect(
      await connection
        .collection(auditCollectionName)
        .countDocuments({ action: 'facility_draft_created' }),
    ).toBe(beforeAudits + 1);
  });

  it('rolls back the aggregate and idempotency receipt when audit persistence fails', async () => {
    const beforeFacilities = await connection
      .collection('medicalfacilities')
      .countDocuments({});
    const beforeReceipts = await connection
      .collection('facilitycommandreceipts')
      .countDocuments({});
    let insertedId: string | undefined;
    await expect(
      command.run({
        actorId: actorId.toHexString(),
        operation: 'facility.integration-rollback',
        key: 'e3-audit-rollback-000001',
        request: { scenario: 'synthetic' },
        work: async (session) => {
          const [facility] = await facilityModel.create(
            [
              {
                status: 'draft',
                revision: 1,
                specialtyCodes: [],
                createdBy: actorId,
              },
            ],
            { session },
          );
          insertedId = String(facility._id);
          return {
            result: { id: insertedId },
            audits: [
              {
                entityType: 'MedicalFacility',
                entityId: insertedId,
                action: '',
              },
            ],
          };
        },
      }),
    ).rejects.toThrow();
    expect(
      await connection.collection('medicalfacilities').countDocuments({}),
    ).toBe(beforeFacilities);
    expect(
      await connection.collection('facilitycommandreceipts').countDocuments({}),
    ).toBe(beforeReceipts);
    expect(await facilityModel.exists({ _id: insertedId })).toBeNull();
  });

  it('keeps the verified revision live until a new revision is reviewed', async () => {
    const created = await facilityRepository.createFacilityDraft({
      details: details('Old Verified Name', 106.7),
      actorId: actorId.toHexString(),
      key: 'e3-create-revision-test-01',
    });
    const verified = await facilityRepository.verifyFacility({
      id: created.id,
      revisionId: created.draftRevisionId!,
      expectedRevision: created.revision,
      actorId: actorId.toHexString(),
      key: 'e3-verify-revision-test-01',
    });
    expect(verified.status).toBe('verified');

    const revision = await facilityRepository.createFacilityRevision({
      id: created.id,
      actorId: actorId.toHexString(),
      key: 'e3-new-revision-test-0001',
    });
    const updated = await facilityRepository.updateFacilityDraft({
      id: created.id,
      revisionId: revision.id,
      expectedRevision: 3,
      details: details('New Reviewed Name', 106.7),
      actorId: actorId.toHexString(),
      key: 'e3-update-revision-test-01',
    });
    expect(updated.status).toBe('verified');
    expect(
      (await queryRepository.getVerifiedFacility(created.id, new Date(), 180))
        ?.name,
    ).toBe('Old Verified Name');
    const adminView = await facilityRepository.getAdminFacility(created.id);
    expect(adminView?.currentDetails?.name).toBe('Old Verified Name');
    expect(adminView?.draftDetails?.name).toBe('New Reviewed Name');

    await facilityRepository.verifyFacility({
      id: created.id,
      revisionId: revision.id,
      expectedRevision: updated.revision,
      actorId: actorId.toHexString(),
      key: 'e3-verify-revision-test-02',
    });
    expect(
      (await queryRepository.getVerifiedFacility(created.id, new Date(), 180))
        ?.name,
    ).toBe('New Reviewed Name');
  });

  it('uses the geospatial index, stable tie-breaker and verified-only projection', async () => {
    const first = await facilityRepository.createFacilityDraft({
      details: details('Alpha Family Clinic', 106.85, 'Khu E3 geospatial 2026'),
      actorId: actorId.toHexString(),
      key: 'e3-geo-create-000001',
    });
    await facilityRepository.verifyFacility({
      id: first.id,
      revisionId: first.draftRevisionId!,
      expectedRevision: first.revision,
      actorId: actorId.toHexString(),
      key: 'e3-geo-verify-000001',
    });
    const second = await facilityRepository.createFacilityDraft({
      details: details(
        'Beta Cardiology Center',
        106.85,
        'Khu E3 geospatial 2026',
      ),
      actorId: actorId.toHexString(),
      key: 'e3-geo-create-000002',
    });
    await facilityRepository.verifyFacility({
      id: second.id,
      revisionId: second.draftRevisionId!,
      expectedRevision: second.revision,
      actorId: actorId.toHexString(),
      key: 'e3-geo-verify-000002',
    });
    await facilityRepository.createFacilityDraft({
      details: details(
        'Draft Must Not Appear',
        106.85,
        'Khu E3 geospatial 2026',
      ),
      actorId: actorId.toHexString(),
      key: 'e3-geo-create-000003',
    });

    const result = await queryRepository.searchVerifiedFacilities({
      specialtyCodes: ['cardiology'],
      location: { longitude: 106.85, latitude: 10.77 },
      radiusKm: 10,
      page: 1,
      limit: 1,
      now: new Date(),
      staleAfterDays: 180,
      reasonCode: 'manual_specialty',
    });
    expect(result.pagination.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Alpha Family Clinic');
    expect(result.items[0]).not.toHaveProperty('location');
    expect(result.items[0]).not.toHaveProperty('officialSourceUrl');

    const areaResult = await queryRepository.searchVerifiedFacilities({
      specialtyCodes: ['cardiology'],
      area: 'Khu E3 geospatial 2026',
      radiusKm: 10,
      page: 1,
      limit: 20,
      now: new Date(),
      staleAfterDays: 180,
      reasonCode: 'manual_specialty',
    });
    expect(areaResult.items.map((facility) => facility.name)).toEqual([
      'Alpha Family Clinic',
      'Beta Cardiology Center',
    ]);

    const explain = await facilityModel
      .aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [106.85, 10.77] },
            key: 'location',
            distanceField: 'distanceMeters',
            maxDistance: 10_000,
            spherical: true,
            query: {
              status: 'verified',
              'address.provinceCode': 'HCMC',
              specialtyCodes: { $in: ['cardiology'] },
            },
          },
        },
        { $limit: 1 },
      ])
      .explain('executionStats');
    expect(JSON.stringify(explain)).toContain('verified_location_2dsphere');
  });

  it('publishes only the newest reviewed mapping for a disease/program scope', async () => {
    const first = await mappingRepository.createMapping({
      scope: 'disease',
      scopeKey: 'hypertension',
      specialtyCodes: ['cardiology'],
      sourceReferences: ['https://example.org/source-v1'],
      actorId: actorId.toHexString(),
      key: 'e3-mapping-create-000001',
    });
    const firstPublished = await mappingRepository.publishMapping({
      id: first.id,
      expectedRevision: first.revision,
      actorId: actorId.toHexString(),
      key: 'e3-mapping-publish-00001',
    });
    expect(firstPublished.status).toBe('published');

    const second = await mappingRepository.createMapping({
      scope: 'disease',
      scopeKey: 'hypertension',
      specialtyCodes: ['cardiology'],
      sourceReferences: ['https://example.org/source-v2'],
      actorId: actorId.toHexString(),
      key: 'e3-mapping-create-000002',
    });
    expect(second.version).toBe(first.version + 1);
    await mappingRepository.publishMapping({
      id: second.id,
      expectedRevision: second.revision,
      actorId: actorId.toHexString(),
      key: 'e3-mapping-publish-00002',
    });
    const published = await mappingRepository.listMappings({
      scope: 'disease',
      scopeKey: 'hypertension',
      status: 'published',
    });
    expect(published.map((mapping) => mapping.id)).toEqual([second.id]);
    expect(
      await connection.collection('diseasespecialties').countDocuments({
        scope: 'disease',
        scopeKey: 'hypertension',
        status: 'retired',
      }),
    ).toBe(1);
  });

  it('removes a retired facility from subsequent Patient search', async () => {
    const created = await facilityRepository.createFacilityDraft({
      details: details('Retired Synthetic Clinic', 106.72, 'Quận 5'),
      actorId: actorId.toHexString(),
      key: 'e3-retire-create-00001',
    });
    const verified = await facilityRepository.verifyFacility({
      id: created.id,
      revisionId: created.draftRevisionId!,
      expectedRevision: created.revision,
      actorId: actorId.toHexString(),
      key: 'e3-retire-verify-00001',
    });
    await facilityRepository.retireFacility({
      id: created.id,
      reason: 'Synthetic integration test',
      expectedRevision: verified.revision,
      actorId: actorId.toHexString(),
      key: 'e3-retire-action-00001',
    });
    const result = await queryRepository.searchVerifiedFacilities({
      specialtyCodes: ['cardiology'],
      area: 'Quận 5',
      radiusKm: 10,
      page: 1,
      limit: 20,
      now: new Date(),
      staleAfterDays: 180,
      reasonCode: 'manual_specialty',
    });
    expect(result.items.some((facility) => facility.id === created.id)).toBe(
      false,
    );
  });
});
