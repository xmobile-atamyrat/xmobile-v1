import { getActivityFeed, parseFeedQuery } from '@/lib/adminActivityQueries';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { isSuperuser } from '@/pages/api/utils/staffAuth';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiResponse } from 'next';

const filepath = 'src/pages/api/admin/activity/feed.page.ts';

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

  const parsed = parseFeedQuery(req.query);
  if ('message' in parsed) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  try {
    const feed = await getActivityFeed(parsed.value);
    return res.status(200).json({ success: true, data: feed });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: "Couldn't load the activity feed" });
  }
}

export default withAuth(handler);
