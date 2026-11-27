import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { CareDirectoryQueryRepository } from '../../application/ports/care-directory.ports';
import type {
  FacilitySearchCriteria,
  FacilitySearchItem,
  FacilitySearchPage,
  SpecialtyMappingRecord,
  SpecialtyRecord,
} from '../../domain/care-directory.types';
import { facilityNeedsRecheck } from '../../domain/policies/facility-policy';
import {
  DiseaseSpecialtyMapping,
  DiseaseSpecialtyMappingDocument,
} from './disease-specialty-mapping.schema';
import {
  MedicalFacility,
  MedicalFacilityDocument,
} from './medical-facility.schema';
import {
  MedicalSpecialty,
  MedicalSpecialtyDocument,
} from './medical-specialty.schema';

@Injectable()
export class MongooseCareDirectoryQueryRepository implements CareDirectoryQueryRepository {
  constructor(
    @InjectModel(MedicalSpecialty.name)
    private readonly specialties: Model<MedicalSpecialtyDocument>,
    @InjectModel(DiseaseSpecialtyMapping.name)
    private readonly mappings: Model<DiseaseSpecialtyMappingDocument>,
    @InjectModel(MedicalFacility.name)
    private readonly facilities: Model<MedicalFacilityDocument>,
  ) {}

  async listActiveSpecialties(): Promise<SpecialtyRecord[]> {
    const rows = await this.specialties
      .find({ status: 'active' })
      .select('code nameVi synonyms status revision')
      .sort({ nameVi: 1, code: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({
      code: row.code,
      nameVi: row.nameVi,
      synonyms: row.synonyms ?? [],
      status: row.status,
      revision: row.revision,
    }));
  }

  async getActiveSpecialty(code: string): Promise<SpecialtyRecord | null> {
    const row = await this.specialties
      .findOne({ code, status: 'active' })
      .select('code nameVi synonyms status revision')
      .lean()
      .exec();
    return row
      ? {
          code: row.code,
          nameVi: row.nameVi,
          synonyms: row.synonyms ?? [],
          status: row.status,
          revision: row.revision,
        }
      : null;
  }

  async findPublishedMapping(
    scope: 'program' | 'disease',
    scopeKey: string,
  ): Promise<SpecialtyMappingRecord | null> {
    const row = await this.mappings
      .findOne({ scope, scopeKey: scopeKey.toLowerCase(), status: 'published' })
      .lean()
      .exec();
    return row ? mappingRecord(row) : null;
  }

  async searchVerifiedFacilities(
    criteria: FacilitySearchCriteria,
  ): Promise<FacilitySearchPage> {
    const filter: Record<string, unknown> = {
      status: 'verified',
      'address.provinceCode': 'HCMC',
      specialtyCodes: { $in: criteria.specialtyCodes },
    };
    if (criteria.area) {
      const escaped = criteria.area
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { 'address.district': { $regex: escaped, $options: 'i' } },
        { 'address.ward': { $regex: escaped, $options: 'i' } },
        { 'address.street': { $regex: escaped, $options: 'i' } },
      ];
    }
    const skip = (criteria.page - 1) * criteria.limit;
    let rows: Array<Record<string, any>>;
    let total: number;
    if (criteria.location) {
      const result = await this.facilities
        .aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [
                  criteria.location.longitude,
                  criteria.location.latitude,
                ],
              },
              key: 'location',
              distanceField: 'distanceMeters',
              maxDistance: criteria.radiusKm * 1000,
              spherical: true,
              query: filter,
            },
          },
          {
            $facet: {
              items: [
                { $sort: { distanceMeters: 1, normalizedName: 1, _id: 1 } },
                { $skip: skip },
                { $limit: criteria.limit },
              ],
              count: [{ $count: 'total' }],
            },
          },
        ])
        .exec();
      rows = result[0]?.items ?? [];
      total = result[0]?.count?.[0]?.total ?? 0;
    } else {
      const [items, count] = await Promise.all([
        this.facilities
          .find(filter)
          .select(
            'name normalizedName facilityType address location specialtyCodes contact officialSourceUrl verifiedAt lastCheckedAt',
          )
          .sort({ normalizedName: 1, _id: 1 })
          .skip(skip)
          .limit(criteria.limit)
          .lean()
          .exec(),
        this.facilities.countDocuments(filter).exec(),
      ]);
      rows = items as unknown as Array<Record<string, any>>;
      total = count;
    }
    const items: FacilitySearchItem[] = rows.map((row) => {
      const matched = (row.specialtyCodes as string[])
        .filter((code) => criteria.specialtyCodes.includes(code))
        .sort();
      const lastCheckedAt = row.lastCheckedAt as Date;
      const stale = facilityNeedsRecheck(
        lastCheckedAt,
        criteria.now,
        criteria.staleAfterDays,
      );
      return {
        id: String(row._id),
        name: String(row.name),
        facilityType: row.facilityType,
        address: row.address,
        matchedSpecialtyCodes: matched,
        ...(row.contact ? { contact: row.contact } : {}),
        ...(typeof row.distanceMeters === 'number'
          ? { distanceMeters: Math.round(row.distanceMeters) }
          : {}),
        source: 'officially_verified_internal',
        verificationLabel: stale ? 'needs_recheck' : 'verified',
        lastCheckedAt: lastCheckedAt.toISOString(),
        reasonCode: `${criteria.reasonCode}_specialty_match${criteria.location ? '_nearby' : ''}`,
      };
    });
    return {
      items,
      pagination: {
        page: criteria.page,
        limit: criteria.limit,
        total,
        hasNextPage: skip + items.length < total,
      },
    };
  }

  async getVerifiedFacility(
    id: string,
    now: Date,
    staleAfterDays: number,
  ): Promise<Record<string, unknown> | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const row = await this.facilities
      .findOne({ _id: new Types.ObjectId(id), status: 'verified' })
      .select(
        'name facilityType address location specialtyCodes services contact officialSourceUrl verifiedAt lastCheckedAt',
      )
      .lean()
      .exec();
    if (!row || !row.lastCheckedAt) return null;
    return {
      id: String(row._id),
      name: row.name,
      facilityType: row.facilityType,
      address: row.address,
      location: row.location,
      specialtyCodes: row.specialtyCodes,
      services: row.services ?? [],
      contact: row.contact,
      source: {
        type: 'officially_verified_internal',
        reference: row.officialSourceUrl,
      },
      verificationLabel: facilityNeedsRecheck(
        row.lastCheckedAt,
        now,
        staleAfterDays,
      )
        ? 'needs_recheck'
        : 'verified',
      verifiedAt: row.verifiedAt?.toISOString(),
      lastCheckedAt: row.lastCheckedAt.toISOString(),
    };
  }
}

function mappingRecord(
  row: DiseaseSpecialtyMappingDocument & { _id: Types.ObjectId },
): SpecialtyMappingRecord {
  return {
    id: String(row._id),
    scope: row.scope,
    scopeKey: row.scopeKey,
    version: row.version,
    revision: row.revision,
    status: row.status,
    specialtyCodes: row.specialtyCodes,
    sourceReferences: row.sourceReferences,
    ...(row.publishedAt ? { publishedAt: row.publishedAt.toISOString() } : {}),
  };
}
