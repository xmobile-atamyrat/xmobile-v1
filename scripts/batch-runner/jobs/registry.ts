import type { BatchJob } from './types';
import { accountDeletionJob } from './account-deletion';
import { healthcheckJob } from './healthcheck';
import { telekomBalanceJob } from './telekom-balance';

export const jobs: BatchJob[] = [
  healthcheckJob,
  telekomBalanceJob,
  accountDeletionJob,
];
