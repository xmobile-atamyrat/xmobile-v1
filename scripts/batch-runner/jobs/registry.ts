import { systemResourcesJob } from './system-resources';
import type { BatchJob } from './types';

export const jobs: BatchJob[] = [
  // healthcheckJob,
  // telekomBalanceJob,
  // accountDeletionJob,
  // notificationRetryJob,
  systemResourcesJob,
];
