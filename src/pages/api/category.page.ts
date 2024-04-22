import dbClient from '@/lib/dbClient';
import { Category, Product } from '@prisma/client';

export async function getCategory(
  categoryId: string,
): Promise<
  (Category & { products: Product[]; successorCategories: Category[] }) | null
> {
  const category = await dbClient.category.findUnique({
    where: {
      id: categoryId,
    },
    include: {
      products: true,
      successorCategories: true,
    },
  });
  return category;
}

export default async function handler() {
  //   req: NextApiRequest,
  //   res: NextApiResponse<ResponseApi>,
  //
}
