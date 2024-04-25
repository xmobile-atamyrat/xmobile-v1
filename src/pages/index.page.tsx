import BASE_URL from '@/lib/ApiEndpoints';
import ProductCard from '@/pages/components/ProductCard';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { Box, Typography } from '@mui/material';
import { Product, User } from '@prisma/client';
import { GetStaticProps, InferGetServerSidePropsType } from 'next';
import { useEffect, useState } from 'react';

type ReturnProps = { user?: User; categories?: ExtendedCategory[] };

export const getStaticProps = (async () => {
  const { success: userSuccess, data: user }: ResponseApi<User> = await (
    await fetch(`${BASE_URL}/api/user`)
  ).json();
  const {
    success: catSuccess,
    data: categories,
  }: ResponseApi<ExtendedCategory[]> = await (
    await fetch(`${BASE_URL}/api/category`)
  ).json();

  const props: ReturnProps = {};
  if (userSuccess) props.user = user;
  if (catSuccess) props.categories = categories;
  return { props };
}) satisfies GetStaticProps<ReturnProps>;

export default function Home({
  categories,
}: InferGetServerSidePropsType<typeof getStaticProps>) {
  const { setCategories, selectedCategoryId } = useCategoryContext();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (categories == null) return;
    setCategories(categories);
  }, [categories, setCategories]);

  useEffect(() => {
    if (selectedCategoryId == null) return;
    (async () => {
      const { success, data }: ResponseApi<Product[]> = await (
        await fetch(`${BASE_URL}/api/product?categoryId=${selectedCategoryId}`)
      ).json();
      if (success && data != null) setProducts(data);
    })();
  }, [selectedCategoryId]);

  return (
    <Box className="flex flex-wrap gap-4">
      {products.length > 0 ? (
        products.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))
      ) : (
        <Typography>No products</Typography>
      )}
    </Box>
  );
}
