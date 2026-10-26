export { ConsultationsService } from './application/services/consultations/consultations.service';
export { ReviewsService } from './application/services/reviews/reviews.service';
export { QueryConsultationDto } from './presentation/dto/consultations/query-consultation.dto';
export {
  CARE_REPORT_PORT,
  type CareReportItem,
  type CareReportPort,
} from './application/ports/care-report.port';
export {
  CARE_ALERT_CONSULTATION_PORT,
  type CareAlertConsultationPort,
} from './application/ports/care-alert-consultation.port';
