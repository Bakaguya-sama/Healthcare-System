import { HttpException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
import { CareSummaryService } from './care-summary.service';

const reportId = new Types.ObjectId().toHexString();
const report = {
  patientCareProgramId: new Types.ObjectId(),
  patientId: new Types.ObjectId(),
  careRuleId: new Types.ObjectId(),
  summaryInput: {
    reportWindow: {
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-10-08T00:00:00.000Z',
      timezone: 'Asia/Saigon',
      dataUntil: '2026-10-08T00:00:00.000Z',
    },
    facts: {
      statistics: { systolic: { average: 120 } },
      trends: {},
      missingData: [],
      healthEvaluations: {},
      consultations: null,
    },
    provenance: { inputHash: 'input-hash', reportVersion: 1, sourceCounts: {} },
  },
};

describe('CareSummaryService', () => {
  function setup(narrative: unknown) {
    const summaries = {
      findOne: jest.fn(() => ({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      })),
      create: jest.fn((value) => Promise.resolve(value)),
    };
    const reports = { get: jest.fn(() => Promise.resolve(report)) };
    const narrator = { generate: jest.fn(() => Promise.resolve(narrative)) };
    return {
      service: new CareSummaryService(
        summaries as never,
        reports as never,
        narrator,
      ),
      summaries,
      reports,
      narrator,
    };
  }

  it('persists fallback when the provider output invents a number', async () => {
    const { service, summaries } = setup({
      overview: 'Average is 121.',
      observations: [],
      missingData: [],
      alertsToMention: [],
      questionsForDoctor: [],
      disclaimer: 'Informational only.',
    });
    const result = await service.generate(
      { id: String(report.patientId), role: UserRole.PATIENT },
      reportId,
    );
    if (!result) throw new Error('summary was not persisted');
    expect(result.status).toBe('fallback');
    expect(result.validation.reasonCodes).toEqual([
      'summary_grounding_invalid',
    ]);
    expect(summaries.create).toHaveBeenCalledTimes(1);
  });

  it('persists a grounded structured narrative', async () => {
    const { service } = setup({
      overview: 'Average is 120.',
      observations: [],
      missingData: [],
      alertsToMention: [],
      questionsForDoctor: [],
      disclaimer: 'Informational only.',
    });
    const result = await service.generate(
      { id: String(report.patientCareProgramId), role: UserRole.DOCTOR },
      reportId,
      'doctor',
    );
    if (!result) throw new Error('summary was not persisted');
    expect(result.status).toBe('generated');
    expect(result.provider).toBe('gemini');
  });

  it('does not allow a patient to request the doctor projection', async () => {
    const { service, reports } = setup({});
    await expect(
      service.generate(
        { id: String(report.patientId), role: UserRole.PATIENT },
        reportId,
        'doctor',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(reports.get).not.toHaveBeenCalled();
  });

  it('uses fallback when the provider is unavailable', async () => {
    const { service, narrator } = setup({});
    narrator.generate.mockRejectedValueOnce(new Error('provider timeout'));
    const result = await service.generate(
      { id: String(report.patientId), role: UserRole.PATIENT },
      reportId,
    );
    if (!result) throw new Error('summary was not persisted');
    expect(result.status).toBe('fallback');
    expect(result.validation.reasonCodes).toEqual([
      'summary_provider_unavailable',
    ]);
  });

  it('returns a prior summary without calling the provider again', async () => {
    const prior = { _id: new Types.ObjectId(), status: 'generated' };
    const { service, summaries, narrator } = setup({});
    summaries.findOne.mockReturnValueOnce({
      lean: () => ({ exec: () => Promise.resolve(prior) }),
    } as never);
    await expect(
      service.generate(
        { id: String(report.patientId), role: UserRole.PATIENT },
        reportId,
      ),
    ).resolves.toEqual(prior);
    expect(narrator.generate).not.toHaveBeenCalled();
  });
});
