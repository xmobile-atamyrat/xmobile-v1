import type { BatchJob } from './types';
import { adminActivityRetentionJob } from './admin-activity-retention';
import { analyticsRetentionJob } from './analytics-retention';
import { analyticsRollupJob } from './analytics-rollup';
import { analyticsRollupNightlyJob } from './analytics-rollup-nightly';
import { accountDeletionJob } from './account-deletion';
import { healthcheckJob } from './healthcheck';
import { notificationRetryJob } from './notification-retry';
import { outOfStockCleanupJob } from './out-of-stock-cleanup';
import { outOfStockSyncJob } from './out-of-stock-sync';
import { priceStalenessJob } from './price-staleness';
import { telekomBalanceJob } from './telekom-balance';

export const jobs: BatchJob[] = [
  healthcheckJob,
  telekomBalanceJob,
  accountDeletionJob,
  notificationRetryJob,
  outOfStockSyncJob,
  outOfStockCleanupJob,
  adminActivityRetentionJob,
  priceStalenessJob,
  analyticsRollupJob,
  analyticsRollupNightlyJob,
  analyticsRetentionJob,
];
