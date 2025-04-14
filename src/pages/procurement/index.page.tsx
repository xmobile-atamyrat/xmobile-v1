import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import CalculateDialog from '@/pages/procurement/components/CalculateDialog';
import DualTables from '@/pages/procurement/components/DualTables';
import {
  createProductUtil,
  createSupplierUtil,
  getProductsUtil,
  getSuppliersUtil,
  handleProductSearchUtil,
  handleSupplierSearchUtil,
} from '@/pages/procurement/lib/utils';
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
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const [calculateDialog, setCalculateDialog] = useState(false);

  const handleProductSearch = useCallback(
    debounce(async (keyword: string) => {
      await handleProductSearchUtil(
        accessToken,
        keyword,
        setProducts,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    }, 300),
    [debounce, accessToken],
  );

  const handleSupplierSearch = useCallback(
    debounce(async (keyword: string) => {
      await handleSupplierSearchUtil(
        accessToken,
        keyword,
        setSuppliers,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    }, 300),
    [debounce, accessToken],
  );

  const createProduct = useCallback(
    async (keyword: string) => {
      await createProductUtil(
        accessToken,
        keyword,
        setProducts,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    },
    [accessToken],
  );

  const createSupplier = useCallback(
    async (keyword: string) => {
      await createSupplierUtil(
        accessToken,
        keyword,
        setSuppliers,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    },
    [accessToken],
  );

  useEffect(() => {
    if (user?.grade === 'SUPERUSER' && accessToken) {
      (async () => {
        await getSuppliersUtil(
          accessToken,
          setSuppliers,
          setSnackbarOpen,
          setSnackbarMessage,
        );
        await getProductsUtil(
          accessToken,
          setProducts,
          setSnackbarOpen,
          setSnackbarMessage,
        );
      })();
    }
  }, [accessToken, user]);

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

          {/* Supplier Tables */}
          <DualTables
            setSnackbarMessage={setSnackbarMessage}
            setSnackbarOpen={setSnackbarOpen}
            items={suppliers}
            selectedItems={selectedSuppliers}
            setSelectedItems={setSelectedSuppliers}
            createProduct={createSupplier}
            handleSearch={handleSupplierSearch}
          />
          {/* Product Tables */}
          <DualTables
            setSnackbarMessage={setSnackbarMessage}
            setSnackbarOpen={setSnackbarOpen}
            items={products}
            selectedItems={selectedProducts}
            setSelectedItems={setSelectedProducts}
            createProduct={createProduct}
            handleSearch={handleProductSearch}
          />

          {calculateDialog && (
            <CalculateDialog
              products={selectedProducts}
              suppliers={selectedSuppliers}
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
