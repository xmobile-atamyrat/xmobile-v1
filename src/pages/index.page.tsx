import BASE_URL from '@/lib/ApiEndpoints';
import AddProductDialog from '@/pages/components/AddProductDialog';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { Grid } from '@mui/material';
import { Product, User } from '@prisma/client';
import { GetStaticProps, InferGetServerSidePropsType } from 'next';
import { useEffect, useState } from 'react';

export const getStaticProps = (async (context) => {
  const { data: categories }: ResponseApi<ExtendedCategory[]> = await (
    await fetch(`${BASE_URL}/api/category`)
  ).json();

  return {
    props: {
      categories,
      messages: (await import(`../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<{ user?: User; categories?: ExtendedCategory[] }>;

export default function Home({
  categories,
}: InferGetServerSidePropsType<typeof getStaticProps>) {
  const { setCategories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
  const { products, setProducts } = useProductContext();
  const [createProductDialog, setCreateProductDialog] = useState(false);
  const { user, setUser } = useUserContext();

  useEffect(() => {
    if (user == null) {
      const userString = localStorage.getItem('user');
      if (userString != null) setUser(JSON.parse(userString));
    }
  }, [user, setUser]);

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
    <Layout>
      <Grid container spacing={2} sx={{ p: 2 }} className="bg-[#F8F9FA]">
        {user?.grade === 'ADMIN' &&
          categories != null &&
          categories.length > 0 && (
            <Grid item xs={6} sm>
              <ProductCard
                handleClickAddProduct={() => setCreateProductDialog(true)}
              />
            </Grid>
          )}
        {products.length > 0 &&
          products.map((product) => (
            <Grid key={product.id} item xs={6} sm>
              <ProductCard product={product} key={product.id} />
            </Grid>
          ))}
        {createProductDialog && (
          <AddProductDialog handleClose={() => setCreateProductDialog(false)} />
        )}
      </Grid>
    </Layout>
  );
}
