import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { fetchProducts } from '@/pages/lib/apis';
import {
  appBarHeight,
  DUMMY_DUBAI_IP,
  HIGHEST_LEVEL_CATEGORY_ID,
  LOCALE_COOKIE_NAME,
  POST_SOVIET_COUNTRIES,
} from '@/pages/lib/constants';
import { AddEditProductProps, SnackbarProps } from '@/pages/lib/types';
import { Alert, Box, Snackbar, useMediaQuery, useTheme } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import cookie, { serialize } from 'cookie';
import geoip from 'geoip-lite';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

// getServerSideProps because we want to fetch the categories from the server on every request
export const getServerSideProps: GetServerSideProps = (async (context) => {
  let messages = {};
  let ip;
  let locale = 'en';

  try {
    if (
      cookie.parse(context.req.headers.cookie ?? '')[LOCALE_COOKIE_NAME] == null
    ) {
      if (process.env.NODE_ENV === 'production') {
        ip =
          context.req.headers['x-real-ip'] ||
          context.req.headers['x-forwarded-for'] ||
          context.req.socket.remoteAddress;

        if (Array.isArray(ip)) {
          ip = ip[0];
        }
      } else {
        ip = DUMMY_DUBAI_IP;
      }
      const geo = geoip.lookup(ip || '');
      if (geo) {
        const { country } = geo;
        if (country === 'TR') {
          locale = 'tr';
        } else if (POST_SOVIET_COUNTRIES.includes(country)) {
          locale = 'ru';
        }
      }
      context.res.setHeader(
        'Set-Cookie',
        serialize(LOCALE_COOKIE_NAME, locale, {
          // session cookie, expires when the browser is closed
          secure: process.env.NODE_ENV === 'production', // Use secure flag in production
          path: '/',
        }),
      );
    }

    messages = (await import(`../i18n/${context.locale}.json`)).default;
  } catch (error) {
    console.error(error);
  }
  return {
    props: {
      locale,
      messages,
    },
  };
}) satisfies GetServerSideProps<{
  locale: string;
}>;

export default function Home({
  locale,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { selectedCategoryId } = useCategoryContext();
  const { products, setProducts, searchKeyword } = useProductContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const { user } = useUserContext();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const t = useTranslations();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const router = useRouter();

  useEffect(() => {
    router.push(router.pathname, router.asPath, { locale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCategoryId == null) return;
    setPage(1);
    setHasMore(true);
  }, [selectedCategoryId, searchKeyword]);

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

  const loadMoreProducts = useCallback(async () => {
    if (isLoading || !hasMore || !selectedCategoryId) return;
    setIsLoading(true);

    try {
      const fetchProductsParams: any = { page: page + 1 };
      if (searchKeyword) {
        fetchProductsParams.searchKeyword = searchKeyword;
      } else {
        fetchProductsParams.categoryId = selectedCategoryId;
      }
      const newProducts = await fetchProducts(fetchProductsParams);
      setPage((prev) => prev + 1);
      setProducts((prevProducts) => [...prevProducts, ...newProducts]);

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
    const handleScroll = () => {
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrolledFromTop = window.scrollY;

      if (scrollableHeight - scrolledFromTop === 0) {
        loadMoreProducts();
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [loadMoreProducts]);

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
          products.map((product, idx) => (
            <ProductCard product={product} key={idx} />
          ))}
      </Box>
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
  );
}
