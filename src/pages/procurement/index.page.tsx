import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AddEditHistoryDialog from '@/pages/procurement/components/AddEditHistoryDialog';
import AddProductsSuppliersDialog from '@/pages/procurement/components/AddProductsSuppliersDialog';
import EmptyOrder from '@/pages/procurement/components/EmptyOrder';
import HistoryListDialog from '@/pages/procurement/components/HistoryListDialog';
import {
  DetailedOrder,
  ProductsSuppliersType,
} from '@/pages/procurement/lib/types';
import {
  createHistoryUtil,
  createProductQuantityUtil,
  createProductUtil,
  createSupplierUtil,
  dayMonthYearFromDate,
  downloadXlsxAsZip,
  editHistoryUtil,
  ExcelFileData,
  getHistoryListUtil,
  getHistoryUtil,
  handleProductSearchUtil,
  handleSupplierSearchUtil,
} from '@/pages/procurement/lib/utils';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Alert,
  Box,
  Button,
  debounce,
  Menu,
  MenuItem,
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
  // const [calculateDialog, setCalculateDialog] = useState(false);
  const [createHistoryDialog, setCreateHistoryDialog] = useState(false);
  const [historyListDialog, setHistoryListDialog] = useState(false);
  const [addProductsSuppliersDialog, setAddProductsSuppliersDialog] =
    useState<ProductsSuppliersType>();
  const [productQuantities, setProductQuantities] = useState<
    ProcurementOrderProductQuantity[]
  >([]);
  const [newOrderDialog, setNewOrderDialog] = useState(false);

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
            selectedSuppliers && (
              <EmptyOrder
                productQuantities={productQuantities}
                setProductQuantities={setProductQuantities}
                selectedProducts={selectedProducts}
                selectedSuppliers={selectedSuppliers}
                setSelectedProducts={setSelectedProducts}
                setSelectedSuppliers={setSelectedSuppliers}
                setSnackbarMessage={setSnackbarMessage}
                setSnackbarOpen={setSnackbarOpen}
                selectedHistory={selectedHistory}
              />
            )}

          {createHistoryDialog && (
            <AddEditHistoryDialog
              handleClose={() => setCreateHistoryDialog(false)}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              handleSubmit={async (title: string) => {
                await createHistory(title);
                // setCalculateDialog(true);
              }}
            />
          )}

          {/* {calculateDialog && selectedHistory && (
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
          )} */}

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
              handleAddSearchedItem={async (
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
                    setSelectedProducts((prev) => [
                      item as ProcurementProduct,
                      ...prev,
                    ]);
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
                    setSelectedSuppliers((prev) => [
                      item as ProcurementSupplier,
                      ...prev,
                    ]);
                  }
                }
              }}
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
            onClick={() => {
              setNewOrderDialog(true);
            }}
          >
            {t('newOrder')}
          </Button>
        </MenuItem>
        <MenuItem>
          <Button
            className="w-full"
            sx={{ textTransform: 'none' }}
            variant="outlined"
            onClick={async () => {
              if (
                selectedProducts == null ||
                selectedSuppliers == null ||
                productQuantities == null ||
                selectedHistory == null
              ) {
                return;
              }

              const productQuantitiesMap: { [key: string]: number } = {};
              productQuantities.forEach((productQuantity) => {
                if (productQuantity.quantity > 0) {
                  const product = selectedProducts.find(
                    (product) => product.id === productQuantity.productId,
                  );
                  if (product) {
                    productQuantitiesMap[product.name] =
                      productQuantity.quantity;
                  }
                }
              });
              const products = Object.keys(productQuantitiesMap);
              const quantities = Object.values(productQuantitiesMap);
              if (products.length === 0) {
                setSnackbarMessage({
                  message: 'allQuantitiesZero',
                  severity: 'error',
                });
                setSnackbarOpen(true);
                return;
              }

              const today = new Date();
              const formattedDate = dayMonthYearFromDate(today);
              const csvFileData: ExcelFileData[] = selectedSuppliers
                .map((supplier) => {
                  const fileData = products.map((product, idx) => {
                    return [product, quantities[idx], ''];
                  });
                  return {
                    filename: `Rahmanov-${supplier.name}-${formattedDate}`,
                    data: [['', 'Quantity', 'Price'], ...fileData],
                  };
                })
                .filter((data) => data.data.length > 1);

              if (csvFileData.length === 0) {
                setSnackbarMessage({
                  message: 'noProductsOrSuppliers',
                  severity: 'error',
                });

                setSnackbarOpen(true);
                return;
              }

              await downloadXlsxAsZip(
                csvFileData,
                `${selectedHistory?.name}.zip`,
              );
            }}
          >
            {t('downloadEmptyOrder')}
          </Button>
        </MenuItem>
        <MenuItem>
          <Button
            className="w-full"
            sx={{ textTransform: 'none' }}
            variant="outlined"
          >
            {t('calculate')}
          </Button>
        </MenuItem>
      </Menu>
    </Layout>
  );
}
