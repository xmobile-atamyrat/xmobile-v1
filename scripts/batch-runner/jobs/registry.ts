import { accountDeletionJob } from 'scripts/batch-runner/jobs/account-deletion';
import { healthcheckJob } from 'scripts/batch-runner/jobs/healthcheck';
import { notificationRetryJob } from 'scripts/batch-runner/jobs/notification-retry';
import { outOfStockCleanupJob } from 'scripts/batch-runner/jobs/out-of-stock-cleanup';
import { outOfStockSyncJob } from 'scripts/batch-runner/jobs/out-of-stock-sync';
import { systemResourcesJob } from 'scripts/batch-runner/jobs/system-resources';
import { telekomBalanceJob } from 'scripts/batch-runner/jobs/telekom-balance';
import type { BatchJob } from './types';

export const jobs: BatchJob[] = [
  healthcheckJob,
  telekomBalanceJob,
  accountDeletionJob,
  notificationRetryJob,
  systemResourcesJob,
  // Sync first, then cleanup: cleanup judges products on a fresh `outOfStockAt`.
  outOfStockSyncJob,
  outOfStockCleanupJob,
];
