import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { MedicalFacilityRepository } from '../../application/ports/care-directory.ports';
import type {
  FacilityAdminRecord,
  FacilityDetails,
  FacilityDraftDetails,
  FacilityRevisionRecord,
  NewFacilityDetails,
} from '../../domain/care-directory.types';
import type {
  FacilityDuplicateReviewInput,
  FacilityDuplicateSubject,
  PossibleFacilityDuplicate,
} from '../../domain/policies/facility-duplicate-policy';
import {
  FACILITY_DUPLICATE_CANDIDATE_LIMIT,
  FACILITY_DUPLICATE_NEARBY_METERS,
  FacilityDuplicateReviewCandidateMismatchError,
  FacilityDuplicateReviewRequiredError,
  FacilityPlaceIdConflictError,
  facilityDuplicateDistanceMeters,
  facilityDuplicateSearchTokens,
  findDuplicateReasons,
  validateDistinctFacilityReview,
} from '../../domain/policies/facility-duplicate-policy';
import { MedicalFacilityAggregate } from '../../domain/entities/medical-facility.aggregate';
import { validateFacilityDetails } from '../../domain/policies/facility-policy';
import { FacilityCommandTransaction } from './facility-command-transaction';
import {
  MedicalFacility,
  MedicalFacilityDocument,
  MedicalFacilityRevision,
  MedicalFacilityRevisionDocument,
} from './medical-facility.schema';
import {
  MedicalSpecialty,
  MedicalSpecialtyDocument,
} from './medical-specialty.schema';
import {
  FacilityDuplicateGuard,
  FacilityDuplicateGuardDocument,
} from './facility-duplicate-review.schema';
@Injectable()
export class MongooseMedicalFacilityRepository implements MedicalFacilityRepository {
  constructor(
    @InjectModel(MedicalFacility.name)
    private readonly facilities: Model<MedicalFacilityDocument>,
    @InjectModel(MedicalFacilityRevision.name)
    private readonly revisions: Model<MedicalFacilityRevisionDocument>,
    @InjectModel(MedicalSpecialty.name)
    private readonly specialties: Model<MedicalSpecialtyDocument>,
    @InjectModel(FacilityDuplicateGuard.name)
    private readonly duplicateGuards: Model<FacilityDuplicateGuardDocument>,
    private readonly commands: FacilityCommandTransaction,
  ) {}

