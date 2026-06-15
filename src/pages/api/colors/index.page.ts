// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
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
      const newColor = await dbClient.color.create({ data: { name, hex } });
      return res.status(200).json({
        success: true,
        message: 'Color created',
        data: newColor,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ success: false, message: 'colorExists' });
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

      await Promise.all(
        colorPairs.map((color) => {
          const data: Prisma.ColorUpdateInput = {};
          if (color.name != null) data.name = color.name;
          if (color.hex != null) data.hex = color.hex;
          return dbClient.color.update({ where: { id: color.id }, data });
        }),
      );

      return res.status(200).json({ success: true, message: 'Colors updated' });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ success: false, message: 'colorExists' });
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
