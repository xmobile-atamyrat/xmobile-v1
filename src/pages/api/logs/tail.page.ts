import { checkAdmin } from '@/pages/api/order/utils/checkAdmin';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { z } from 'zod';

const filepath = 'src/pages/api/logs/tail.page.ts';
const LOGS_DIRECTORY = '/home/ubuntu/scripts';

const tailLogQuerySchema = z.object({
  file: z.string().min(1, 'File name is required'),
  lines: z.string().optional().default('50'), // Number of initial lines to send
});

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
): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const allLines = content.split('\n');

  // If file ends with newline, remove empty last line
  const lines =
    allLines[allLines.length - 1] === '' ? allLines.slice(0, -1) : allLines;

  const startIndex = Math.max(0, lines.length - lineCount);
  return lines.slice(startIndex);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  const { method, query } = req;
  const { userId } = req as AuthenticatedRequest;

  // Check admin permissions
  if (!userId || !(await checkAdmin(userId))) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (method === 'GET') {
    try {
      const validated = tailLogQuerySchema.parse(query);
      const fileName = validated.file;
      const initialLines = parseInt(validated.lines, 10);

      // Validate numeric parameter
      if (
        Number.isNaN(initialLines) ||
        initialLines < 1 ||
        initialLines > 500
      ) {
        return res.status(400).json({
          success: false,
          message: 'Lines must be between 1 and 500',
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

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial lines
      const initialContent = await readLastLines(filePath, initialLines);
      res.write(
        `data: ${JSON.stringify({ type: 'initial', lines: initialContent })}\n\n`,
      );

      // Get initial file size and modification time
      let lastStats = await fs.stat(filePath);
      let lastSize = lastStats.size;
      let lastPosition = lastSize;

      // Poll for changes (every 1 second)
      const pollInterval = setInterval(async () => {
        try {
          const stats = await fs.stat(filePath);

          // Check if file has been modified
          if (
            stats.mtime.getTime() !== lastStats.mtime.getTime() ||
            stats.size !== lastSize
          ) {
            // File has changed, read new content
            if (stats.size > lastSize) {
              // File grew - read new content
              // Read entire file and extract new portion (simpler than using file handles)
              const fullContent = await fs.readFile(filePath, 'utf-8');
              const newContent = fullContent.slice(
                lastPosition > 0 ? lastPosition : 0,
              );
              const newLines = newContent
                .split('\n')
                .filter((line) => line.length > 0);

              if (newLines.length > 0) {
                res.write(
                  `data: ${JSON.stringify({ type: 'update', lines: newLines })}\n\n`,
                );
              }

              lastPosition = stats.size;
            } else if (stats.size < lastSize) {
              // File was truncated or rotated - send full tail
              const tailContent = await readLastLines(filePath, initialLines);
              res.write(
                `data: ${JSON.stringify({ type: 'reset', lines: tailContent })}\n\n`,
              );
              lastPosition = stats.size;
            }

            lastStats = stats;
            lastSize = stats.size;
          }
        } catch (error) {
          console.error(`${filepath}: Error polling file`, error);
          res.write(
            `data: ${JSON.stringify({ type: 'error', message: 'Failed to read file' })}\n\n`,
          );
        }
      }, 1000);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(pollInterval);
        res.end();
      });

      // Keep connection alive
      res.on('close', () => {
        clearInterval(pollInterval);
      });

      // Note: This handler uses SSE, so it doesn't return a response
      // The connection stays open for streaming
      return undefined;
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
        message: error.message || 'Failed to tail log file',
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
