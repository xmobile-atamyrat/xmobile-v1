import fs from 'fs';
import os from 'os';
import { sendSlackAlert } from 'scripts/batch-runner/jobs/utils';

const SLACK_BOT_NAME = 'HEALTH_BOT_WEBHOOK';
const CHECK_INTERVAL_MS = 60_000;
const ALERT_CONSECUTIVE_CHECKS = 3;
const RECOVERY_CONSECUTIVE_CHECKS = 5;
const CPU_ALERT_THRESHOLD_PERCENT = 90;
const MEMORY_ALERT_THRESHOLD_PERCENT = 85;
const DISK_SPACE_ALERT_THRESHOLD_PERCENT = 90;
const DISK_INODE_ALERT_THRESHOLD_PERCENT = 90;

interface ResourceSnapshot {
  cpuPercent: number;
  memoryPercent: number;
  diskSpacePercent: number;
  diskInodePercent: number;
}

let alertActive = false;
let consecutiveHighChecks = 0;
let consecutiveLowChecks = 0;

function getMemoryUsagePercent(): number {
  const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
  let total = 0;
  let available = 0;

  const lines = meminfo.split('\n');
  lines.forEach((line) => {
    if (line.startsWith('MemTotal:')) {
      total = parseInt(line.replace(/\D/g, ''), 10);
    } else if (line.startsWith('MemAvailable:')) {
      available = parseInt(line.replace(/\D/g, ''), 10);
    }
  });

  if (!total || !available) {
    sendSlackAlert(
      SLACK_BOT_NAME,
      'Failed to parse /proc/meminfo. Ensure execution on a Linux host.',
    );
  }

  const used = total - available;
  return (used / total) * 100;
}

function getDiskUsageMetrics(mountPoint: string = '/'): {
  spacePercent: number;
  inodePercent: number;
} {
  const stats = fs.statfsSync(mountPoint);

  const totalBlocks = Number(stats.blocks);
  const freeBlocksNonRoot = Number(stats.bavail);
  const freeBlocksRoot = Number(stats.bfree);
  const rootReserved = freeBlocksRoot - freeBlocksNonRoot;

  const usableTotalBlocks = totalBlocks - rootReserved;
  const usedBlocks = usableTotalBlocks - freeBlocksNonRoot;
  const spacePercent = (usedBlocks / usableTotalBlocks) * 100;

  const totalInodes = Number(stats.files);
  const freeInodes = Number(stats.ffree);
  const usedInodes = totalInodes - freeInodes;
  const inodePercent = (usedInodes / totalInodes) * 100;

  return { spacePercent, inodePercent };
}

async function getCpuUsagePercent(
  sampleWindowMs: number = 1000,
): Promise<number> {
  const getCpuState = () => os.cpus().map((cpu) => cpu.times);
  const start = getCpuState();

  await new Promise((resolve) => {
    setTimeout(resolve, sampleWindowMs);
  });

  const end = getCpuState();

  let totalIdle = 0;
  let totalTick = 0;

  start.forEach((_, i) => {
    const s = start[i];
    const e = end[i];

    const startTotal = s.user + s.nice + s.sys + s.idle + s.irq;
    const endTotal = e.user + e.nice + e.sys + e.idle + e.irq;

    totalIdle += e.idle - s.idle;
    totalTick += endTotal - startTotal;
  });

  if (totalTick === 0) {
    return 0;
  }

  const usagePercent = ((totalTick - totalIdle) / totalTick) * 100;
  return Math.max(0, Math.min(100, usagePercent));
}

function formatMetric(value: number, threshold: number): string {
  return `${value.toFixed(1)}% (threshold ${threshold}%)`;
}

function identifyTriggeredMetrics(snapshot: ResourceSnapshot): string[] {
  const triggered: string[] = [];

  if (snapshot.cpuPercent >= CPU_ALERT_THRESHOLD_PERCENT) {
    triggered.push(
      `CPU ${formatMetric(snapshot.cpuPercent, CPU_ALERT_THRESHOLD_PERCENT)}`,
    );
  }
  if (snapshot.memoryPercent >= MEMORY_ALERT_THRESHOLD_PERCENT) {
    triggered.push(
      `Memory ${formatMetric(snapshot.memoryPercent, MEMORY_ALERT_THRESHOLD_PERCENT)}`,
    );
  }
  if (snapshot.diskSpacePercent >= DISK_SPACE_ALERT_THRESHOLD_PERCENT) {
    triggered.push(
      `Disk Space ${formatMetric(snapshot.diskSpacePercent, DISK_SPACE_ALERT_THRESHOLD_PERCENT)}`,
    );
  }
  if (snapshot.diskInodePercent >= DISK_INODE_ALERT_THRESHOLD_PERCENT) {
    triggered.push(
      `Disk Inodes ${formatMetric(snapshot.diskInodePercent, DISK_INODE_ALERT_THRESHOLD_PERCENT)}`,
    );
  }

  return triggered;
}

async function runSystemResourceCheck(): Promise<void> {
  const diskMetrics = getDiskUsageMetrics();
  const snapshot: ResourceSnapshot = {
    cpuPercent: await getCpuUsagePercent(),
    memoryPercent: getMemoryUsagePercent(),
    diskSpacePercent: diskMetrics.spacePercent,
    diskInodePercent: diskMetrics.inodePercent,
  };

  const triggeredMetrics = identifyTriggeredMetrics(snapshot);
  const isAboveThreshold = triggeredMetrics.length > 0;

  if (isAboveThreshold) {
    consecutiveHighChecks += 1;
    consecutiveLowChecks = 0;
    console.log(
      `[SystemResources] Threshold exceeded (${consecutiveHighChecks}/${ALERT_CONSECUTIVE_CHECKS}). CPU=${snapshot.cpuPercent.toFixed(1)}%, Memory=${snapshot.memoryPercent.toFixed(1)}%, DiskSpace=${snapshot.diskSpacePercent.toFixed(1)}%, DiskInodes=${snapshot.diskInodePercent.toFixed(1)}%`,
    );

    if (!alertActive && consecutiveHighChecks >= ALERT_CONSECUTIVE_CHECKS) {
      alertActive = true;
      await sendSlackAlert(
        SLACK_BOT_NAME,
        `*System resources high*\n${triggeredMetrics.join('\n')}\n`,
      );
    }

    return;
  }

  consecutiveLowChecks += 1;
  consecutiveHighChecks = 0;

  if (alertActive && consecutiveLowChecks >= RECOVERY_CONSECUTIVE_CHECKS) {
    alertActive = false;
    await sendSlackAlert(
      SLACK_BOT_NAME,
      `*System resources recovered*\nAll resource metrics are back below thresholds.\n\nCurrent snapshot:\n- CPU: ${snapshot.cpuPercent.toFixed(1)}%\n- Memory: ${snapshot.memoryPercent.toFixed(1)}%\n- Disk Space: ${snapshot.diskSpacePercent.toFixed(1)}%\n- Disk Inodes: ${snapshot.diskInodePercent.toFixed(1)}%`,
    );
  }
}

export const systemResourcesJob = {
  id: 'system-resources',
  schedule: { type: 'interval' as const, ms: CHECK_INTERVAL_MS },
  run: runSystemResourceCheck,
};
