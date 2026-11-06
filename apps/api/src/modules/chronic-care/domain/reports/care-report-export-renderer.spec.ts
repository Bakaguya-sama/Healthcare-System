import {
  type CareReportExportProjection,
  renderCareReportCsv,
  renderCareReportPdf,
} from './care-report-export-renderer';

const projection: CareReportExportProjection = {
  schemaVersion: 'care-report-export.v1',
  audience: 'patient',
  report: {
    id: '012345678901234567890123',
    type: 'weekly',
    version: 1,
    status: 'ready',
    windowStart: '2026-11-01T00:00:00.000Z',
    windowEnd: '2026-11-08T00:00:00.000Z',
    timezone: 'Asia/Saigon',
    dataUntil: '2026-11-08T00:00:00.000Z',
    generatedAt: '2026-11-08T00:01:00.000Z',
  },
  statistics: { note: '=SUM(A1:A2)', tasks: { completed: 2 } },
  trends: { direction: 'stable' },
  missingData: [],
  healthEvaluationSummary: { total: 1, bySeverity: { normal: 1 } },
  consultationSummary: null,
  provenance: { inputHash: 'a'.repeat(64), sourceCounts: { metrics: 2 } },
};

describe('CareReport export renderer v1', () => {
  it('renders deterministic, explicit CSV columns without object string coercion', () => {
    const first = renderCareReportCsv(projection).toString('utf8');
    expect(renderCareReportCsv(projection).toString('utf8')).toBe(first);
    expect(first).toContain('"schema_version"');
    expect(first).toContain('"statistics_json"');
    expect(first).not.toContain('[object Object]');
    expect(first).toContain('""note"":""=SUM(A1:A2)""');
  });

  it('renders a deterministic PDF document with a valid header and trailer', () => {
    const first = renderCareReportPdf(projection);
    const second = renderCareReportPdf(projection);
    expect(first.equals(second)).toBe(true);
    expect(first.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(first.toString('latin1')).toContain('%%EOF');
    expect(first.toString('latin1')).toContain('CARE REPORT');
  });
});
