import BASE_URL from '@/lib/ApiEndpoints';
import AddProductDialog from '@/pages/components/AddProductDialog';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { Box } from '@mui/material';
import { Product, User } from '@prisma/client';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

// getServerSideProps because we want to fetch the categories from the server on every request
export const getServerSideProps: GetServerSideProps = (async (context) => {
  let categories: ExtendedCategory[] = [];
  let messages = {};

  try {
    const categoriesResponse: ResponseApi<ExtendedCategory[]> = await (
      await fetch(`${BASE_URL}/api/category`)
    ).json();

    if (categoriesResponse.success && categoriesResponse.data != null) {
      categories = categoriesResponse.data;
    }

    messages = (await import(`../i18n/${context.locale}.json`)).default;

    return {
      props: {
        categories,
        messages,
      },
    };
  } catch (error) {
    console.error(error);
  }
  return {
    props: {
      categories,
      messages,
    },
  };
}) satisfies GetServerSideProps<{
  user?: User;
  categories?: ExtendedCategory[];
}>;

export default function Home({
  categories,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { setCategories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
  const { products, setProducts } = useProductContext();
  const [createProductDialog, setCreateProductDialog] = useState(false);
  const { user, setUser } = useUserContext();
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState<{
    show: boolean;
    productId: string;
  }>();
  const t = useTranslations();

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
      <Box className="flex flex-wrap gap-4 w-full p-3">
        {user?.grade === 'ADMIN' && selectedCategoryId != null && (
          <ProductCard
            handleClickAddProduct={() => setCreateProductDialog(true)}
          />
        )}
        {products.length > 0 &&
          products.map((product) => (
            <ProductCard
              product={product}
              key={product.id}
              handleDeleteProduct={(productId) =>
                setShowDeleteProductDialog({ show: true, productId })
              }
            />
          ))}
        {createProductDialog && (
          <AddProductDialog handleClose={() => setCreateProductDialog(false)} />
        )}
        {showDeleteProductDialog?.show && (
          <DeleteDialog
            title={t('deleteProduct')}
            description={t('confirmDeleteProduct')}
            handleDelete={async () => {
              try {
                await fetch(
                  `${BASE_URL}/api/product?productId=${showDeleteProductDialog.productId}`,
                  {
                    method: 'DELETE',
                  },
                );
                const { success, data }: ResponseApi<Product[]> = await (
                  await fetch(
                    `${BASE_URL}/api/product?categoryId=${selectedCategoryId}`,
                  )
                ).json();
                if (success && data != null) setProducts(data);
              } catch (error) {
                console.error(error);
              }
            }}
            handleClose={() =>
              setShowDeleteProductDialog({ show: false, productId: '' })
            }
          />
        )}
      </Box>
    </Layout>
  );
}
