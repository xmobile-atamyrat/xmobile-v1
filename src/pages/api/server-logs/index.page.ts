import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { checkAdmin } from '../order/utils/checkAdmin';
import { listLogFiles } from './utils/logUtils';

const filepath = 'src/pages/api/server-logs/index.page.ts';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<string[]>>,
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
      const logFiles = await listLogFiles();
      return res.status(200).json({
        success: true,
        data: logFiles,
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
