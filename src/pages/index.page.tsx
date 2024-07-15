import BASE_URL from '@/lib/ApiEndpoints';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  AddEditProductProps,
  ExtendedCategory,
  ResponseApi,
  SnackbarProps,
} from '@/pages/lib/types';
import { Alert, Box, Snackbar } from '@mui/material';
import { Product, User } from '@prisma/client';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

// getServerSideProps because we want to fetch the categories from the server on every request
export const getServerSideProps: GetServerSideProps = (async (context) => {
  let categories: ExtendedCategory[] = [];
  let messages = {};
  let errorMessage: string | null = null;

  try {
    const categoriesResponse: ResponseApi<ExtendedCategory[]> = await (
      await fetch(`${BASE_URL}/api/category`)
    ).json();

    if (categoriesResponse.success && categoriesResponse.data != null) {
      categories = categoriesResponse.data;
    } else {
      console.error(categoriesResponse.message);
      errorMessage = 'fetchCategoriesError';
    }

    messages = (await import(`../i18n/${context.locale}.json`)).default;
  } catch (error) {
    console.error(error);
    errorMessage = 'fetchCategoriesError';
  }
  return {
    props: {
      categories,
      messages,
      errorMessage,
    },
  };
}) satisfies GetServerSideProps<{
  user?: User;
  categories?: ExtendedCategory[];
  errorMessage: string | null;
}>;

export default function Home({
  categories,
  errorMessage: categoryErrorMessage,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { setCategories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
  const { products, setProducts } = useProductContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false });
  const { user, setUser } = useUserContext();
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState<{
    show: boolean;
    productId: string;
  }>();
  const [snackbarOpen, setSnackbarOpen] = useState(
    categoryErrorMessage != null,
  );
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

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
      const { success, data, message }: ResponseApi<Product[]> = await (
        await fetch(`${BASE_URL}/api/product?categoryId=${selectedCategoryId}`)
      ).json();
      if (success && data != null) setProducts(data);
      else console.error(message);
    })();
  }, [selectedCategoryId, setProducts]);

  useEffect(() => {
    if (categoryErrorMessage != null) {
      setSnackbarMessage({ message: categoryErrorMessage, severity: 'error' });
    }
  }, [categoryErrorMessage]);

  return (
    <Layout>
      <Box className="flex flex-wrap gap-4 w-full p-3">
        {user?.grade === 'ADMIN' && selectedCategoryId != null && (
          <ProductCard
            handleClickAddProduct={() =>
              setAddEditProductDialog({ open: true, dialogType: 'add' })
            }
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
              handleEditProduct={() =>
                setAddEditProductDialog({
                  open: true,
                  id: product.id,
                  description: product.description,
                  dialogType: 'edit',
                  imageUrl: product.imgUrl,
                  name: product.name,
                  price: product.price,
                })
              }
            />
          ))}
        {addEditProductDialog.open && (
          <AddEditProductDialog
            args={addEditProductDialog}
            handleClose={() =>
              setAddEditProductDialog({
                open: false,
                id: undefined,
                description: undefined,
                dialogType: undefined,
                imageUrl: undefined,
                name: undefined,
              })
            }
          />
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
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={(_, reason) => {
            if (reason === 'clickaway') {
              return;
            }
            setSnackbarOpen(false);
          }}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarMessage?.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t(snackbarMessage?.message)}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
}
