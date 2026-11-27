import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { UserRole } from '../src/core/domain/user.enums';
import { AdminMedicalFacilitiesController } from '../src/modules/care-directory/presentation/controllers/admin-medical-facilities.controller';
import { ManageMedicalFacilities } from '../src/modules/care-directory/application/use-cases/manage-medical-facilities.use-case';
import { ListMedicalSpecialties } from '../src/modules/care-directory/application/use-cases/list-medical-specialties.use-case';
import { SearchMedicalFacilities } from '../src/modules/care-directory/application/use-cases/search-medical-facilities.use-case';
import { GetMedicalFacility } from '../src/modules/care-directory/application/use-cases/get-medical-facility.use-case';
import { SearchMapFacilityCandidates } from '../src/modules/care-directory/application/use-cases/search-map-facility-candidates.use-case';
import { PatientMedicalFacilitiesController } from '../src/modules/care-directory/presentation/controllers/patient-medical-facilities.controller';
import {
  FacilityDuplicateReviewRequiredError,
  type PossibleFacilityDuplicate,
} from '../src/modules/care-directory/domain/policies/facility-duplicate-policy';

describe('Medical Facility Directory HTTP contract (e2e)', () => {
  let app: INestApplication<App>;
  const patientId = '507f1f77bcf86cd799439011';
  const specialties = {
    execute: jest.fn(async () => ({
      data: [{ code: 'cardiology', nameVi: 'Tim mạch' }],
    })),
  };
  const search = {
    execute: jest.fn(async () => ({
      data: {
        mappingStatus: 'matched',
        items: [],
        pagination: { page: 1, limit: 20, total: 0, hasNextPage: false },
      },
    })),
  };
  const detail = {
    execute: jest.fn(async () => ({
      data: {
        id: '507f1f77bcf86cd799439012',
        name: 'Synthetic Clinic',
        verificationLabel: 'verified',
      },
    })),
  };
  const external = {
    forPatient: jest.fn(async () => ({
      data: {
        source: 'google_maps',
        verifiedInternally: false,
        attribution: 'Google Maps',
        items: [],
      },
    })),
  };
  const adminAuthority = {
    isSuperAdmin: jest.fn(
      async (actorId: string) => actorId === 'synthetic-super-admin',
    ),
  };
  const adminFacilities = {
    listAdminFacilities: jest.fn(async () => ({ items: [], total: 0 })),
    createFacilityDraft: jest.fn(),
    findUpdateFacilityMetadataReplay: jest.fn(async () => null),
    getAdminFacility: jest.fn(async () => ({
      id: 'facility-1',
      status: 'verified',
      revision: 3,
    })),
    findFacilityByGooglePlaceId: jest.fn(async () => null),
    updateFacilityMetadata: jest.fn(
      async (input: { id: string; placeId: string }) => ({
        id: input.id,
        status: 'verified',
        revision: 4,
        googlePlaceId: input.placeId,
      }),
    ),
  };
  const mapProvider = {
    findPlace: jest.fn(async (placeId: string) => ({
      placeId,
      name: 'Synthetic Clinic',
      attribution: 'Google Maps' as const,
    })),
  };
  const adminUseCase = new ManageMedicalFacilities(
    adminFacilities as never,
    {} as never,
    adminAuthority as never,
    mapProvider as never,
    {
      get: (key: string, fallback?: unknown) =>
        key === 'FACILITY_DIRECTORY_ENABLED' ? true : fallback,
    } as never,
  );

  @Injectable()
  class HeaderUserGuard implements CanActivate {
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        user?: { sub: string; role: string };
      }>();
      const userId = request.headers['x-user-id'];
      if (!userId) return false;
      request.user = {
        sub: userId,
        role: request.headers['x-user-role'] ?? UserRole.PATIENT,
      };
      return true;
    }
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        PatientMedicalFacilitiesController,
        AdminMedicalFacilitiesController,
      ],
      providers: [
        { provide: ListMedicalSpecialties, useValue: specialties },
        { provide: SearchMedicalFacilities, useValue: search },
        { provide: GetMedicalFacility, useValue: detail },
        { provide: SearchMapFacilityCandidates, useValue: external },
        { provide: ManageMedicalFacilities, useValue: adminUseCase },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderUserGuard)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it('accepts Patient search criteria in the JSON body and returns an empty state', async () => {
    await request(app.getHttpServer())
      .post('/medical-facilities/search')
      .set('x-user-id', patientId)
      .send({ specialtyCode: 'cardiology', area: 'Quận 1', page: 1, limit: 20 })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([]);
        expect(body.data.pagination.total).toBe(0);
      });
    expect(search.execute).toHaveBeenCalledWith(
      patientId,
      expect.objectContaining({ specialtyCode: 'cardiology', area: 'Quận 1' }),
    );
  });

  it('keeps exact location in request body and rejects a non-Patient role', async () => {
    await request(app.getHttpServer())
      .post('/medical-facilities/search')
      .set('x-user-id', patientId)
      .send({
        specialtyCode: 'cardiology',
        location: { longitude: 106.7, latitude: 10.7 },
        locationConsent: true,
      })
      .expect(201);
    expect(search.execute).toHaveBeenLastCalledWith(
      patientId,
      expect.objectContaining({
        location: { longitude: 106.7, latitude: 10.7 },
        locationConsent: true,
      }),
    );

    await request(app.getHttpServer())
      .post('/medical-facilities/search')
      .set('x-user-id', patientId)
      .set('x-user-role', UserRole.DOCTOR)
      .send({ specialtyCode: 'cardiology', area: 'Quận 1' })
      .expect(403);
  });

  it('keeps internal detail and explicitly requested external results separate', async () => {
    await request(app.getHttpServer())
      .get('/medical-facilities/507f1f77bcf86cd799439012')
      .set('x-user-id', patientId)
      .expect(200);
    await request(app.getHttpServer())
      .post('/medical-facilities/external-search')
      .set('x-user-id', patientId)
      .send({ specialtyCode: 'cardiology', area: 'Quận 1' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.verifiedInternally).toBe(false);
        expect(body.data.attribution).toBe('Google Maps');
      });
    expect(external.forPatient).toHaveBeenCalledWith(
      patientId,
      expect.objectContaining({ specialtyCode: 'cardiology', area: 'Quận 1' }),
    );
  });

  it('requires both the canonical Admin role and super_admin authority for the Admin directory', async () => {
    adminFacilities.listAdminFacilities.mockClear();

    await request(app.getHttpServer())
      .get('/admin/medical-facilities')
      .set('x-user-id', 'synthetic-ai-manager')
      .set('x-user-role', UserRole.ADMIN)
      .expect(403);
    expect(adminFacilities.listAdminFacilities).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get('/admin/medical-facilities')
      .set('x-user-id', 'synthetic-patient')
      .set('x-user-role', UserRole.PATIENT)
      .expect(403);
    expect(adminFacilities.listAdminFacilities).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get('/admin/medical-facilities')
      .set('x-user-id', 'synthetic-super-admin')
      .set('x-user-role', UserRole.ADMIN)
      .expect(200)
      .expect(({ body }) => expect(body.data.items).toEqual([]));
    expect(adminFacilities.listAdminFacilities).toHaveBeenCalledTimes(1);
  });

  it('validates and routes a Place ID link through the super_admin application use case', async () => {
    await request(app.getHttpServer())
      .patch('/admin/medical-facilities/facility-1')
      .set('x-user-id', 'synthetic-super-admin')
      .set('x-user-role', UserRole.ADMIN)
      .set('Idempotency-Key', 'synthetic-place-link-key-0001')
      .send({ placeId: 'synthetic-place-1', expectedRevision: 3 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          id: 'facility-1',
          revision: 4,
          googlePlaceId: 'synthetic-place-1',
        });
      });
    expect(mapProvider.findPlace).toHaveBeenCalledWith(
      'synthetic-place-1',
      'synthetic-super-admin',
    );
    expect(adminFacilities.updateFacilityMetadata).toHaveBeenCalledWith({
      id: 'facility-1',
      placeId: 'synthetic-place-1',
      expectedRevision: 3,
      actorId: 'synthetic-super-admin',
      key: 'synthetic-place-link-key-0001',
    });
  });

  it('rejects an empty duplicate-review candidate list at the HTTP boundary', async () => {
    await request(app.getHttpServer())
      .post('/admin/medical-facilities')
      .set('x-user-id', 'synthetic-super-admin')
      .set('x-user-role', UserRole.ADMIN)
      .set('Idempotency-Key', 'synthetic-duplicate-review-invalid')
      .send({
        details: { name: 'Synthetic clinic' },
        duplicateReview: {
          confirmedDistinct: true,
          reason: 'Đã rà soát và xác nhận khác cơ sở.',
          reviewedFacilityIds: [],
        },
      })
      .expect(400);
  });

  it('returns bounded duplicate candidates and accepts a pair-specific review on retry', async () => {
    const candidate: PossibleFacilityDuplicate = {
      id: '507f1f77bcf86cd799439099',
      status: 'verified',
      revision: 2,
      name: 'Phòng khám Minh An',
      reasonCodes: ['similar_name', 'similar_address'],
    };
    adminFacilities.createFacilityDraft
      .mockRejectedValueOnce(
        new FacilityDuplicateReviewRequiredError([candidate], false),
      )
      .mockResolvedValueOnce({
        id: '507f1f77bcf86cd799439098',
        status: 'draft',
        revision: 1,
      });

    await request(app.getHttpServer())
      .post('/admin/medical-facilities')
      .set('x-user-id', 'synthetic-super-admin')
      .set('x-user-role', UserRole.ADMIN)
      .set('Idempotency-Key', 'synthetic-duplicate-create-first')
      .send({ details: { name: 'Phòng khám Minh An' } })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('FACILITY_POSSIBLE_DUPLICATE');
        expect(body.details.candidates).toEqual([candidate]);
        expect(body.details.truncated).toBe(false);
      });

    await request(app.getHttpServer())
      .post('/admin/medical-facilities')
      .set('x-user-id', 'synthetic-super-admin')
      .set('x-user-role', UserRole.ADMIN)
      .set('Idempotency-Key', 'synthetic-duplicate-create-reviewed')
      .send({
        details: { name: 'Phòng khám Minh An' },
        duplicateReview: {
          confirmedDistinct: true,
          reason: 'Hai cơ sở hoạt động tại hai địa chỉ khác nhau.',
          reviewedFacilityIds: [candidate.id],
        },
      })
      .expect(201);

    expect(adminFacilities.createFacilityDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        duplicateReview: expect.objectContaining({
          reviewedFacilityIds: [candidate.id],
        }),
      }),
    );
  });
});
