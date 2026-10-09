import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
import {
  CARE_SUMMARY_NARRATIVE_PORT,
  type CareSummaryNarrativePort,
} from '../../../ai-advisory/public-api';
import {
  CareSummary,
  CareSummaryDocument,
  CareSummaryStatus,
} from '../../domain/entities/care-summary.entity';
import {
  createDeterministicCareSummary,
  isNumericallyGrounded,
  validateCareSummaryContent,
} from '../../domain/summaries/care-summary-content';
import type { SummaryInputV1 } from '../../domain/reports/summary-input-v1';
import type { CareActor } from './care-program-rule.service';
import { CareReportService } from './care-report.service';

const PROMPT_VERSION = 'care-summary-v1';

@Injectable()
export class CareSummaryService {
  constructor(
    @InjectModel(CareSummary.name)
    private readonly summaries: Model<CareSummaryDocument>,
    private readonly reports: CareReportService,
    @Inject(CARE_SUMMARY_NARRATIVE_PORT)
    private readonly narrator: CareSummaryNarrativePort,
  ) {}

  async generate(
    actor: CareActor,
    reportId: string,
    requestedAudience?: 'patient' | 'doctor',
  ) {
    const audience =
      requestedAudience ??
      (actor.role === UserRole.DOCTOR ? 'doctor' : 'patient');
    if (actor.role === UserRole.PATIENT && audience !== 'patient')
      throw new HttpException(
        { code: 'CARE_FORBIDDEN', message: 'Care summary access is forbidden' },
        HttpStatus.FORBIDDEN,
      );
    const report = await this.reports.get(actor, reportId);
    const summaryInput = report.summaryInput as SummaryInputV1;
    const uniqueKey = `${reportId}:${audience}:${PROMPT_VERSION}`;
    const existing = await this.summaries.findOne({ uniqueKey }).lean().exec();
    if (existing) return existing;
    const startedAt = Date.now();
    let status = CareSummaryStatus.GENERATED;
    let reasonCodes: string[] = [];
    let content;
    try {
      const generated = await this.narrator.generate({
        audience,
        reportWindow: summaryInput.reportWindow,
        facts: summaryInput.facts,
      });
      const checked = validateCareSummaryContent(generated);
      if (
        !checked.valid ||
        !checked.content ||
        !isNumericallyGrounded(checked.content, summaryInput.facts)
      ) {
        status = CareSummaryStatus.FALLBACK;
        reasonCodes = checked.valid
          ? ['summary_grounding_invalid']
          : checked.reasonCodes;
        content = createDeterministicCareSummary({
          audience,
          missingData: summaryInput.facts.missingData,
        });
      } else content = checked.content;
    } catch {
      status = CareSummaryStatus.FALLBACK;
      reasonCodes = ['summary_provider_unavailable'];
      content = createDeterministicCareSummary({
        audience,
        missingData: summaryInput.facts.missingData,
      });
    }
    try {
      return await this.summaries.create({
        reportId: new Types.ObjectId(reportId),
        patientCareProgramId: new Types.ObjectId(
          String(report.patientCareProgramId),
        ),
        patientId: new Types.ObjectId(String(report.patientId)),
        careRuleId: new Types.ObjectId(String(report.careRuleId)),
        audience,
        status,
        summaryVersion: 1,
        uniqueKey,
        content,
        citations: [],
        provider: status === CareSummaryStatus.GENERATED ? 'gemini' : undefined,
        model:
          status === CareSummaryStatus.GENERATED
            ? 'gemini-2.5-flash-lite'
            : undefined,
        promptVersion: PROMPT_VERSION,
        ruleVersion: 1,
        inputHash: summaryInput.provenance.inputHash,
        validation: {
          schemaValid: status === CareSummaryStatus.GENERATED,
          groundingValid: status === CareSummaryStatus.GENERATED,
          safetyValid: status === CareSummaryStatus.GENERATED,
          reasonCodes,
        },
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        return this.summaries.findOne({ uniqueKey }).lean().exec();
      throw error;
    }
  }
}
