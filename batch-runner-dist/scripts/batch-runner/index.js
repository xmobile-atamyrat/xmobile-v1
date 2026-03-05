'use strict';
/**
 * Central batch/cron runner. Schedules and runs all periodic jobs:
 * - healthcheck: interval (e.g. every 5s), Slack on down/recovery
 * - telekom-balance: daily cron, Slack when balance below threshold
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const node_cron_1 = __importDefault(require('node-cron'));
const registry_1 = require('./jobs/registry');
const LOG_PREFIX = '[BatchRunner]';
function scheduleJob(job) {
  const { id, schedule, run } = job;
  const wrappedRun = async () => {
    try {
      await run();
    } catch (err) {
      console.error(`${LOG_PREFIX} Job "${id}" failed:`, err);
    }
  };
  if (schedule.type === 'interval') {
    const { ms } = schedule;
    console.log(`${LOG_PREFIX} Scheduling job "${id}" every ${ms}ms`);
    setInterval(() => {
      wrappedRun().catch(() => {});
    }, ms);
    wrappedRun().catch(() => {});
  } else if (schedule.type === 'cron') {
    const { expr } = schedule;
    console.log(`${LOG_PREFIX} Scheduling job "${id}" with cron "${expr}"`);
    node_cron_1.default.schedule(expr, () => {
      wrappedRun().catch(() => {});
    });
  }
}
function main() {
  console.log(`${LOG_PREFIX} Starting with ${registry_1.jobs.length} job(s).`);
  registry_1.jobs.forEach(scheduleJob);
}
main();
