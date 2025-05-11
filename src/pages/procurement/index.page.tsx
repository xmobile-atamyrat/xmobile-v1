import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import ActionsMenu from '@/pages/procurement/components/ActionsMenu';
import AddEditHistoryDialog from '@/pages/procurement/components/AddEditHistoryDialog';
import AddProductsSuppliersDialog from '@/pages/procurement/components/AddProductsSuppliersDialog';
import CalculateDialog from '@/pages/procurement/components/CalculateDialog';
import HistoryListDialog from '@/pages/procurement/components/HistoryListDialog';
import EmptyOrder from '@/pages/procurement/components/OrderTable';
import {
  createHistoryUtil,
  createProductQuantityUtil,
  createProductUtil,
  createSupplierUtil,
  editHistoryUtil,
  getHistoryListUtil,
  getHistoryUtil,
  handleProductSearchUtil,
  handleSupplierSearchUtil,
} from '@/pages/procurement/lib/apiUtils';
import {
  DetailedOrder,
  HistoryPrice,
  ProductsSuppliersType,
} from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  debounce,
  Snackbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
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

  const [selectedSuppliers, setSelectedSuppliers] =
    useState<ProcurementSupplier[]>();
  const [selectedProducts, setSelectedProducts] =
    useState<ProcurementProduct[]>();
  const [searchedSuppliers, setSearchedSuppliers] = useState<
    ProcurementSupplier[]
  >([]);
  const [searchedProducts, setSearchedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const [historyList, setHistoryList] = useState<ProcurementOrder[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<DetailedOrder>();
  const [calculateDialog, setCalculateDialog] = useState(false);
  const [createHistoryDialog, setCreateHistoryDialog] = useState(false);
  const [historyListDialog, setHistoryListDialog] = useState(false);
  const [addProductsSuppliersDialog, setAddProductsSuppliersDialog] =
    useState<ProductsSuppliersType>();
  const [productQuantities, setProductQuantities] = useState<
    ProcurementOrderProductQuantity[]
  >([]);
  const [prices, setPrices] = useState<HistoryPrice>();
  const [newOrderDialog, setNewOrderDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashedQuantities, setHashedQuantities] = useState<
    Record<string, number>
  >({});

  const createProduct = useCallback(
    async (keyword: string) => {
      await createProductUtil(
        accessToken,
        keyword,
        setSearchedProducts,
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
        setSearchedSuppliers,
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
        setHistoryList,
        setSelectedHistory,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    },
    [accessToken, selectedProducts, selectedSuppliers],
  );

  const handleProductSearch = useCallback(
    debounce(async (keyword: string) => {
      await handleProductSearchUtil(
        accessToken,
        keyword,
        setSearchedProducts,
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
        setSearchedSuppliers,
        setSnackbarOpen,
        setSnackbarMessage,
      );
    }, 300),
    [debounce, accessToken],
  );

  const handleAddSearchedItem = async (
    item: ProcurementProduct | ProcurementSupplier,
  ) => {
    if (addProductsSuppliersDialog === 'product') {
      const updatedHistory = await editHistoryUtil({
        id: selectedHistory.id,
        accessToken,
        addedProductIds: [item.id],
        setSnackbarMessage,
        setSnackbarOpen,
      });
      const productQuantity = await createProductQuantityUtil({
        accessToken,
        orderId: selectedHistory.id,
        productId: item.id,
        quantity: 0,
        setSnackbarMessage,
        setSnackbarOpen,
      });
      if (updatedHistory && productQuantity) {
        setSelectedProducts((prev) => [item as ProcurementProduct, ...prev]);
        setProductQuantities((prev) => [productQuantity, ...prev]);
      }
    } else {
      const updatedHistory = await editHistoryUtil({
        id: selectedHistory.id,
        accessToken,
        addedSupplierIds: [item.id],
        setSnackbarMessage,
        setSnackbarOpen,
      });
      if (updatedHistory) {
        setSelectedSuppliers((prev) => [item as ProcurementSupplier, ...prev]);
      }
    }
  };

  useEffect(() => {
    if (user?.grade === 'SUPERUSER' && accessToken) {
      (async () => {
        const latestHistory = await getHistoryListUtil(
          accessToken,
          setHistoryList,
          setSnackbarOpen,
          setSnackbarMessage,
        );
        if (latestHistory) {
          await getHistoryUtil({
            accessToken,
            id: latestHistory.id,
            setSelectedHistory,
            setSelectedSuppliers,
            setSelectedProducts,
            setSnackbarOpen,
            setSnackbarMessage,
            setProductQuantities,
          });
        }
      })();
    }
  }, [accessToken, user]);

  useEffect(() => {
    if (selectedHistory == null || selectedHistory.prices == null) return;
    const newPrices: HistoryPrice = {};
    selectedHistory.prices.forEach(
      ({ orderId, productId, supplierId, price }) => {
        const key = priceHash({
          orderId,
          productId,
          supplierId,
        });
        newPrices[key] = {
          value: price,
          color: undefined,
        };
      },
    );
    setPrices(newPrices);
  }, [selectedHistory]);

  useEffect(() => {
    if (productQuantities == null) return;
    setHashedQuantities((currQuantities) => {
      const newHashedQuantities = { ...currQuantities };
      productQuantities.forEach(({ productId, quantity }) => {
        newHashedQuantities[productId] = quantity;
      });
      return newHashedQuantities;
    });
  }, [productQuantities]);

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
              <Button
                onClick={(event) => {
                  setActionsAnchor(event.currentTarget);
                }}
                sx={{ textTransform: 'none' }}
                variant="outlined"
              >
                {t('actions')}
                {actionsAnchor == null ? (
                  <KeyboardArrowDownIcon />
                ) : (
                  <KeyboardArrowUpIcon />
                )}
              </Button>
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
          <Box className="flex flex-row justify-between items-center">
            <Button
              sx={{ textTransform: 'none' }}
              variant="outlined"
              onClick={() => {
                setAddProductsSuppliersDialog('product');
              }}
            >
              {t('addProducts')}
            </Button>

            <Button
              sx={{ textTransform: 'none' }}
              variant="outlined"
              onClick={() => {
                setAddProductsSuppliersDialog('supplier');
              }}
            >
              {t('addSuppliers')}
            </Button>
          </Box>

          {selectedHistory &&
            productQuantities &&
            selectedProducts &&
            selectedSuppliers &&
            prices && (
              <EmptyOrder
                setProductQuantities={setProductQuantities}
                selectedProducts={selectedProducts}
                selectedSuppliers={selectedSuppliers}
                setSelectedProducts={setSelectedProducts}
                setSelectedSuppliers={setSelectedSuppliers}
                setSnackbarMessage={setSnackbarMessage}
                setSnackbarOpen={setSnackbarOpen}
                selectedHistory={selectedHistory}
                prices={prices}
                setPrices={setPrices}
                hashedQuantities={hashedQuantities}
                setHashedQuantities={setHashedQuantities}
              />
            )}

          {createHistoryDialog && (
            <AddEditHistoryDialog
              handleClose={() => setCreateHistoryDialog(false)}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              handleSubmit={async (title: string) => {
                await createHistory(title);
              }}
            />
          )}

          {calculateDialog && selectedHistory && productQuantities && (
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
              productQuantities={productQuantities}
              setProductQuantities={setProductQuantities}
            />
          )}

          {historyListDialog && historyList && (
            <HistoryListDialog
              handleClose={() => setHistoryListDialog(false)}
              historyList={historyList}
              setHistoryList={setHistoryList}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              setSelectedHistory={setSelectedHistory}
              selectedHistory={selectedHistory}
              handleSelectHistory={async (id: string) => {
                await getHistoryUtil({
                  accessToken,
                  id,
                  setSelectedHistory,
                  setSelectedSuppliers,
                  setSelectedProducts,
                  setSnackbarOpen,
                  setSnackbarMessage,
                  setProductQuantities,
                });
                setHistoryListDialog(false);
              }}
            />
          )}

          {addProductsSuppliersDialog && (
            <AddProductsSuppliersDialog
              itemType={addProductsSuppliersDialog}
              handleClose={() => {
                setAddProductsSuppliersDialog(undefined);
                setSearchedProducts([]);
                setSearchedSuppliers([]);
              }}
              handleItemSearch={
                addProductsSuppliersDialog === 'product'
                  ? handleProductSearch
                  : handleSupplierSearch
              }
              searchedItems={
                addProductsSuppliersDialog === 'product'
                  ? searchedProducts
                  : searchedSuppliers
              }
              selectedItems={
                addProductsSuppliersDialog === 'product'
                  ? selectedProducts
                  : selectedSuppliers
              }
              handleAddItem={
                addProductsSuppliersDialog === 'product'
                  ? createProduct
                  : createSupplier
              }
              handleAddSearchedItem={handleAddSearchedItem}
            />
          )}

          {newOrderDialog && (
            <AddEditHistoryDialog
              handleClose={() => {
                setNewOrderDialog(false);
              }}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              handleSubmit={async (title: string) => {
                await createHistoryUtil(
                  accessToken,
                  title,
                  setHistoryList,
                  setSelectedHistory,
                  setSnackbarOpen,
                  setSnackbarMessage,
                );
                setSelectedProducts([]);
                setSelectedSuppliers([]);
                setProductQuantities([]);
                setNewOrderDialog(false);
              }}
            />
          )}

          <ActionsMenu
            actionsAnchor={actionsAnchor}
            prices={prices}
            productQuantities={productQuantities}
            selectedHistory={selectedHistory}
            selectedProducts={selectedProducts}
            selectedSuppliers={selectedSuppliers}
            setActionsAnchor={setActionsAnchor}
            setLoading={setLoading}
            setNewOrderDialog={setNewOrderDialog}
            setPrices={setPrices}
            setSnackbarMessage={setSnackbarMessage}
            setSnackbarOpen={setSnackbarOpen}
            hashedQuantities={hashedQuantities}
          />

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

          {loading && (
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                bgcolor: 'rgba(255,255,255,0.5)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress />
            </Box>
          )}
        </Box>
      )}
    </Layout>
  );
}
