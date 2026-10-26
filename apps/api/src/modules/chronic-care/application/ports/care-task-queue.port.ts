export const CARE_TASK_QUEUE = Symbol('CARE_TASK_QUEUE');

export interface CareTaskQueue {
  enqueue(input: {
    taskId: string;
    patientId: string;
    scheduledFor: Date;
  }): Promise<void>;
}
