import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { CalculationHistory } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/calculation/history.page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  const { userId, method } = req as AuthenticatedRequest;
  const user = await dbClient.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.grade !== 'SUPERUSER') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    if (method === 'GET') {
      const id = req.query.id as string;
      if (id) {
        const history = await dbClient.calculationHistory.findUnique({
          where: { id },
          include: {
            suppliers: true,
            procurementProducts: true,
          },
        });
        return res.status(200).json({ success: true, data: history });
      }
      const allHistory = await dbClient.calculationHistory.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });
      return res.status(200).json({ success: true, data: allHistory });
    }
    if (method === 'POST') {
      const { name }: CalculationHistory = req.body;
      const history = await dbClient.calculationHistory.create({
        data: {
          name,
          // suppliers: { connect: supplierIds.map((id) => ({ id })) },
          // procurementProducts: { connect: productIds.map((id) => ({ id })) },
        },
      });
      return res.status(200).json({ success: true, data: history });
    }
    if (method === 'PUT') {
      // TODO: implement
    }
    if (method === 'DELETE') {
      const id = req.body.id as string;
      const history = await dbClient.calculationHistory.delete({
        where: { id },
      });
      return res.status(200).json({ success: true, data: history });
    }
    if (method === 'PUT') {
      const {
        id,
        name,
        supplierId,
        productId,
        quantities,
        prices,
      }: CalculationHistory & {
        supplierId?: string;
        productId?: string;
      } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (supplierId) updateData.suppliers = { connect: { id: supplierId } };
      if (productId)
        updateData.procurementProducts = { connect: { id: productId } };
      if (quantities) updateData.quantities = quantities;
      if (prices) updateData.prices = prices;

      const history = await dbClient.calculationHistory.update({
        where: { id },
        data: updateData,
      });

      return res.status(200).json({ success: true, data: history });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message,
    });
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
