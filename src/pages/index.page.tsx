import BASE_URL from '@/lib/ApiEndpoints';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { fetchProducts } from '@/pages/lib/apis';
import { appBarHeight, HIGHEST_LEVEL_CATEGORY_ID } from '@/pages/lib/constants';
import {
  AddEditProductProps,
  ExtendedCategory,
  ResponseApi,
  SnackbarProps,
} from '@/pages/lib/types';
import { Alert, Box, Snackbar, useMediaQuery, useTheme } from '@mui/material';
import { User } from '@prisma/client';
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
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const { user } = useUserContext();
  const [snackbarOpen, setSnackbarOpen] = useState(
    categoryErrorMessage != null,
  );
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const t = useTranslations();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    if (
      categories == null ||
      categories.length === 0 ||
      selectedCategoryId != null
    )
      return;
    setCategories(categories);
    setSelectedCategoryId(categories[0].id);
  }, [categories, setCategories, setSelectedCategoryId, selectedCategoryId]);

  useEffect(() => {
    if (
      selectedCategoryId == null ||
      selectedCategoryId === HIGHEST_LEVEL_CATEGORY_ID
    )
      return;
    (async () => {
      try {
        const prods = await fetchProducts({
          categoryId: selectedCategoryId,
        });
        setProducts(prods);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [selectedCategoryId, setProducts]);

  useEffect(() => {
    if (categoryErrorMessage != null) {
      setSnackbarMessage({ message: categoryErrorMessage, severity: 'error' });
    }
  }, [categoryErrorMessage]);

  return (
    <Layout showSearch>
      <Box
        className="flex flex-wrap gap-4 w-full p-3"
        sx={{
          mt: isMdUp ? `${appBarHeight}px` : undefined,
        }}
      >
        {user?.grade === 'ADMIN' && selectedCategoryId != null && (
          <ProductCard
            handleClickAddProduct={() =>
              setAddEditProductDialog({
                open: true,
                dialogType: 'add',
                imageUrls: [],
              })
            }
          />
        )}
        {products.length > 0 &&
          products.map((product) => (
            <ProductCard product={product} key={product.id} />
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
                imageUrls: [],
                name: undefined,
              })
            }
            snackbarErrorHandler={(message) => {
              setSnackbarOpen(true);
              setSnackbarMessage({ message, severity: 'error' });
            }}
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
            {snackbarMessage?.message && t(snackbarMessage.message)}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
}
