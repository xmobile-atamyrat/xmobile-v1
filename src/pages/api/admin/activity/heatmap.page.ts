import { getHeatmap } from '@/lib/adminActivityQueries';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { isSuperuser } from '@/pages/api/utils/staffAuth';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiResponse } from 'next';

const filepath = 'src/pages/api/admin/activity/heatmap.page.ts';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
  if (!isSuperuser(req.grade)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { userId } = req.query;
  if (typeof userId !== 'string' || userId === '') {
    return res
      .status(400)
      .json({ success: false, message: 'userId is required' });
  }

  try {
    const heatmap = await getHeatmap(userId);
    return res.status(200).json({ success: true, data: heatmap });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: "Couldn't load the heatmap" });
  }
}

export default withAuth(handler);
