// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import {
  AdminActivityInput,
  changedFields,
  logAdminActivities,
  logAdminActivity,
} from '@/lib/adminActivity';
import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { curlyBracketRegex } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { Color, Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/colors/index.page.ts';

export async function getColor(colorId: string): Promise<Color | null> {
  if (colorId == null) {
    console.warn(filepath, 'colorId is null');
    return null;
  }
  const colorMatch = colorId.match(curlyBracketRegex);
  const id = colorMatch != null ? colorMatch[1] : colorId;

  return dbClient.color.findUnique({ where: { id } });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function isMissingBrand(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}

function normalizeBrandId(brandId: unknown): string | null | undefined {
  if (brandId === undefined) return undefined;
  if (brandId == null || brandId === '') return null;
  return String(brandId);
}

async function hasUnbrandedClash(
  name: string,
  hex: string,
  excludeIds: string[] = [],
): Promise<boolean> {
  const count = await dbClient.color.count({
    where: {
      brandId: null,
      id: { notIn: excludeIds },
      OR: [{ name }, { hex }],
    },
  });
  return count > 0;
}

function hasBatchClash(colors: Pick<Color, 'name' | 'hex' | 'brandId'>[]) {
  const seen = new Set<string>();
  return colors.some(({ name, hex, brandId }) => {
    const nameKey = `${brandId ?? ''}|name|${name}`;
    const hexKey = `${brandId ?? ''}|hex|${hex}`;
    if (seen.has(nameKey) || seen.has(hexKey)) return true;
    seen.add(nameKey);
    seen.add(hexKey);
    return false;
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, userId } = req as AuthenticatedRequest;

  if (method !== 'GET') {
    const user = await dbClient.user.findUnique({ where: { id: userId } });
    if (user == null || !['SUPERUSER', 'ADMIN'].includes(user.grade)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  }

  if (method === 'POST') {
    try {
      const body: Partial<Color> = req.body;
      const { name, hex } = body ?? {};
      if (name == null || hex == null) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }
      const brandId = normalizeBrandId(body?.brandId) ?? null;
      if (brandId == null && (await hasUnbrandedClash(name, hex))) {
        return res.status(409).json({ success: false, message: 'colorExists' });
      }
      const newColor = await dbClient.color.create({
        data: { name, hex, brandId },
      });
      logAdminActivity({
        userId,
        entity: 'COLOR',
        action: 'CREATE',
        entityId: newColor.id,
        meta: { name: newColor.name, hex: newColor.hex },
      });
      return res.status(200).json({
        success: true,
        message: 'Color created',
        data: newColor,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ success: false, message: 'colorExists' });
      }
      if (isMissingBrand(error)) {
        return res
          .status(400)
          .json({ success: false, message: 'brandNotFound' });
      }
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: (error as Error).message });
    }
  } else if (method === 'GET') {
    try {
      const { id } = req.query;
      if (id != null) {
        const color = await getColor(id as string);
        return res.status(200).json({ success: true, data: color });
      }
      const colors = await dbClient.color.findMany({
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ success: true, data: colors });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: (error as Error).message });
    }
  } else if (method === 'PUT') {
    try {
      const { colorPairs }: { colorPairs: Partial<Color>[] } = req.body;
      if (colorPairs == null) {
        return res
          .status(400)
          .json({ success: false, message: 'No data provided' });
      }

      const ids = colorPairs
        .map((color) => color.id)
        .filter((id): id is string => id != null);
      const existing = await dbClient.color.findMany({
        where: { id: { in: ids } },
      });
      const existingById = new Map(existing.map((color) => [color.id, color]));

      const updates = colorPairs.flatMap((color) => {
        const current = color.id != null ? existingById.get(color.id) : null;
        if (current == null) return [];
        const brandId = normalizeBrandId(color.brandId);
        return [
          {
            id: current.id,
            name: color.name ?? current.name,
            hex: color.hex ?? current.hex,
            brandId: brandId === undefined ? current.brandId : brandId,
          },
        ];
      });

      if (hasBatchClash(updates)) {
        return res.status(409).json({ success: false, message: 'colorExists' });
      }
      const unbrandedClashes = await Promise.all(
        updates
          .filter((color) => color.brandId == null)
          .map((color) => hasUnbrandedClash(color.name, color.hex, ids)),
      );
      if (unbrandedClashes.some(Boolean)) {
        return res.status(409).json({ success: false, message: 'colorExists' });
      }

      await dbClient.$transaction(
        updates.map(({ id, name, hex, brandId }) =>
          dbClient.color.update({
            where: { id },
            data: { name, hex, brandId },
          }),
        ),
      );

      logAdminActivities(
        updates.flatMap((color): AdminActivityInput[] => {
          const previous = existingById.get(color.id);
          if (!previous) return [];
          const changes = changedFields(previous, color, [
            'name',
            'hex',
            'brandId',
          ]);
          if (Object.keys(changes).length === 0) return [];
          return [
            {
              userId,
              entity: 'COLOR',
              action: 'UPDATE',
              entityId: color.id,
              meta: { name: color.name, changes },
            },
          ];
        }),
      );

      return res.status(200).json({ success: true, message: 'Colors updated' });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ success: false, message: 'colorExists' });
      }
      if (isMissingBrand(error)) {
        return res
          .status(400)
          .json({ success: false, message: 'brandNotFound' });
      }
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: (error as Error).message });
    }
  } else if (method === 'DELETE') {
    try {
      const { id } = req.query;
      if (id == null) {
        return res
          .status(400)
          .json({ success: false, message: 'No color id provided' });
      }
      const deletedColor = await dbClient.color.delete({
        where: { id: id as string },
      });
      logAdminActivity({
        userId,
        entity: 'COLOR',
        action: 'DELETE',
        entityId: deletedColor.id,
        meta: { name: deletedColor.name, hex: deletedColor.hex },
      });
      return res.status(200).json({
        success: true,
        message: 'Color deleted',
        data: deletedColor,
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: (error as Error).message });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
