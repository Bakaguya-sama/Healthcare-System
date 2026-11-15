import { createHash } from 'node:crypto';

export const CARE_REPORT_EXPORT_RENDERER_VERSION = 'care-report-export.v1';

export type CareReportExportProjection = {
  schemaVersion: 'care-report-export.v1';
  audience: 'patient' | 'doctor';
  report: {
    id: string;
    type: string;
    version: number;
    status: string;
    windowStart: string;
    windowEnd: string;
    timezone: string;
    dataUntil: string;
    generatedAt: string;
  };
  statistics: Record<string, unknown>;
  trends: Record<string, unknown>;
  missingData: unknown[];
  healthEvaluationSummary: Record<string, unknown>;
  consultationSummary: Record<string, unknown> | null;
  provenance: {
    inputHash: string;
    sourceCounts: Record<string, number>;
    sourceReferences?: Record<string, string[]>;
  };
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}

function json(value: unknown) {
  return JSON.stringify(stable(value));
}

function csvCell(value: string) {
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function renderCareReportCsv(input: CareReportExportProjection): Buffer {
  const fields = [
    input.schemaVersion,
    input.audience,
    input.report.id,
    input.report.type,
    String(input.report.version),
    input.report.status,
    input.report.windowStart,
    input.report.windowEnd,
    input.report.timezone,
    input.report.dataUntil,
    input.report.generatedAt,
    json(input.statistics),
    json(input.trends),
    json(input.missingData),
    json(input.healthEvaluationSummary),
    json(input.consultationSummary),
    input.provenance.inputHash,
    json(input.provenance.sourceCounts),
    json(input.provenance.sourceReferences ?? {}),
  ];
  const header = [
    'schema_version',
    'audience',
    'report_id',
    'report_type',
    'report_version',
    'report_status',
    'window_start',
    'window_end',
    'timezone',
    'data_until',
    'generated_at',
    'statistics_json',
    'trends_json',
    'missing_data_json',
    'health_evaluation_summary_json',
    'consultation_summary_json',
    'input_hash',
    'source_counts_json',
    'source_references_json',
  ];
  return Buffer.from(
    `${header.map(csvCell).join(',')}\r\n${fields.map(csvCell).join(',')}\r\n`,
    'utf8',
  );
}

function pdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrap(value: string, width = 95) {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let remaining = paragraph;
    while (remaining.length > width) {
      let split = remaining.lastIndexOf(' ', width);
      if (split < 1) split = width;
      lines.push(remaining.slice(0, split));
      remaining = remaining.slice(split).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

export function renderCareReportPdf(input: CareReportExportProjection): Buffer {
  const body = [
    'CARE REPORT',
    `Report: ${input.report.id} / ${input.report.type} / v${input.report.version}`,
    `Audience: ${input.audience}`,
    `Window: ${input.report.windowStart} - ${input.report.windowEnd} (${input.report.timezone})`,
    `Data until: ${input.report.dataUntil}`,
    '',
    'Statistics',
    json(input.statistics),
    '',
    'Trends',
    json(input.trends),
    '',
    'Missing data',
    json(input.missingData),
    '',
    'Health evaluation summary',
    json(input.healthEvaluationSummary),
    '',
    'Consultation summary',
    json(input.consultationSummary),
    '',
    `Input hash: ${input.provenance.inputHash}`,
  ].flatMap((line) => wrap(line));
  const pages: string[][] = [];
  for (let i = 0; i < body.length; i += 48) pages.push(body.slice(i, i + 48));
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  const add = (value: string) => (objects.push(value), objects.length);
  const catalogId = add('');
  const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const content = `BT\n/F1 9 Tf\n50 790 Td\n${pageLines
      .map((line, index) => `${index ? '0 -15 Td\n' : ''}(${pdfText(line)}) Tj`)
      .join('\n')}\nET`;
    const contentId = add(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /ID [<${createHash('md5').update(json(input)).digest('hex')}> <${createHash('md5').update(json(input)).digest('hex')}>] >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, 'latin1');
}
