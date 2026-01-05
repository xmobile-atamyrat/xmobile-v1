import { checkAdmin } from '@/pages/api/order/utils/checkAdmin';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { z } from 'zod';

const filepath = 'src/pages/api/logs/view.page.ts';
const LOGS_DIRECTORY = '/home/ubuntu/scripts';

const viewLogQuerySchema = z.object({
  file: z.string().min(1, 'File name is required'),
  offset: z.string().optional().default('0'),
  limit: z.string().optional().default('100'),
  tail: z.string().optional().default('false'), // If true, read from end of file
});

interface LogViewResponse {
  lines: string[];
  totalLines: number;
  offset: number;
  limit: number;
  fileSize: number;
  hasMore: boolean;
}

// Helper function to safely resolve file path (prevent directory traversal)
function safeResolveLogPath(filename: string): string {
  // Only allow files that end with .log and don't contain path separators
  if (
    !filename.endsWith('.log') ||
    filename.includes('/') ||
    filename.includes('..')
  ) {
    throw new Error('Invalid file name');
  }
  return path.join(LOGS_DIRECTORY, filename);
}

// Helper function to read last N lines from a file
async function readLastLines(
  filePath: string,
  lineCount: number,
): Promise<{ lines: string[]; totalLines: number }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const allLines = content.split('\n');

  // If file ends with newline, remove empty last line
  const lines =
    allLines[allLines.length - 1] === '' ? allLines.slice(0, -1) : allLines;

  const actualTotalLines = lines.length;
  const startIndex = Math.max(0, actualTotalLines - lineCount);
  const lastLines = lines.slice(startIndex);

  return { lines: lastLines, totalLines: actualTotalLines };
}

// Helper function to read lines with offset and limit
async function readLinesWithOffset(
  filePath: string,
  offset: number,
  limit: number,
): Promise<{ lines: string[]; totalLines: number }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const allLines = content.split('\n');

  // If file ends with newline, remove empty last line
  const lines =
    allLines[allLines.length - 1] === '' ? allLines.slice(0, -1) : allLines;

  const totalLines = lines.length;
  const startIndex = Math.max(0, offset);
  const endIndex = Math.min(totalLines, startIndex + limit);
  const requestedLines = lines.slice(startIndex, endIndex);

  return { lines: requestedLines, totalLines };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<LogViewResponse>>,
) {
  addCors(res);
  const { method, query } = req;
  const { userId } = req as AuthenticatedRequest;

  // Check admin permissions
  if (!userId || !(await checkAdmin(userId))) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (method === 'GET') {
    try {
      const validated = viewLogQuerySchema.parse(query);
      const fileName = validated.file;
      const offset = parseInt(validated.offset, 10);
      const limit = parseInt(validated.limit, 10);
      const isTail = validated.tail === 'true';

      // Validate numeric parameters
      if (Number.isNaN(offset) || offset < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid offset parameter',
        });
      }
      if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 1000',
        });
      }

      // Safely resolve file path
      const filePath = safeResolveLogPath(fileName);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'Log file not found',
        });
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Read lines based on mode
      let result: { lines: string[]; totalLines: number };
      let actualOffset = offset;

      if (isTail) {
        // Read from end of file
        result = await readLastLines(filePath, limit);
        actualOffset = Math.max(0, result.totalLines - limit);
      } else {
        // Read with offset
        result = await readLinesWithOffset(filePath, offset, limit);
      }

      const hasMore = actualOffset + result.lines.length < result.totalLines;

      return res.status(200).json({
        success: true,
        data: {
          lines: result.lines,
          totalLines: result.totalLines,
          offset: actualOffset,
          limit: result.lines.length,
          fileSize,
          hasMore,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.errors[0].message}`,
        });
      }
      if (error.message === 'Invalid file name') {
        return res.status(400).json({
          success: false,
          message: 'Invalid file name',
        });
      }
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to read log file',
      });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
