/**
 * Central batch/cron runner. Schedules and runs all periodic jobs:
 * - healthcheck: interval (e.g. every 5s), Slack on down/recovery
 * - telekom-balance: daily cron, Slack when balance below threshold
 */

import cron from 'node-cron';
import { jobs } from './jobs/registry';
import type { BatchJob, JobSchedule } from './jobs/types';

const LOG_PREFIX = '[BatchRunner]';

function scheduleJob(job: BatchJob): void {
  const { id, schedule, run } = job;

  const wrappedRun = async () => {
    try {
      await run();
    } catch (err) {
      console.error(`${LOG_PREFIX} Job "${id}" failed:`, err);
    }
  };

  if (schedule.type === 'interval') {
    const { ms } = schedule as Extract<JobSchedule, { type: 'interval' }>;
    console.log(`${LOG_PREFIX} Scheduling job "${id}" every ${ms}ms`);
    setInterval(() => {
      wrappedRun().catch(() => {});
    }, ms);
    wrappedRun().catch(() => {});
  } else if (schedule.type === 'cron') {
    const { expr } = schedule as Extract<JobSchedule, { type: 'cron' }>;
    console.log(`${LOG_PREFIX} Scheduling job "${id}" with cron "${expr}"`);
    cron.schedule(expr, (): void => {
      wrappedRun().catch(() => {});
    });
  }
}

function main() {
  console.log(`${LOG_PREFIX} Starting with ${jobs.length} job(s).`);
  jobs.forEach(scheduleJob);
}

main();
