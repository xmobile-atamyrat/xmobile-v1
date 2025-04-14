import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { fetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import CalculateDialog from '@/pages/procurement/components/CalculateDialog';
import ProductTables from '@/pages/procurement/components/ProductTables';
import Suppliers from '@/pages/procurement/components/Suppliers';
import { debounce } from '@/pages/product/utils';
import {
  Alert,
  Box,
  Button,
  Snackbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ProcurementProduct, Supplier } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Procurement() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken } = useUserContext();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const [calculateDialog, setCalculateDialog] = useState(false);

  const handleSearch = useCallback(
    debounce(async (keyword: string) => {
      try {
        const { success, data, message } = await fetchWithCreds<
          ProcurementProduct[]
        >(
          accessToken,
          `/api/procurement/product?searchKeyword=${keyword}`,
          'GET',
        );
        if (success) {
          setProducts(data);
        } else {
          console.error(message);
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'serverError',
            severity: 'error',
          });
        }
      } catch (error) {
        console.error(error);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'fetchPricesError',
          severity: 'error',
        });
      }
    }, 300),
    [debounce, accessToken],
  );

  const createProduct = useCallback(
    async (keyword: string) => {
      if (keyword == null || keyword === '') {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'nameRequired',
          severity: 'error',
        });
        return;
      }

      try {
        const { success, data, message } =
          await fetchWithCreds<ProcurementProduct>(
            accessToken,
            '/api/procurement/product',
            'POST',
            {
              name: keyword,
            },
          );
        if (success) {
          setProducts([data]);
        } else {
          console.error(message);
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'serverError',
            severity: 'error',
          });
        }
      } catch (error) {
        console.error(error);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'serverError',
          severity: 'error',
        });
      }
    },
    [accessToken, products],
  );

  useEffect(() => {
    if (accessToken) {
      (async () => {
        try {
          const { success, data, message } = await fetchWithCreds<
            ProcurementProduct[]
          >(accessToken, `/api/procurement/product`, 'GET');
          if (success) {
            setProducts(data);
          } else {
            setSnackbarOpen(true);
            setSnackbarMessage({
              message,
              severity: 'error',
            });
          }
        } catch (error) {
          console.error(error);
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'fetchPricesError',
            severity: 'error',
          });
        }
      })();
    }
  }, [accessToken]);

  useEffect(() => {
    if (user?.grade !== 'SUPERUSER') {
      router.push('/');
    }
  }, [user]);
  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {user?.grade === 'SUPERUSER' && (
        <Box
          sx={{
            mt: isMdUp ? `${appBarHeight}px` : `${mobileAppBarHeight}px`,
            p: isMdUp ? 2 : 1,
          }}
          className="flex flex-col gap-4 w-full h-full"
        >
          <Box className="flex flex-row justify-between">
            <Typography fontWeight={600} fontSize={20}>
              {t('procurement')}
            </Typography>
            <Button
              onClick={() => {
                setCalculateDialog(true);
              }}
            >
              {t('calculate')}
            </Button>
          </Box>

          <Suppliers
            setSnackbarMessage={setSnackbarMessage}
            setSnackbarOpen={setSnackbarOpen}
            setSuppliers={setSuppliers}
            suppliers={suppliers}
          />

          <ProductTables
            setSnackbarMessage={setSnackbarMessage}
            setSnackbarOpen={setSnackbarOpen}
            products={products}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            createProduct={createProduct}
            handleSearch={handleSearch}
          />

          {calculateDialog && (
            <CalculateDialog
              products={selectedProducts}
              suppliers={suppliers}
              handleClose={() => setCalculateDialog(false)}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
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
      )}
    </Layout>
  );
}
