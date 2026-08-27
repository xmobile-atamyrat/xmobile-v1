import type { BatchJob } from './types';
import { accountDeletionJob } from './account-deletion';
import { healthcheckJob } from './healthcheck';
import { notificationRetryJob } from './notification-retry';
import { telekomBalanceJob } from './telekom-balance';

export const jobs: BatchJob[] = [
  healthcheckJob,
  telekomBalanceJob,
  accountDeletionJob,
  notificationRetryJob,
];
