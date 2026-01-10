import addCors from '@/pages/api/utils/addCors';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import * as si from 'systeminformation';
import { checkAdmin } from '../order/utils/checkAdmin';

const filepath = 'src/pages/api/monitoring/stream.page.ts';
const UPDATE_INTERVAL = 5000; // 5 seconds

interface MonitoringData {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
}

async function collectMetrics(): Promise<MonitoringData> {
  const [cpu, mem, cpuCurrentLoad] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.currentLoad(),
  ]);

  const memoryUsage = ((mem.total - mem.free) / mem.total) * 100;

  return {
    timestamp: new Date().toISOString(),
    cpu: {
      usage: cpuCurrentLoad.currentLoad || 0,
      cores: cpu.cores || 0,
      loadAverage: Array.isArray(cpuCurrentLoad.avgLoad)
        ? cpuCurrentLoad.avgLoad
        : [cpuCurrentLoad.avgLoad || 0, 0, 0],
    },
    memory: {
      total: mem.total,
      used: mem.total - mem.free,
      free: mem.free,
      usage: memoryUsage,
    },
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  const { method, query } = req;

  // For SSE, EventSource doesn't support custom headers, so we use query param
  let authenticatedUserId: string | undefined;
  const authHeader = req.headers.authorization;
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) ||
    (query.accessToken as string | undefined);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const decoded = await verifyToken(token, ACCESS_SECRET!);
    authenticatedUserId = decoded.userId as string;
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Check admin permissions
  if (!authenticatedUserId || !(await checkAdmin(authenticatedUserId))) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Set up interval to collect and send metrics
  const intervalId = setInterval(async () => {
    try {
      const metrics = await collectMetrics();
      res.write(
        `data: ${JSON.stringify({ type: 'metrics', data: metrics })}\n\n`,
      );
    } catch (error) {
      console.error(filepath, 'Error collecting metrics:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: `Failed to collect metrics: ${errorMessage}` })}\n\n`,
      );
    }
  }, UPDATE_INTERVAL);

  // Send initial metrics immediately
  try {
    const initialMetrics = await collectMetrics();
    res.write(
      `data: ${JSON.stringify({ type: 'metrics', data: initialMetrics })}\n\n`,
    );
  } catch (error) {
    console.error(filepath, 'Error collecting initial metrics:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: `Failed to collect initial metrics: ${errorMessage}` })}\n\n`,
    );
  }

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });

  // Note: SSE endpoint doesn't return a response, it streams
  // eslint-disable-next-line consistent-return
  return undefined;
}

export default handler;
