import {
  changeUserRole,
  listUsers,
  roleChangeSchema,
  userListQuerySchema,
} from '@/lib/adminUsersQueries';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { isSuperuser } from '@/pages/api/utils/staffAuth';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiResponse } from 'next';

const filepath = 'src/pages/api/admin/users.page.ts';

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
  if (!isSuperuser(req.grade) || !req.userId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (req.method === 'GET') {
    const parsed = userListQuerySchema.safeParse({
      q: first(req.query.q) || undefined,
      cursor: first(req.query.cursor) || undefined,
    });
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid query' });
    }
    try {
      const page = await listUsers(parsed.data);
      return res.status(200).json({ success: true, data: page });
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't load users" });
    }
  }

  const parsed = roleChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid body' });
  }
  try {
    const result = await changeUserRole(
      req.userId,
      parsed.data.userId,
      parsed.data.grade,
    );
    if ('status' in result) {
      return res
        .status(result.status)
        .json({ success: false, message: result.message });
    }
    return res.status(200).json({ success: true, data: result.user });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: "Couldn't change the role" });
  }
}

export default withAuth(handler);
