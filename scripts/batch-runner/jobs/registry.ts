import { accountDeletionJob } from 'scripts/batch-runner/jobs/account-deletion';
import { healthcheckJob } from 'scripts/batch-runner/jobs/healthcheck';
import { notificationRetryJob } from 'scripts/batch-runner/jobs/notification-retry';
import { systemResourcesJob } from 'scripts/batch-runner/jobs/system-resources';
import { telekomBalanceJob } from 'scripts/batch-runner/jobs/telekom-balance';
import type { BatchJob } from './types';

export const jobs: BatchJob[] = [
  healthcheckJob,
  telekomBalanceJob,
  accountDeletionJob,
  notificationRetryJob,
  systemResourcesJob,
];
