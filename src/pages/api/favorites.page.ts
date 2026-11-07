import dbClient from '@/lib/dbClient';
import { activeFavoriteIds, whereActiveFavorite } from '@/lib/favorites';
import { inStockFirst, whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import logRequestError from '@/pages/api/utils/logRequestError';
import { localeOptions, squareBracketRegex } from '@/pages/lib/constants';
import { displayPriceOf } from '@/pages/lib/priceDisplay';
import { ResponseApi } from '@/pages/lib/types';
import { sanitizeProductsLocale } from '@/pages/lib/utils';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/favorites.page.ts';
const FavoriteSchema = z.object({ productId: z.string().min(1) });

// Unlike the paged catalog, this list has no size limit, so the prices are
// looked up in one query rather than one per product.
async function listFavorites(userId: string, locale: unknown) {
  const products = await dbClient.product.findMany({
    where: whereActiveFavorite(userId),
    include: { brand: true, colors: { select: { id: true } } },
    orderBy: [inStockFirst, { createdAt: 'desc' }],
  });

  const priceIdOf = (price: string | null) =>
    price?.match(squareBracketRegex)?.[1];
  const prices = await dbClient.prices.findMany({
    where: {
      id: {
        in: [
          ...new Set(
            products
              .map(({ price }) => priceIdOf(price))
              .filter((id): id is string => id != null),
          ),
        ],
      },
    },
    select: { id: true, priceInTmt: true, displayPriceTmt: true },
  });
  const pricesById = new Map(
    prices.map((price) => [price.id, displayPriceOf(price)]),
  );

  const priced = products.map((product) => {
    const displayPrice = pricesById.get(priceIdOf(product.price));
    // Cards never show the description, and it is most of a row's size.
    const card = { ...product, description: null as string | null };
    return displayPrice == null
      ? card
      : { ...card, price: `${product.price}{${displayPrice}}` };
  });

  return typeof locale === 'string' && localeOptions.includes(locale)
    ? sanitizeProductsLocale(priced, locale)
    : priced;
}

function respondToWriteError(res: NextApiResponse<ResponseApi>, error: Error) {
  logRequestError(filepath, error);
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'productId is required' });
    return;
  }
  res.status(500).json({ success: false, message: error.message });
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { userId } = req as AuthenticatedRequest;

  if (req.method === 'GET') {
    try {
      const data =
        req.query.ids != null
          ? await activeFavoriteIds(userId)
          : await listFavorites(userId, req.query.locale);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error(filepath, error);
      res.status(500).json({ success: false, message: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { productId } = FavoriteSchema.parse(req.body);

      const product = await dbClient.product.findFirst({
        where: { id: productId, ...whereActiveProduct },
        select: { id: true },
      });
      if (!product) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
      }

      await dbClient.user.update({
        where: { id: userId },
        data: { favorites: { connect: { id: productId } } },
      });
      res.status(200).json({ success: true });
    } catch (error) {
      respondToWriteError(res, error);
    }
  } else if (req.method === 'DELETE') {
    try {
      const { productId } = FavoriteSchema.parse(req.body);

      await dbClient.user.update({
        where: { id: userId },
        data: { favorites: { disconnect: { id: productId } } },
      });
      res.status(200).json({ success: true });
    } catch (error) {
      respondToWriteError(res, error);
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
