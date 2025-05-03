import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AddEditHistoryDialog from '@/pages/procurement/components/AddEditHistoryDialog';
import CalculateDialog from '@/pages/procurement/components/CalculateDialog';
import EmptyOrder from '@/pages/procurement/components/EmptyOrder';
import HistoryListDialog from '@/pages/procurement/components/HistoryListDialog';
import {
  createHistoryUtil,
  createProductUtil,
  createSupplierUtil,
  deleteProductUtil,
  deleteSupplierUtil,
  getHistoryListUtil,
  getHistoryUtil,
  getProductsUtil,
  getSuppliersUtil,
} from '@/pages/procurement/lib/utils';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CalculationHistory,
  ProcurementProduct,
  Supplier,
} from '@prisma/client';
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
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const [historyList, setHistoryList] = useState<CalculationHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<CalculationHistory>();
  const [calculateDialog, setCalculateDialog] = useState(false);
  const [createHistoryDialog, setCreateHistoryDialog] = useState(false);
  const [historyListDialog, setHistoryListDialog] = useState(false);

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

  const createHistory = useCallback(
    async (name: string) => {
      await createHistoryUtil(
        accessToken,
        name,
        selectedSuppliers,
        selectedProducts,
        setHistoryList,
        setSelectedHistory,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    },
    [accessToken, selectedProducts, selectedSuppliers],
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      await deleteSupplierUtil(
        accessToken,
        id,
        setSuppliers,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    },
    [accessToken],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      await deleteProductUtil(
        accessToken,
        id,
        setProducts,
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
        const latestHistory = await getHistoryListUtil(
          accessToken,
          setHistoryList,
          setSnackbarOpen,
          setSnackbarMessage,
        );
        if (latestHistory) {
          await getHistoryUtil(
            accessToken,
            latestHistory.id,
            setSelectedHistory,
            setSelectedSuppliers,
            setSelectedProducts,
            setSnackbarOpen,
            setSnackbarMessage,
          );
        }
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
          <Box className="flex flex-row justify-between items-center">
            <Typography fontWeight={600} fontSize={20}>
              {t('procurement')} - {selectedHistory?.name}
            </Typography>
            <Box className="flex flex-row gap-2 items-center">
              <IconButton
                onClick={(event) => {
                  setActionsAnchor(event.currentTarget);
                }}
                color="inherit"
              >
                <Button sx={{ textTransform: 'none' }} variant="outlined">
                  {t('actions')}
                </Button>
              </IconButton>
              <Button
                className="h-9"
                onClick={() => {
                  setHistoryListDialog(true);
                }}
                sx={{ textTransform: 'none' }}
                variant="outlined"
              >
                {t('history')}
              </Button>
            </Box>
          </Box>

          {selectedHistory && (
            <EmptyOrder
              productQuantities={selectedHistory.quantities}
              selectedProducts={selectedProducts}
              selectedSuppliers={selectedSuppliers}
              setSelectedProducts={setSelectedProducts}
              setSelectedSuppliers={setSelectedSuppliers}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
            />
          )}

          {createHistoryDialog && (
            <AddEditHistoryDialog
              handleClose={() => setCreateHistoryDialog(false)}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              handleSubmit={async (title: string) => {
                await createHistory(title);
                setCalculateDialog(true);
              }}
            />
          )}

          {calculateDialog && selectedHistory && (
            <CalculateDialog
              history={selectedHistory}
              selectedProducts={selectedProducts}
              selectedSuppliers={selectedSuppliers}
              handleClose={() => setCalculateDialog(false)}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              setSelectedHistory={setSelectedHistory}
              setSelectedProducts={setSelectedProducts}
              setSelectedSuppliers={setSelectedSuppliers}
            />
          )}

          {historyListDialog && (
            <HistoryListDialog
              handleClose={() => setHistoryListDialog(false)}
              historyList={historyList}
              setHistoryList={setHistoryList}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              handleSelectHistory={async (id: string) => {
                await getHistoryUtil(
                  accessToken,
                  id,
                  setSelectedHistory,
                  setSelectedSuppliers,
                  setSelectedProducts,
                  setSnackbarOpen,
                  setSnackbarMessage,
                );
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
      )}

      <Menu
        anchorEl={actionsAnchor}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(actionsAnchor)}
        onClose={() => setActionsAnchor(null)}
      >
        <MenuItem>
          <Button
            className="w-full"
            sx={{ textTransform: 'none' }}
            variant="outlined"
          >
            {t('save')}
          </Button>
        </MenuItem>
        <MenuItem>
          <Button
            className="w-full"
            onClick={() => {
              if (
                selectedProducts.length === 0 ||
                selectedSuppliers.length === 0
              ) {
                setSnackbarMessage({
                  message: 'selectSupplierAndProduct',
                  severity: 'error',
                });
                setSnackbarOpen(true);
                return;
              }
              setCreateHistoryDialog(true);
            }}
            sx={{ textTransform: 'none' }}
            variant="outlined"
          >
            {t('calculate')}
          </Button>
        </MenuItem>
        <MenuItem>
          <Button
            className="w-full"
            sx={{ textTransform: 'none' }}
            variant="outlined"
          >
            {t('newOrder')}
          </Button>
        </MenuItem>
        <MenuItem>
          <Button
            className="w-full"
            sx={{ textTransform: 'none' }}
            variant="outlined"
          >
            {t('downloadEmptyOrder')}
          </Button>
        </MenuItem>
      </Menu>
    </Layout>
  );
}