  async listAdminFacilities(input: {
    status?: string;
    needsRecheck?: boolean;
    staleBefore?: Date;
    page: number;
    limit: number;
  }) {
    const filter: Record<string, unknown> = input.status
      ? { status: input.status }
      : {};
    if (input.needsRecheck === true && input.staleBefore) {
      filter.status = 'verified';
      filter.$or = [
        { lastCheckedAt: { $lt: input.staleBefore } },
        { lastCheckedAt: { $exists: false } },
      ];
    } else if (input.needsRecheck === false && input.staleBefore) {
      filter.$or = [
        { status: { $ne: 'verified' } },
        { lastCheckedAt: { $gte: input.staleBefore } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.facilities
        .find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((input.page - 1) * input.limit)
        .limit(input.limit)
        .lean()
        .exec(),
      this.facilities.countDocuments(filter).exec(),
    ]);
    const items = await Promise.all(rows.map((row) => this.adminRecord(row)));
    return { items, total };
  }

  async getAdminFacility(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const row = await this.facilities.findById(id).lean().exec();
    if (!row) return null;
    const record = await this.adminRecord(row);
    return record;
  }

  async findFacilityByGooglePlaceId(placeId: string) {
    const row = await this.facilities
      .findOne({ googlePlaceId: placeId })
      .lean()
      .exec();
    if (!row) return null;
    return this.placeIdOwnerProjection(row);
  }

  findUpdateFacilityMetadataReplay(input: {
    id: string;
    placeId: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }) {
    return this.commands.findReplay<FacilityAdminRecord>({
      ...input,
      operation: 'facility.update-metadata',
      request: {
        id: input.id,
        placeId: input.placeId,
        expectedRevision: input.expectedRevision,
      },
    });
  }

  updateFacilityMetadata(input: {
    id: string;
    placeId: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }) {
    return this.run(
      input,
      'facility.update-metadata',
      {
        id: input.id,
        placeId: input.placeId,
        expectedRevision: input.expectedRevision,
      },
      async (session) => {
        const id = this.objectId(input.id);
        const facility = await this.facilities
          .findById(id)
          .session(session)
          .exec();
        if (!facility) throw new NotFoundException('FACILITY_NOT_FOUND');
        if (facility.status === 'retired')
          throw new ConflictException('FACILITY_RETIRED_CANNOT_LINK_PLACE');
        if (facility.revision !== input.expectedRevision)
          throw new ConflictException('FACILITY_REVISION_CONFLICT');
        if (facility.googlePlaceId) {
          if (facility.googlePlaceId !== input.placeId)
            throw new ConflictException(
              'FACILITY_GOOGLE_PLACE_CHANGE_NOT_SUPPORTED',
            );
          return {
            result: await this.adminRecord(facility.toObject()),
            audits: [],
          };
        }

        const existingOwner = await this.facilities
          .findOne({ googlePlaceId: input.placeId })
          .session(session)
          .lean()
          .exec();
        if (existingOwner)
          throw new FacilityPlaceIdConflictError(
            await this.placeIdOwnerProjection(existingOwner, session),
          );

        facility.googlePlaceId = input.placeId;
        facility.revision += 1;
        await facility.save({ session });
        return {
          result: await this.adminRecord(facility.toObject()),
          audits: [
            {
              entityType: 'MedicalFacility',
              entityId: String(id),
              action: 'facility_google_place_id_linked',
              metadata: {
                linked: true,
                facilityRevision: facility.revision,
              },
            },
          ],
        };
      },
    ).catch(async (error: unknown) => {
      const owner = await this.facilities
        .findOne({ googlePlaceId: input.placeId })
        .lean()
        .exec();
      if (owner && isUniqueConflict(error))
        throw new FacilityPlaceIdConflictError(
          await this.placeIdOwnerProjection(owner),
        );
      throw error;
    });
  }

  createFacilityDraft(input: {
    details: FacilityDraftDetails;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }) {
    return this.run(
      input,
      'facility.create-draft',
      { details: input.details, duplicateReview: input.duplicateReview },
      async (session) => {
        const facilityId = new Types.ObjectId();
        const review = await this.prepareDuplicateDecisions({
          facilityId,
          subject: input.details,
          duplicateReview: input.duplicateReview,
          existingReviews: [],
          actorId: input.actorId,
          session,
          includeStatuses: ['draft', 'verified', 'retired'],
        });
        await this.assertSpecialtiesActive(
          input.details.specialtyCodes ?? [],
          session,
        );
        const revisionId = new Types.ObjectId();
        const actorId = new Types.ObjectId(input.actorId);
        const transition = MedicalFacilityAggregate.createDraft({
          id: String(facilityId),
          revisionId: String(revisionId),
          details: input.details,
          actorId: String(actorId),
        });
        const [facility] = await this.facilities.create(
          [
            {
              _id: facilityId,
              status: transition.facility.status,
              revision: transition.facility.revision,
              draftRevisionId: revisionId,
              specialtyCodes: [],
              duplicateSearchTokens: facilityDuplicateSearchTokens(
                input.details,
              ),
              ...(input.details.location
                ? { duplicateLocation: input.details.location }
                : {}),
              createdBy: actorId,
              duplicateReviews: review.decisions.map((decision) => ({
                candidateFacilityId: decision.candidateFacilityId,
                reviewedBy: decision.reviewedBy,
                reason: decision.reason,
                reviewedAt: decision.reviewedAt,
              })),
            },
          ],
          { session },
        );
        await this.revisions.create(
          [
            {
              _id: revisionId,
              facilityId,
              version: transition.revision.version,
              revision: transition.revision.revision,
              status: transition.revision.status,
              details: transition.revision.details as unknown as Record<
                string,
                unknown
              >,
              createdBy: actorId,
            },
          ],
          { session },
        );
        return {
          result: {
            ...this.toAdminRecord(facility, input.details),
            draftRevisionId: String(revisionId),
            ...(review.views.length
              ? { duplicateDecisions: review.views }
              : {}),
          },
          audits: [
            {
              entityType: 'MedicalFacility',
              entityId: String(facilityId),
              action: 'facility_draft_created',
              toStatus: 'draft',
              metadata: { revision: 1 },
            },
            ...review.audits,
          ],
        };
      },
    );
  }

  createFacilityDraftFromPlace(input: {
    placeId: string;
    providerPreview: import('../../application/ports/care-directory.ports').MapPlacePreview;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }) {
    return this.run(
      input,
      'facility.create-draft-from-map',
      { placeId: input.placeId, duplicateReview: input.duplicateReview },
      async (session) => {
        const existingOwner = await this.facilities
          .findOne({ googlePlaceId: input.placeId })
          .session(session)
          .lean()
          .exec();
        if (existingOwner)
          throw new FacilityPlaceIdConflictError(
            await this.placeIdOwnerProjection(existingOwner, session),
          );
        const facilityId = new Types.ObjectId();
        const review = await this.prepareDuplicateDecisions({
          facilityId,
          subject: {
            name: input.providerPreview.name,
            address: input.providerPreview.address,
            ...(input.providerPreview.location
              ? {
                  location: {
                    type: 'Point' as const,
                    coordinates: [
                      input.providerPreview.location.longitude,
                      input.providerPreview.location.latitude,
                    ] as [number, number],
                  },
                }
              : {}),
          },
          duplicateReview: input.duplicateReview,
          existingReviews: [],
          actorId: input.actorId,
          session,
          includeStatuses: ['draft', 'verified', 'retired'],
        });
        const revisionId = new Types.ObjectId();
        const actorId = new Types.ObjectId(input.actorId);
        const transition = MedicalFacilityAggregate.createDraftFromPlace({
          id: String(facilityId),
          revisionId: String(revisionId),
          placeId: input.placeId,
          actorId: String(actorId),
        });
        const [facility] = await this.facilities.create(
          [
            {
              _id: facilityId,
              status: transition.facility.status,
              revision: transition.facility.revision,
              draftRevisionId: revisionId,
              googlePlaceId: transition.facility.googlePlaceId,
              specialtyCodes: [],
              createdBy: actorId,
              duplicateReviews: review.decisions.map((decision) => ({
                candidateFacilityId: decision.candidateFacilityId,
                reviewedBy: decision.reviewedBy,
                reason: decision.reason,
                reviewedAt: decision.reviewedAt,
              })),
            },
          ],
          { session },
        );
        await this.revisions.create(
          [
            {
              _id: revisionId,
              facilityId,
              version: transition.revision.version,
              revision: transition.revision.revision,
              status: transition.revision.status,
              details: transition.revision.details,
              createdBy: actorId,
            },
          ],
          { session },
        );
        return {
          result: {
            ...this.toAdminRecord(facility),
            draftRevisionId: String(revisionId),
            ...(review.views.length
              ? { duplicateDecisions: review.views }
              : {}),
          },
          audits: [
            {
              entityType: 'MedicalFacility',
              entityId: String(facilityId),
              action: 'facility_draft_created_from_map_candidate',
              toStatus: 'draft',
              metadata: {
                provider: 'google_maps',
                placeIdStored: true,
                revision: 1,
              },
            },
            ...review.audits,
          ],
        };
      },
    ).catch(async (error: unknown) => {
      const owner = await this.facilities
        .findOne({ googlePlaceId: input.placeId })
        .lean()
        .exec();
      if (owner && isUniqueConflict(error))
        throw new FacilityPlaceIdConflictError(
          await this.placeIdOwnerProjection(owner),
        );
      throw error;
    });
  }

  findCreateFacilityDraftFromPlaceReplay(input: {
    placeId: string;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }) {
    return this.commands.findReplay<FacilityAdminRecord>({
      ...input,
      operation: 'facility.create-draft-from-map',
      request: {
        placeId: input.placeId,
        duplicateReview: input.duplicateReview,
      },
    });
  }

  updateFacilityDraft(input: {
    id: string;
    revisionId?: string;
    details: FacilityDraftDetails;
    expectedRevision: number;
    actorId: string;
    key: string;
  }) {
    return this.run(
      input,
      'facility.update-draft',
      {
        id: input.id,
        revisionId: input.revisionId,
        details: input.details,
        expectedRevision: input.expectedRevision,
      },
      async (session) => {
        const id = this.objectId(input.id);
        const facility = await this.facilities
          .findOne({
            _id: id,
            revision: input.expectedRevision,
            status: { $in: ['draft', 'verified'] },
            draftRevisionId: { $type: 'objectId' },
          })
          .session(session)
          .exec();
        if (!facility)
          throw await this.notFoundOrConflict(
            id,
            input.expectedRevision,
            session,
          );
        const revisionId = input.revisionId
          ? this.objectId(input.revisionId)
          : facility.draftRevisionId;
        if (!revisionId || !facility.draftRevisionId?.equals(revisionId))
          throw new ConflictException('FACILITY_DRAFT_REVISION_CONFLICT');
        await this.assertSpecialtiesActive(
          input.details.specialtyCodes ?? [],
          session,
        );
        const currentRevision = await this.revisions
          .findOne({ _id: revisionId, facilityId: id })
          .session(session)
          .exec();
        if (!currentRevision)
          throw new ConflictException('FACILITY_DRAFT_REVISION_CONFLICT');
        const transition = MedicalFacilityAggregate.updateDraft({
          facility: this.facilityState(facility),
          revision: this.revisionState(currentRevision),
          revisionId: String(revisionId),
          expectedRevision: input.expectedRevision,
          details: input.details,
          actorId: input.actorId,
        });
        const revision = await this.revisions
          .findOneAndUpdate(
            {
              _id: revisionId,
              facilityId: id,
              status: 'draft',
              revision: currentRevision.revision,
            },
            {
              $set: {
                details: transition.revision.details,
                updatedBy: new Types.ObjectId(transition.revision.updatedBy),
              },
              $inc: { revision: 1 },
            },
            { returnDocument: 'after', session },
          )
          .exec();
        if (!revision)
          throw new ConflictException('FACILITY_DRAFT_REVISION_CONFLICT');
        facility.revision = transition.facility.revision;
        facility.duplicateSearchTokens = facilityDuplicateSearchTokens(
          input.details,
        );
        facility.duplicateLocation = input.details.location as any;
        await facility.save({ session });
        return {
          result: {
            ...this.toAdminRecord(facility, input.details),
            draftRevisionId: String(revisionId),
          },
          audits: [
            {
              entityType: 'MedicalFacility',
              entityId: String(id),
              action: 'facility_draft_updated',
              metadata: {
                facilityRevision: facility.revision,
                contentRevision: revision.revision,
              },
            },
          ],
        };
      },
    );
  }

  createFacilityRevision(input: {
    id: string;
    actorId: string;
    key: string;
  }): Promise<FacilityRevisionRecord> {
    return this.run(
      input,
      'facility.create-revision',
      { id: input.id },
      async (session) => {
        const id = this.objectId(input.id);
        const facility = await this.facilities
          .findOne({
            _id: id,
            status: 'verified',
            currentRevisionId: { $type: 'objectId' },
            draftRevisionId: { $exists: false },
          })
          .session(session)
          .exec();
        if (!facility)
          throw await this.notFoundOrConflict(id, undefined, session);
        const details = this.detailsFromRoot(facility);
        const previous = await this.revisions
          .findOne({ facilityId: id })
          .sort({ version: -1 })
          .session(session)
          .lean()
          .exec();
        const version = (previous?.version ?? 0) + 1;
        const revisionId = new Types.ObjectId();
        const transition = MedicalFacilityAggregate.createRevision({
          facility: this.facilityState(facility),
          currentDetails: details,
          revisionId: String(revisionId),
          version,
          actorId: input.actorId,
        });
        const [revision] = await this.revisions.create(
          [
            {
              _id: revisionId,
              facilityId: id,
              version: transition.revision.version,
              revision: transition.revision.revision,
              status: transition.revision.status,
              details: transition.revision.details as unknown as Record<
                string,
                unknown
              >,
              createdBy: new Types.ObjectId(transition.revision.createdBy),
            },
          ],
          { session },
        );
        facility.draftRevisionId = revision._id;
        facility.revision = transition.facility.revision;
        await facility.save({ session });
        return {
          result: this.revisionRecord(revision),
          audits: [
            {
              entityType: 'MedicalFacility',
              entityId: String(id),
              action: 'facility_revision_created',
              metadata: { version, facilityRevision: facility.revision },
            },
          ],
        };
      },
    );
  }

  verifyFacility(input: {
    id: string;
    revisionId: string;
    expectedRevision: number;
    providerDataReviewedAgainstOfficialSource?: boolean;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }) {
    return this.run(
      input,
      'facility.verify-revision',
      {
        id: input.id,
        revisionId: input.revisionId,
        expectedRevision: input.expectedRevision,
        providerDataReviewedAgainstOfficialSource:
          input.providerDataReviewedAgainstOfficialSource ?? false,
        duplicateReview: input.duplicateReview,
      },
      async (session) => {
        // All HCMC verify transitions share a short transactional write. This
        // serializes the final duplicate check and verified-state transition.
        const guard = await this.duplicateGuards
          .findOneAndUpdate(
            { _id: 'hcmc' },
            { $inc: { revision: 1 } },
            { returnDocument: 'after', session },
          )
          .exec();
        if (!guard)
          throw new ConflictException(
            'FACILITY_DUPLICATE_REVIEW_GUARD_MISSING',
          );
        const id = this.objectId(input.id);
        const revisionId = this.objectId(input.revisionId);
        const facility = await this.facilities
          .findOne({
            _id: id,
            revision: input.expectedRevision,
            status: { $in: ['draft', 'verified'] },
            draftRevisionId: revisionId,
          })
          .session(session)
          .exec();
        if (!facility)
          throw await this.notFoundOrConflict(
            id,
            input.expectedRevision,
            session,
          );
        if (
          facility.googlePlaceId &&
          input.providerDataReviewedAgainstOfficialSource !== true
        )
          throw new ConflictException(
            'FACILITY_PROVIDER_DATA_REVIEW_CONFIRMATION_REQUIRED',
          );
        const fromStatus = facility.status;
        const revision = await this.revisions
          .findOne({ _id: revisionId, facilityId: id, status: 'draft' })
          .session(session)
          .exec();
        if (!revision)
          throw new ConflictException('FACILITY_DRAFT_REVISION_CONFLICT');
        const details = validateFacilityDetails(
          revision.details as unknown as NewFacilityDetails,
        );
        await this.assertSpecialtiesActive(details.specialtyCodes, session);
        if (facility.googlePlaceId) {
          const anotherOwner = await this.facilities
            .findOne({
              googlePlaceId: facility.googlePlaceId,
              _id: { $ne: id },
            })
            .session(session)
            .lean()
            .exec();
          if (anotherOwner)
            throw new FacilityPlaceIdConflictError(
              await this.placeIdOwnerProjection(anotherOwner, session),
            );
        }
        const duplicateReview = await this.prepareDuplicateDecisions({
          facilityId: id,
          subject: details,
          duplicateReview: input.duplicateReview,
          existingReviews: facility.duplicateReviews ?? [],
          actorId: input.actorId,
          session,
          excludeFacilityId: id,
          includeStatuses: ['verified'],
        });
        const verifiedAt = new Date();
        const transition = MedicalFacilityAggregate.verifyRevision({
          facility: this.facilityState(facility),
          revision: this.revisionState(revision),
          details,
          actorId: input.actorId,
          verifiedAt,
        });
        if (transition.previousRevisionId)
          await this.revisions
            .updateOne(
              {
                _id: new Types.ObjectId(transition.previousRevisionId),
                facilityId: id,
                status: 'verified',
              },
              { $set: { status: 'superseded' } },
              { session },
            )
            .exec();
        revision.status = transition.revision.status;
        revision.verifiedBy = new Types.ObjectId(
          transition.revision.verifiedBy,
        );
        revision.verifiedAt = transition.revision.verifiedAt;
        revision.details = transition.revision.details as unknown as Record<
          string,
          unknown
        >;
        await revision.save({ session });
        facility.status = transition.facility.status;
        facility.currentRevisionId = revision._id;
        facility.draftRevisionId = undefined;
        facility.name = details.name;
        facility.normalizedName = details.normalizedName;
        facility.facilityType = details.facilityType;
        facility.address = details.address as any;
        facility.location = details.location as any;
        facility.duplicateSearchTokens = facilityDuplicateSearchTokens(details);
        facility.duplicateLocation = details.location as any;
        facility.specialtyCodes = details.specialtyCodes;
        facility.services = details.services;
        facility.contact = details.contact as any;
        facility.officialSourceUrl = details.officialSourceUrl;
        facility.verifiedBy = new Types.ObjectId(
          transition.facility.verifiedBy,
        );
        facility.verifiedAt = transition.facility.verifiedAt;
        facility.lastCheckedAt = transition.facility.lastCheckedAt;
        facility.revision = transition.facility.revision;
        facility.duplicateReviews = [
          ...(facility.duplicateReviews ?? []),
          ...duplicateReview.decisions.map((decision) => ({
            candidateFacilityId: decision.candidateFacilityId,
            reviewedBy: decision.reviewedBy,
            reason: decision.reason,
            reviewedAt: decision.reviewedAt,
          })),
        ];
        await facility.save({ session });
        return {
          result: {
            ...this.toAdminRecord(facility, details),
            ...(duplicateReview.views.length
              ? { duplicateDecisions: duplicateReview.views }
              : {}),
          },
          audits: [
            {
              entityType: 'MedicalFacility',
              entityId: String(id),
              action: 'facility_revision_verified',
              fromStatus,
              toStatus: 'verified',
              metadata: {
                version: revision.version,
                facilityRevision: facility.revision,
                ...(facility.googlePlaceId
                  ? { providerDataReviewedAgainstOfficialSource: true }
                  : {}),
              },
            },
            ...duplicateReview.audits,
          ],
        };
      },
    );
  }

  retireFacility(input: {
    id: string;
    reason: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<{ retired: true }> {
    return this.run(
      input,
      'facility.retire',
      {
        id: input.id,
        reason: input.reason,
        expectedRevision: input.expectedRevision,
      },
      async (session) => {
        const id = this.objectId(input.id);
        const current = await this.facilities
          .findOne({
            _id: id,
            status: { $in: ['draft', 'verified'] },
            revision: input.expectedRevision,
          })
          .session(session)
          .exec();
        if (!current)
          throw await this.notFoundOrConflict(
            id,
            input.expectedRevision,
            session,
          );
        const fromStatus = current.status;
        const transition = MedicalFacilityAggregate.retire({
          facility: this.facilityState(current),
          expectedRevision: input.expectedRevision,
          actorId: input.actorId,
          retiredAt: new Date(),
        });
        const draftRevisionId = transition.supersededDraftRevisionId;
        current.status = transition.facility.status;
        current.retiredBy = new Types.ObjectId(transition.facility.retiredBy);
        current.retiredAt = transition.facility.retiredAt;
        current.draftRevisionId = undefined;
        current.revision = transition.facility.revision;
        await current.save({ session });
        if (draftRevisionId)
          await this.revisions
            .updateOne(
              { _id: draftRevisionId, status: 'draft' },
              { $set: { status: 'superseded' } },
              { session },
            )
            .exec();
        return {
          result: { retired: true as const },
          audits: [
            {
              entityType: 'MedicalFacility',
              entityId: String(id),
              action: 'facility_retired',
              fromStatus,
              toStatus: 'retired',
              reason: input.reason,
              metadata: { revision: current.revision },
            },
          ],
        };
      },
    );
  }

  private async assertSpecialtiesActive(
    codes: string[],
    session: import('mongoose').ClientSession,
  ) {
    const count = await this.specialties
      .countDocuments({ code: { $in: codes }, status: 'active' })
      .session(session)
      .exec();
    if (count !== new Set(codes).size)
      throw new ConflictException('FACILITY_SPECIALTY_NOT_ACTIVE');
  }

  private async prepareDuplicateDecisions(input: {
    facilityId: Types.ObjectId;
    subject: FacilityDuplicateSubject;
    duplicateReview?: FacilityDuplicateReviewInput;
    existingReviews: Array<{
      candidateFacilityId: Types.ObjectId;
      reviewedBy: Types.ObjectId;
      reason: string;
      reviewedAt: Date;
    }>;
    actorId: string;
    session: import('mongoose').ClientSession;
    excludeFacilityId?: Types.ObjectId;
    includeStatuses: Array<'draft' | 'verified' | 'retired'>;
  }) {
    const review = validateDistinctFacilityReview(input.duplicateReview);
    const { candidates, truncated } = await this.findPossibleDuplicates({
      subject: input.subject,
      session: input.session,
      excludeFacilityId: input.excludeFacilityId,
      includeStatuses: input.includeStatuses,
    });
    const existing = input.existingReviews;
    const previouslyReviewed = new Set(
      existing.map((decision) => String(decision.candidateFacilityId)),
    );
    const submittedIds = review?.reviewedFacilityIds ?? [];
    const submittedObjectIds = submittedIds.map((id) => this.objectId(id));
    const currentCandidateIds = new Set(
      candidates.map((candidate) => candidate.id),
    );

    if (submittedObjectIds.some((id) => id.equals(input.facilityId)))
      throw new ConflictException('FACILITY_DUPLICATE_REVIEW_SELF_REFERENCE');
    if (submittedObjectIds.length) {
      const found = await this.facilities
        .countDocuments({
          _id: { $in: submittedObjectIds },
          status: { $in: ['draft', 'verified', 'retired'] },
        })
        .session(input.session)
        .exec();
      if (found !== submittedObjectIds.length)
        throw new ConflictException(
          'FACILITY_DUPLICATE_REVIEW_CANDIDATE_NOT_FOUND',
        );
    }

    // A confirmation must refer to a candidate returned by the current
    // duplicate check; otherwise stale UI state could persist an arbitrary pair.
    if (
      submittedIds.some(
        (id) => !previouslyReviewed.has(id) && !currentCandidateIds.has(id),
      )
    )
      throw new FacilityDuplicateReviewCandidateMismatchError();

    const explicitlyReviewed = new Set(submittedIds);
    const outstanding = candidates.filter(
      (candidate) =>
        !previouslyReviewed.has(candidate.id) &&
        !explicitlyReviewed.has(candidate.id),
    );
    if (truncated || outstanding.length)
      throw new FacilityDuplicateReviewRequiredError(
        truncated ? candidates : outstanding,
        truncated,
      );

    const newIds = submittedIds.filter((id) => !previouslyReviewed.has(id));
    const decidedAt = new Date();
    const decisions = newIds.map((candidateFacilityId) => ({
      candidateFacilityId: this.objectId(candidateFacilityId),
      reviewedBy: this.objectId(input.actorId),
      reason: review!.reason,
      reviewedAt: decidedAt,
    }));
    if (existing.length + decisions.length > FACILITY_DUPLICATE_CANDIDATE_LIMIT)
      throw new ConflictException('FACILITY_DUPLICATE_REVIEW_LIMIT_REACHED');
    const decisionViews = [
      ...existing.map((decision) => this.duplicateDecisionView(decision)),
      ...decisions.map((decision) => this.duplicateDecisionView(decision)),
    ];
    const audits =
      decisions.length && review
        ? [
            {
              entityType: 'MedicalFacility',
              entityId: String(input.facilityId),
              action: 'facility_possible_duplicates_confirmed_distinct',
              reason: review.reason,
              metadata: {
                reviewedFacilityIds: newIds.join(','),
                decisionCount: decisions.length,
              },
            },
          ]
        : [];
    return { decisions, views: decisionViews, audits };
  }

  private async findPossibleDuplicates(input: {
    subject: FacilityDuplicateSubject;
    session: import('mongoose').ClientSession;
    excludeFacilityId?: Types.ObjectId;
    includeStatuses: Array<'draft' | 'verified' | 'retired'>;
  }): Promise<{ candidates: PossibleFacilityDuplicate[]; truncated: boolean }> {
    const tokens = facilityDuplicateSearchTokens(input.subject);
    const alternatives: Record<string, unknown>[] = [];
    if (tokens.length)
      alternatives.push({ duplicateSearchTokens: { $in: tokens } });
    const point = this.geoPoint(input.subject.location);
    if (point)
      alternatives.push({
        duplicateLocation: {
          $geoWithin: {
            $centerSphere: [
              point.coordinates,
              FACILITY_DUPLICATE_NEARBY_METERS / 6_371_000,
            ],
          },
        },
      });
    if (!alternatives.length) return { candidates: [], truncated: false };

    const filter: Record<string, unknown> = {
      status: { $in: input.includeStatuses },
      $or: alternatives,
    };
    if (input.excludeFacilityId) filter._id = { $ne: input.excludeFacilityId };
    const roots = await this.facilities
      .find(filter)
      .sort({ _id: 1 })
      .limit(FACILITY_DUPLICATE_CANDIDATE_LIMIT * 4 + 1)
      .session(input.session)
      .lean()
      .exec();
    const scannedLimit = FACILITY_DUPLICATE_CANDIDATE_LIMIT * 4;
    const truncated = roots.length > scannedLimit;
    const boundedRoots = roots.slice(0, scannedLimit);
    const draftIds = boundedRoots
      .filter((row) => row.status === 'draft' && row.draftRevisionId)
      .map((row) => row.draftRevisionId!)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const draftRevisions = draftIds.length
      ? await this.revisions
          .find({ _id: { $in: draftIds }, status: 'draft' })
          .session(input.session)
          .select('facilityId details')
          .lean()
          .exec()
      : [];
    const draftById = new Map(
      draftRevisions.map((revision) => [
        String(revision.facilityId),
        revision.details,
      ]),
    );
    const matches: PossibleFacilityDuplicate[] = [];
    for (const row of boundedRoots) {
      const details =
        row.status === 'draft'
          ? (draftById.get(String(row._id)) as Record<string, any> | undefined)
          : undefined;
      const subject: FacilityDuplicateSubject = {
        id: String(row._id),
        status: row.status,
        revision: row.revision,
        googlePlaceId: row.googlePlaceId,
        name: details?.name ?? row.name,
        address: details?.address ?? row.address,
        location: details?.location ?? row.location ?? row.duplicateLocation,
      };
      const reasonCodes = findDuplicateReasons(input.subject, subject);
      if (!reasonCodes.length) continue;
      const distanceMeters = facilityDuplicateDistanceMeters(
        input.subject.location,
        subject.location,
      );
      matches.push({
        id: String(row._id),
        status: row.status,
        revision: row.revision,
        ...(subject.name ? { name: subject.name } : {}),
        ...(subject.address && typeof subject.address !== 'string'
          ? { address: subject.address }
          : {}),
        ...(row.googlePlaceId ? { googlePlaceId: row.googlePlaceId } : {}),
        reasonCodes,
        ...(distanceMeters !== undefined ? { distanceMeters } : {}),
      });
    }
    matches.sort((left, right) => {
      const reasonDifference =
        right.reasonCodes.length - left.reasonCodes.length;
      if (reasonDifference) return reasonDifference;
      const distanceDifference =
        (left.distanceMeters ?? Number.POSITIVE_INFINITY) -
        (right.distanceMeters ?? Number.POSITIVE_INFINITY);
      if (distanceDifference) return distanceDifference;
      return left.id.localeCompare(right.id);
    });
    const hasMoreMatches = matches.length > FACILITY_DUPLICATE_CANDIDATE_LIMIT;
    return {
      candidates: matches.slice(0, FACILITY_DUPLICATE_CANDIDATE_LIMIT),
      truncated: truncated || hasMoreMatches,
    };
  }

  private duplicateDecisionView(row: Record<string, any>) {
    return {
      candidateFacilityId: String(row.candidateFacilityId),
      reason: row.reason,
      reviewedBy: String(row.reviewedBy),
      reviewedAt: new Date(row.reviewedAt).toISOString(),
    };
  }

  private async placeIdOwnerProjection(
    row: Record<string, any>,
    session?: import('mongoose').ClientSession,
  ): Promise<FacilityAdminRecord> {
    let details: Record<string, any> | undefined;
    if (row.status === 'draft' && row.draftRevisionId) {
      const query = this.revisions
        .findOne({
          _id: row.draftRevisionId,
          facilityId: row._id,
          status: 'draft',
        })
        .select('details');
      if (session) query.session(session);
      details = (await query.lean().exec())?.details as Record<string, any>;
    }
    return {
      id: String(row._id),
      status: row.status,
      revision: row.revision,
      ...(row.googlePlaceId ? { googlePlaceId: row.googlePlaceId } : {}),
      ...((details?.name ?? row.name) || (details?.address ?? row.address)
        ? {
            details: {
              ...((details?.name ?? row.name)
                ? { name: details?.name ?? row.name }
                : {}),
              ...((details?.address ?? row.address)
                ? { address: details?.address ?? row.address }
                : {}),
            },
          }
        : {}),
    } as FacilityAdminRecord;
  }

  private geoPoint(
    location: FacilityDuplicateSubject['location'],
  ): { type: 'Point'; coordinates: [number, number] } | undefined {
    if (!location) return undefined;
    const coordinates =
      'coordinates' in location
        ? location.coordinates
        : [location.longitude, location.latitude];
    const [longitude, latitude] = coordinates;
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    )
      return undefined;
    return { type: 'Point', coordinates: [longitude, latitude] };
  }

  private facilityState(row: MedicalFacilityDocument) {
    return {
      id: String(row._id),
      status: row.status,
      revision: row.revision,
      ...(row.currentRevisionId
        ? { currentRevisionId: String(row.currentRevisionId) }
        : {}),
      ...(row.draftRevisionId
        ? { draftRevisionId: String(row.draftRevisionId) }
        : {}),
    };
  }
  private revisionState(row: MedicalFacilityRevisionDocument) {
    return {
      id: String(row._id),
      facilityId: String(row.facilityId),
      version: row.version,
      revision: row.revision,
      status: row.status,
      details: row.details as unknown as FacilityDetails,
    };
  }
  private async adminRecord(
    row: Record<string, any>,
  ): Promise<FacilityAdminRecord> {
    const [current, draft] = await Promise.all([
      row.currentRevisionId
        ? this.revisions
            .findById(row.currentRevisionId)
            .select('details')
            .lean()
            .exec()
        : null,
      row.draftRevisionId
        ? this.revisions
            .findById(row.draftRevisionId)
            .select('details')
            .lean()
            .exec()
        : null,
    ]);
    const currentDetails =
      current?.details && Object.keys(current.details).length
        ? (current.details as unknown as FacilityDetails)
        : undefined;
    const draftDetails =
      draft?.details && Object.keys(draft.details).length
        ? (draft.details as unknown as FacilityDetails)
        : undefined;
    const fallback =
      !currentDetails && row.name
        ? this.detailsFromRoot(row as unknown as MedicalFacilityDocument)
        : undefined;
    return {
      ...this.toAdminRecord(
        row as unknown as MedicalFacilityDocument,
        draftDetails ?? currentDetails ?? fallback,
      ),
      ...((currentDetails ?? fallback)
        ? { currentDetails: currentDetails ?? fallback }
        : {}),
      ...(draftDetails ? { draftDetails } : {}),
    };
  }
  private toAdminRecord(
    row: MedicalFacilityDocument | Record<string, any>,
    details?: FacilityDraftDetails,
  ): FacilityAdminRecord {
    return {
      id: String(row._id),
      status: row.status,
      revision: row.revision,
      ...(row.googlePlaceId ? { googlePlaceId: row.googlePlaceId } : {}),
      ...(details ? { details } : {}),
      ...(row.currentRevisionId
        ? { currentRevisionId: String(row.currentRevisionId) }
        : {}),
      ...(row.draftRevisionId
        ? { draftRevisionId: String(row.draftRevisionId) }
        : {}),
      ...(row.lastCheckedAt
        ? { lastCheckedAt: new Date(row.lastCheckedAt).toISOString() }
        : {}),
      ...(row.verifiedAt
        ? { verifiedAt: new Date(row.verifiedAt).toISOString() }
        : {}),
      ...(row.duplicateReviews?.length
        ? {
            duplicateDecisions: row.duplicateReviews.map(
              (decision: Record<string, any>) =>
                this.duplicateDecisionView(decision),
            ),
          }
        : {}),
    };
  }
  private detailsFromRoot(row: MedicalFacilityDocument): FacilityDetails {
    return {
      name: row.name!,
      normalizedName: row.normalizedName!,
      facilityType: row.facilityType!,
      address: row.address!,
      location: row.location!,
      specialtyCodes: row.specialtyCodes,
      services: row.services,
      contact: row.contact,
      officialSourceUrl: row.officialSourceUrl!,
    };
  }
  private revisionRecord(
    row: MedicalFacilityRevisionDocument,
  ): FacilityRevisionRecord {
    return {
      id: String(row._id),
      facilityId: String(row.facilityId),
      version: row.version,
      revision: row.revision,
      status: row.status,
      details: row.details as unknown as FacilityDetails,
    };
  }
  private objectId(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('FACILITY_NOT_FOUND');
    return new Types.ObjectId(id);
  }
  private async notFoundOrConflict(
    id: Types.ObjectId,
    expectedRevision: number | undefined,
    session: import('mongoose').ClientSession,
  ) {
    const row = await this.facilities
      .findById(id)
      .select('revision')
      .session(session)
      .lean()
      .exec();
    return row
      ? new ConflictException('FACILITY_REVISION_CONFLICT')
      : new NotFoundException('FACILITY_NOT_FOUND');
  }
  private run<T extends object>(
    input: { actorId: string; key: string },
    operation: string,
    request: unknown,
    work: (session: import('mongoose').ClientSession) => Promise<{
      result: T;
      audits: import('./facility-command-transaction').FacilityAuditDraft[];
    }>,
  ): Promise<T> {
    return this.commands.run({
      actorId: input.actorId,
      operation,
      key: input.key,
      request,
      work,
    });
  }
}

function isUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: number; message?: string };
  return (
    candidate.code === 11000 ||
    candidate.message?.includes('CARE_DIRECTORY_UNIQUE_CONFLICT') === true
  );
}
