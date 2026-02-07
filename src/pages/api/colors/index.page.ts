import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { curlyBracketRegex } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { Colors } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/colors/index.page.ts';

export async function getColor(colorId: string): Promise<Colors | null> {
  if (colorId != null) {
    const colorMatch = colorId?.match(curlyBracketRegex);
    if (colorMatch != null) {
      colorId = colorMatch[1];
    }

    const color = await dbClient.colors.findUnique({
      where: {
        id: colorId,
      },
    });

    return color;
  }

  console.error(filepath, 'colorId is null');
  return null;
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
      const body: Partial<Colors> = req.body;
      if (body == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }

      const { name, hex } = body;
      if (name == null || hex == null) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }
      const newColor = await dbClient.colors.create({
        data: {
          name,
          hex,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Color created',
        data: newColor,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'GET') {
    try {
      const { id, searchKeyword } = req.query;
      if (id != null) {
        const color = await getColor(id as string);
        return res.status(200).json({ success: true, data: color });
      }
      if (searchKeyword != null) {
        const colors = await dbClient.colors.findMany({
          where: {
            OR: [
              {
                name: {
                  contains: searchKeyword as string,
                  mode: 'insensitive',
                },
              },
              {
                hex: {
                  contains: searchKeyword as string,
                  mode: 'insensitive',
                },
              },
            ],
          },
        });
        return res.status(200).json({ success: true, data: colors });
      }
      const colors = await dbClient.colors.findMany({
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ success: true, data: colors });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'PUT') {
    try {
      const { colorPairs }: { colorPairs: Partial<Colors>[] } = req.body;
      if (colorPairs == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }

      await Promise.all(
        colorPairs.map(async (color) => {
          const data: any = {};
          if (color.name != null) data.name = color.name;
          if (color.hex != null) data.hex = color.hex;

          const updatedColor = await dbClient.colors.update({
            where: { id: color.id },
            data,
          });
          return updatedColor;
        }),
      );

      return res.status(200).json({
        success: true,
        message: 'Colors updated',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'DELETE') {
    try {
      const { id } = req.query;
      if (id == null) {
        return res.status(400).json({
          success: false,
          message: 'No color id provided',
        });
      }
      const deletedColor = await dbClient.colors.delete({
        where: { id: id as string },
      });
      return res.status(200).json({
        success: true,
        message: 'Color deleted',
        data: deletedColor,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
