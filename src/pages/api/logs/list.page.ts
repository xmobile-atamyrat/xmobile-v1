import { checkAdmin } from '@/pages/api/order/utils/checkAdmin';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';

const filepath = 'src/pages/api/logs/list.page.ts';
const LOGS_DIRECTORY = '/home/ubuntu/scripts';

interface LogFileInfo {
  name: string;
  size: number;
  lastModified: string;
  isLogFile: boolean;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<LogFileInfo[]>>,
) {
  addCors(res);
  const { method } = req;
  const { userId } = req as AuthenticatedRequest;

  // Check admin permissions
  if (!userId || !(await checkAdmin(userId))) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (method === 'GET') {
    try {
      // Read directory contents
      const files = await fs.readdir(LOGS_DIRECTORY);

      // Filter and get file info for log files
      const logFiles: LogFileInfo[] = await Promise.all(
        files
          .filter((file) => file.endsWith('.log'))
          .map(async (file) => {
            const filePath = path.join(LOGS_DIRECTORY, file);
            try {
              const stats = await fs.stat(filePath);
              return {
                name: file,
                size: stats.size,
                lastModified: stats.mtime.toISOString(),
                isLogFile: true,
              };
            } catch (error) {
              // Skip files that can't be accessed
              return null;
            }
          }),
      );

      // Filter out null values and sort by last modified (newest first)
      const validLogFiles = logFiles
        .filter((file): file is LogFileInfo => file !== null)
        .sort(
          (a, b) =>
            new Date(b.lastModified).getTime() -
            new Date(a.lastModified).getTime(),
        );

      return res.status(200).json({
        success: true,
        data: validLogFiles,
      });
    } catch (error: any) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to list log files',
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
