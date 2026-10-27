// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import {
  AdminActivityInput,
  changedFields,
  logAdminActivities,
  logAdminActivity,
} from '@/lib/adminActivity';
import dbClient from '@/lib/dbClient';
import { hasUnbrandedClash, lockUnbrandedColors } from '@/lib/unbrandedColors';
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

function isMissingColor(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

function normalizeBrandId(brandId: unknown): string | null | undefined {
  if (brandId === undefined) return undefined;
  if (brandId == null || brandId === '') return null;
  return String(brandId);
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
      const newColor = await dbClient.$transaction(async (tx) => {
        await lockUnbrandedColors(tx);
        if (brandId == null && (await hasUnbrandedClash(tx, [{ name, hex }]))) {
          return null;
        }
        return tx.color.create({ data: { name, hex, brandId } });
      });
      if (newColor == null) {
        return res.status(409).json({ success: false, message: 'colorExists' });
      }
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

      // A color listed more than once is merged into one update, later
      // fields winning, so it isn't mistaken for a clash with itself.
      const pairsById = new Map<string, Partial<Color>>();
      colorPairs.forEach((color) => {
        if (color.id == null) return;
        pairsById.set(color.id, { ...pairsById.get(color.id), ...color });
      });
      const ids = [...pairsById.keys()];

      const result = await dbClient.$transaction(async (tx) => {
        await lockUnbrandedColors(tx);
        const existing = await tx.color.findMany({
          where: { id: { in: ids } },
        });
        if (
          colorPairs.some((color) => color.id == null) ||
          existing.length !== ids.length
        ) {
          return { error: 'colorNotFound' as const };
        }
        const existingById = new Map(
          existing.map((color) => [color.id, color]),
        );

        const updates = [...pairsById.values()].map((color) => {
          const current = existingById.get(color.id!)!;
          const brandId = normalizeBrandId(color.brandId);
          return {
            id: current.id,
            name: color.name ?? current.name,
            hex: color.hex ?? current.hex,
            brandId: brandId === undefined ? current.brandId : brandId,
          };
        });

        if (
          hasBatchClash(updates) ||
          (await hasUnbrandedClash(
            tx,
            updates.filter((color) => color.brandId == null),
            ids,
          ))
        ) {
          return { error: 'colorExists' as const };
        }

        await Promise.all(
          updates.map(({ id, name, hex, brandId }) =>
            tx.color.update({
              where: { id },
              data: { name, hex, brandId },
            }),
          ),
        );
        return { existingById, updates };
      });

      if ('error' in result) {
        return res
          .status(result.error === 'colorNotFound' ? 404 : 409)
          .json({ success: false, message: result.error });
      }
      const { existingById, updates } = result;

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
      if (isMissingColor(error)) {
        return res
          .status(404)
          .json({ success: false, message: 'colorNotFound' });
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
