import type { BatchJob } from './types';
import { healthcheckJob } from './healthcheck';
import { telekomBalanceJob } from './telekom-balance';

export const jobs: BatchJob[] = [healthcheckJob, telekomBalanceJob];
