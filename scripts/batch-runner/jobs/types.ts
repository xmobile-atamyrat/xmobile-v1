/**
 * Batch job contract for the central cron/batch runner.
 */

export type JobSchedule =
  | { type: 'interval'; ms: number }
  | { type: 'cron'; expr: string };

export interface BatchJob {
  id: string;
  schedule: JobSchedule;
  run: () => Promise<void>;
}
