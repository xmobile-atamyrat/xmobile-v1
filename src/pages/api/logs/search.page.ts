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

const filepath = 'src/pages/api/logs/search.page.ts';
const LOGS_DIRECTORY = '/home/ubuntu/scripts';

const searchLogQuerySchema = z.object({
  file: z.string().min(1, 'File name is required'),
  query: z.string().min(1, 'Search query is required'),
  offset: z.string().optional().default('0'),
  limit: z.string().optional().default('50'),
  caseSensitive: z.string().optional().default('false'),
});

interface SearchResult {
  line: string;
  lineNumber: number;
}

interface LogSearchResponse {
  results: SearchResult[];
  totalMatches: number;
  offset: number;
  limit: number;
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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<LogSearchResponse>>,
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
      const validated = searchLogQuerySchema.parse(query);
      const fileName = validated.file;
      const searchQuery = validated.query;
      const offset = parseInt(validated.offset, 10);
      const limit = parseInt(validated.limit, 10);
      const caseSensitive = validated.caseSensitive === 'true';

      // Validate numeric parameters
      if (Number.isNaN(offset) || offset < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid offset parameter',
        });
      }
      if (Number.isNaN(limit) || limit < 1 || limit > 500) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 500',
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

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Prepare search pattern
      const searchPattern = caseSensitive
        ? searchQuery
        : searchQuery.toLowerCase();

      // Search for matching lines
      const allMatches: SearchResult[] = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const searchText = caseSensitive ? line : line.toLowerCase();

        if (searchText.includes(searchPattern)) {
          allMatches.push({
            line,
            lineNumber: i + 1, // 1-indexed line numbers
          });
        }
      }

      // Apply pagination
      const totalMatches = allMatches.length;
      const startIndex = Math.min(offset, totalMatches);
      const endIndex = Math.min(startIndex + limit, totalMatches);
      const paginatedResults = allMatches.slice(startIndex, endIndex);
      const hasMore = endIndex < totalMatches;

      return res.status(200).json({
        success: true,
        data: {
          results: paginatedResults,
          totalMatches,
          offset: startIndex,
          limit: paginatedResults.length,
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
        message: error.message || 'Failed to search log file',
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
