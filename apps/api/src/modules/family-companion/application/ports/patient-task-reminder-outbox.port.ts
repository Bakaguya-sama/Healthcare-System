export const PATIENT_TASK_REMINDER_OUTBOX = Symbol(
  'PATIENT_TASK_REMINDER_OUTBOX',
);

export type PatientTaskReminderState =
  | 'not_scheduled'
  | 'pending'
  | 'processing'
  | 'notified'
  | 'delivered_without_notification'
  | 'dead';

export interface PatientTaskReminderOutbox {
  scheduleMissedTaskReminder(input: {
    taskId: string;
    patientId: string;
    scheduledFor: Date;
  }): Promise<void>;
  getPatientReminderState(taskId: string): Promise<PatientTaskReminderState>;
}
