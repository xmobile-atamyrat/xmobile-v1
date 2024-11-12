import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight } from '@/pages/lib/constants';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddEditProductProps, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  Alert,
  Box,
  CircularProgress,
  Snackbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function Products() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { selectedCategoryId, setParentCategory } = useCategoryContext();
  const { products, setProducts, searchKeyword } = useProductContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const { user } = useUserContext();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const t = useTranslations();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const router = useRouter();

  useEffect(() => {
    if (selectedCategoryId == null) {
      router.push('/');
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoading || !hasMore || !selectedCategoryId) return;
    setIsLoading(true);

    try {
      const fetchProductsParams: any = { page: page + 1 };
      fetchProductsParams.categoryId = selectedCategoryId;
      if (searchKeyword) {
        fetchProductsParams.searchKeyword = searchKeyword;
      }
      const newProducts = await fetchProducts(fetchProductsParams);
      setProducts((prevProducts) => [...prevProducts, ...newProducts]);
      setPage((prev) => prev + 1);

      if (newProducts.length === 0) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasMore, selectedCategoryId, page, searchKeyword]);

  useEffect(() => {
    const loadMoreTrigger = document.getElementById('load-more-trigger');
    if (!loadMoreTrigger) return () => undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreProducts();
        }
      },
      { rootMargin: '100px' }, // Adds a threshold for when to load
    );

    observer.observe(loadMoreTrigger);

    return () => {
      observer.disconnect();
    };
  }, [loadMoreProducts]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setIsLoading(false);
    setProducts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword]);

  return (
    selectedCategoryId != null && (
      <Layout
        showSearch
        handleHeaderBackButton={() => {
          setParentCategory(undefined);
          router.push('/');
        }}
      >
        <Box className="flex flex-col w-full h-full">
          <SimpleBreadcrumbs />
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
              products.map((product, idx) => (
                <ProductCard product={product} key={idx} />
              ))}
          </Box>
        </Box>
        <div id="load-more-trigger"></div>
        {isLoading && (
          <Box className="w-full flex justify-center">
            <CircularProgress />
          </Box>
        )}
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
      </Layout>
    )
  );
}
