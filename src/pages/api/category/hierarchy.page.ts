import dbClient from '@/lib/dbClient';
import {
  categorySiblingOrderBy,
  collectActiveSubtreeCategoryIds,
  nextSiblingSortOrder,
} from '@/lib/categoryHierarchy';
import { parseCategoryHierarchyBody } from '@/lib/categoryHierarchyBody';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { isStaff } from '@/pages/api/utils/staffAuth';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiResponse } from 'next';

const filepath = 'src/pages/api/category/hierarchy.page.ts';

async function handleReorderSibling(
  categoryId: string,
  direction: 'up' | 'down',
): Promise<{ status: number; resp: ResponseApi }> {
  const cat = await dbClient.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, predecessorId: true },
  });
  if (!cat) {
    return {
      status: 404,
      resp: { success: false, message: 'Category not found' },
    };
  }

  const siblings = await dbClient.category.findMany({
    where: {
      predecessorId: cat.predecessorId,
      deletedAt: null,
    },
    orderBy: categorySiblingOrderBy,
    select: { id: true },
  });

  const ids = siblings.map((s) => s.id);
  const idx = ids.indexOf(categoryId);
  if (idx < 0) {
    return {
      status: 500,
      resp: { success: false, message: 'Category not in sibling list' },
    };
  }

  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= ids.length) {
    return {
      status: 400,
      resp: {
        success: false,
        message:
          direction === 'up'
            ? 'Already first among siblings'
            : 'Already last among siblings',
      },
    };
  }

  const newOrder = [...ids];
  [newOrder[idx], newOrder[swapWith]] = [newOrder[swapWith], newOrder[idx]];

  await dbClient.$transaction(
    newOrder.map((id, sortOrder) =>
      dbClient.category.update({
        where: { id },
        data: { sortOrder },
      }),
    ),
  );

  return { status: 200, resp: { success: true } };
}

async function handleSetParent(
  categoryId: string,
  newPredecessorId: string | null,
): Promise<{ status: number; resp: ResponseApi }> {
  if (newPredecessorId === categoryId) {
    return {
      status: 400,
      resp: { success: false, message: 'Category cannot be its own parent' },
    };
  }

  const cat = await dbClient.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true },
  });
  if (!cat) {
    return {
      status: 404,
      resp: { success: false, message: 'Category not found' },
    };
  }

  if (newPredecessorId != null) {
    const parent = await dbClient.category.findFirst({
      where: { id: newPredecessorId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) {
      return {
        status: 404,
        resp: { success: false, message: 'Parent category not found' },
      };
    }

    const subtreeIds = await collectActiveSubtreeCategoryIds(categoryId);
    const subtreeSet = new Set(subtreeIds);
    if (subtreeSet.has(newPredecessorId)) {
      return {
        status: 400,
        resp: {
          success: false,
          message: 'Cannot move a category under its own descendant',
        },
      };
    }
  }

  const sortOrder = await nextSiblingSortOrder(newPredecessorId);

  await dbClient.category.update({
    where: { id: categoryId },
    data: {
      predecessorId: newPredecessorId,
      sortOrder,
    },
  });

  return { status: 200, resp: { success: true } };
}

async function handleSetPopular(
  categoryId: string,
  popular: boolean,
): Promise<{ status: number; resp: ResponseApi }> {
  const cat = await dbClient.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, predecessorId: true },
  });
  if (!cat) {
    return {
      status: 404,
      resp: { success: false, message: 'Category not found' },
    };
  }
  if (cat.predecessorId != null) {
    return {
      status: 400,
      resp: {
        success: false,
        message: 'Popular applies only to top-level categories',
      },
    };
  }

  await dbClient.category.update({
    where: { id: categoryId },
    data: { popular },
  });

  return { status: 200, resp: { success: true } };
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  if (!isStaff(req.grade)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  try {
    const body = parseCategoryHierarchyBody(req.body);
    if (body == null) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid body: expected hierarchy action (reorderSibling, setParent, or setPopular)',
      });
    }

    let result: { status: number; resp: ResponseApi };
    if (body.action === 'reorderSibling') {
      result = await handleReorderSibling(body.categoryId, body.direction);
    } else if (body.action === 'setParent') {
      result = await handleSetParent(body.categoryId, body.newPredecessorId);
    } else {
      result = await handleSetPopular(body.categoryId, body.popular);
    }

    return res.status(result.status).json(result.resp);
  } catch (error) {
    console.error(filepath, error);
    return res.status(500).json({
      success: false,
      message: "Couldn't update category hierarchy",
    });
  }
}

export default withAuth(handler);
