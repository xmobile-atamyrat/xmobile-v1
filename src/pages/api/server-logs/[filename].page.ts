import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { checkAdmin } from '../order/utils/checkAdmin';
import { readLogFile } from './utils/logUtils';

const filepath = 'src/pages/api/server-logs/[filename].page.ts';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<{ filename: string; content: string }>>,
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
      const filename = query.filename as string;

      if (!filename) {
        return res.status(400).json({
          success: false,
          message: 'Filename is required',
        });
      }

      const content = await readLogFile(filename);

      return res.status(200).json({
        success: true,
        data: {
          filename,
          content,
        },
      });
    } catch (error: any) {
      if (
        error.message.includes('Invalid log filename') ||
        error.message.includes('Path traversal')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Invalid filename',
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message || 'Log file not found',
        });
      }

      if (error.message.includes('too large')) {
        return res.status(413).json({
          success: false,
          message: error.message || 'Log file is too large',
        });
      }

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
