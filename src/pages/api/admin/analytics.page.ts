import { getAnalytics } from '@/lib/analytics/adminApi';
import { parseAnalyticsQuery } from '@/lib/analytics/adminQuery';
import type { AnalyticsResponse } from '@/lib/analytics/metrics/types';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { isStaff, isSuperuser } from '@/pages/api/utils/staffAuth';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiResponse } from 'next';

const filepath = 'src/pages/api/admin/analytics.page.ts';

/**
 * GET /api/admin/analytics?widgets=&from=&to=&granularity=&limit=&locale=
 *
 * Every dashboard widget in one response (see src/lib/analytics/adminQuery.ts
 * for the parameters). Staff only; superuser widgets (revenue) are left out
 * for an ADMIN.
 */
async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi<AnalyticsResponse>>,
) {
  addCors(res);

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
  if (!isStaff(req.grade)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const superuser = isSuperuser(req.grade);
  const parsed = parseAnalyticsQuery(req.query, { superuser });
  if ('message' in parsed) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  try {
    const data = await getAnalytics(parsed.value, superuser);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: "Couldn't load analytics" });
  }
}

export default withAuth(handler);
