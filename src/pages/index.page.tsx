import BASE_URL from '@/lib/ApiEndpoints';
import AddProductDialog from '@/pages/components/AddProductDialog';
import ProductCard from '@/pages/components/ProductCard';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { Box } from '@mui/material';
import { Product, User } from '@prisma/client';
import { GetStaticProps, InferGetServerSidePropsType } from 'next';
import { useEffect, useState } from 'react';

type ReturnProps = { user?: User; categories?: ExtendedCategory[] };

export const getStaticProps = (async () => {
  const {
    success: catSuccess,
    data: categories,
  }: ResponseApi<ExtendedCategory[]> = await (
    await fetch(`${BASE_URL}/api/category`)
  ).json();

  const props: ReturnProps = {};
  if (catSuccess) props.categories = categories;
  return { props };
}) satisfies GetStaticProps<ReturnProps>;

export default function Home({
  categories,
}: InferGetServerSidePropsType<typeof getStaticProps>) {
  const { setCategories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
  const { products, setProducts } = useProductContext();
  const [createProductDialog, setCreateProductDialog] = useState(false);

  useEffect(() => {
    if (categories == null || categories.length === 0) return;
    setCategories(categories);
    setSelectedCategoryId(categories[0].id);
  }, [categories, setCategories, setSelectedCategoryId]);

  useEffect(() => {
    if (selectedCategoryId == null) return;
    (async () => {
      const { success, data }: ResponseApi<Product[]> = await (
        await fetch(`${BASE_URL}/api/product?categoryId=${selectedCategoryId}`)
      ).json();
      if (success && data != null) setProducts(data);
    })();
  }, [selectedCategoryId, setProducts]);

  return (
    <Box className="flex flex-wrap gap-4">
      <ProductCard handleClickAddProduct={() => setCreateProductDialog(true)} />
      {products.length > 0 &&
        products.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      {createProductDialog && (
        <AddProductDialog handleClose={() => setCreateProductDialog(false)} />
      )}
    </Box>
  );
}
