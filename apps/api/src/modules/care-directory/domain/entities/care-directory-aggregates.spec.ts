import { DiseaseSpecialtyMappingAggregate } from './disease-specialty-mapping.aggregate';
import { CareDirectoryInvariantError, MedicalFacilityAggregate } from './medical-facility.aggregate';
import { MedicalSpecialtyAggregate } from './medical-specialty.aggregate';
import type { FacilityDetails } from '../care-directory.types';

const facilityDetails: FacilityDetails = {
  name: 'Phòng khám tổng hợp', normalizedName: 'phòng khám tổng hợp', facilityType: 'clinic',
  address: { district: 'Quận 1', province: 'Thành phố Hồ Chí Minh', provinceCode: 'HCMC', country: 'VN' },
  location: { type: 'Point', coordinates: [106.7, 10.77] }, specialtyCodes: ['cardiology'],
  contact: { phone: '0000000000' }, officialSourceUrl: 'https://example.org/official',
};

describe('Care Directory domain aggregates', () => {
  it('keeps Facility verified projection until an approved draft revision transition', () => {
    const created = MedicalFacilityAggregate.createDraft({ id: 'facility-1', revisionId: 'revision-1', details: facilityDetails, actorId: 'admin-1' });
    expect(created.facility.status).toBe('draft');
    const verified = MedicalFacilityAggregate.verifyRevision({
      facility: { ...created.facility, currentRevisionId: undefined },
      revision: { ...created.revision }, details: facilityDetails, actorId: 'admin-1', verifiedAt: new Date('2026-11-26T00:00:00.000Z'),
    });
    expect(verified.facility.status).toBe('verified');
    expect(verified.facility.currentRevisionId).toBe('revision-1');

    const next = MedicalFacilityAggregate.createRevision({ facility: verified.facility, currentDetails: facilityDetails, revisionId: 'revision-2', version: 2, actorId: 'admin-1' });
    const edit = MedicalFacilityAggregate.updateDraft({ facility: next.facility, revision: next.revision, revisionId: 'revision-2', expectedRevision: next.facility.revision, details: { ...facilityDetails, name: 'Bản nháp mới' }, actorId: 'admin-1' });
    expect(edit.facility.revision).toBe(next.facility.revision + 1);
    expect(next.facility.currentRevisionId).toBe('revision-1');
    expect(edit.revision.details.name).toBe('Bản nháp mới');
  });

  it('rejects editing a stale or terminal Facility revision', () => {
    expect(() => MedicalFacilityAggregate.retire({ facility: { id: 'f', status: 'retired', revision: 2 }, expectedRevision: 2, actorId: 'admin', retiredAt: new Date() })).toThrow(CareDirectoryInvariantError);
    expect(() => MedicalFacilityAggregate.updateDraft({
      facility: { id: 'f', status: 'draft', revision: 3, draftRevisionId: 'r' },
      revision: { id: 'r', facilityId: 'f', version: 1, revision: 1, status: 'draft', details: facilityDetails },
      revisionId: 'r', expectedRevision: 2, details: facilityDetails, actorId: 'admin',
    })).toThrow('FACILITY_REVISION_CONFLICT');
  });

  it('publishes a new mapping version while retiring the former version atomically', () => {
    const candidate = DiseaseSpecialtyMappingAggregate.createDraft({ id: 'mapping-2', scope: 'program', scopeKey: 'hypertension', version: 2, specialtyCodes: ['cardiology'], sourceReferences: ['https://example.org/source'] });
    const previous = { ...candidate, id: 'mapping-1', version: 1, status: 'published' as const, revision: 4 };
    const transition = DiseaseSpecialtyMappingAggregate.publish({ candidate, previous, expectedRevision: 1, actorId: 'admin-1', publishedAt: new Date('2026-11-26T00:00:00.000Z') });
    expect(transition.candidate).toMatchObject({ status: 'published', revision: 2, publishedBy: 'admin-1' });
    expect(transition.previous).toMatchObject({ status: 'retired', revision: 5, retiredBy: 'admin-1' });
  });

  it('only updates an active specialty at the expected revision', () => {
    expect(MedicalSpecialtyAggregate.retire({ current: { code: 'cardiology', nameVi: 'Tim mạch', synonyms: [], status: 'active', revision: 3 }, expectedRevision: 3, actorId: 'admin-1' })).toEqual({ status: 'retired', updatedBy: 'admin-1', revision: 4 });
    expect(() => MedicalSpecialtyAggregate.retire({ current: { code: 'cardiology', nameVi: 'Tim mạch', synonyms: [], status: 'retired', revision: 3 }, expectedRevision: 3, actorId: 'admin-1' })).toThrow('SPECIALTY_STATE_CONFLICT');
  });
});
