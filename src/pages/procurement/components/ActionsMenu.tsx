import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { editProductPricesUtil } from '@/pages/procurement/lib/apiUtils';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import {
  assignColorToPrices,
  dayMonthYearFromDate,
  downloadXlsxFiles,
  ExcelFileData,
  handleFilesSelected,
  priceHash,
} from '@/pages/procurement/lib/utils';
import { Button, Menu, MenuItem } from '@mui/material';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
  ProcurementSupplierProductPrice,
} from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useCallback, useRef } from 'react';

interface ActionsMenuProps {
  productQuantities: ProcurementOrderProductQuantity[];
  selectedSuppliers: ProcurementSupplier[];
  selectedProducts: ProcurementProduct[];
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  selectedHistory: ProcurementOrder;
  prices: HistoryPrice;
  setPrices: Dispatch<SetStateAction<HistoryPrice>>;
  actionsAnchor: HTMLElement;
  setActionsAnchor: Dispatch<SetStateAction<HTMLElement>>;
  setNewOrderDialog: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  hashedQuantities: Record<string, number>;
}

export default function ActionsMenu({
  setPrices,
  selectedHistory,
  selectedProducts,
  selectedSuppliers,
  prices,
  actionsAnchor,
  setActionsAnchor,
  setNewOrderDialog,
  productQuantities,
  setSnackbarMessage,
  setSnackbarOpen,
  setLoading,
  hashedQuantities,
}: ActionsMenuProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const handleCalculate = useCallback(async () => {
    const coloredPrices = assignColorToPrices({
      orderId: selectedHistory.id,
      productIds: selectedProducts.map((product) => product.id),
      supplierIds: selectedSuppliers.map((supplier) => supplier.id),
      prices,
    });
    const updatedPriceColors: Partial<ProcurementSupplierProductPrice>[] = [];
    selectedProducts.forEach((product) => {
      selectedSuppliers.forEach((supplier) => {
        const key = priceHash({
          orderId: selectedHistory.id,
          productId: product.id,
          supplierId: supplier.id,
        });
        if (coloredPrices[key]?.color != null) {
          updatedPriceColors.push({
            orderId: selectedHistory.id,
            productId: product.id,
            supplierId: supplier.id,
            color: coloredPrices[key].color,
          });
        }
      });
    });
    const success = await editProductPricesUtil({
      accessToken,
      updatedPrices: updatedPriceColors,
      setSnackbarMessage,
      setSnackbarOpen,
      fetchWithCreds,
    });
    if (success) {
      setPrices(coloredPrices);
    }
  }, [
    accessToken,
    prices,
    selectedHistory,
    selectedProducts,
    selectedSuppliers,
    setSnackbarMessage,
    setSnackbarOpen,
    fetchWithCreds,
  ]);

  return (
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
      onClose={() => {
        setActionsAnchor(null);
      }}
    >
      <MenuItem
        onClick={() => {
          setActionsAnchor(null);
        }}
      >
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
      <MenuItem
        onClick={() => {
          setActionsAnchor(null);
        }}
      >
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

            const productIds: string[] = [];
            const productNames: string[] = [];
            const quantities: number[] = [];
            const sortedProducts = [...selectedProducts];

            sortedProducts
              .sort((a, b) => {
                const aName = a.name;
                const bName = b.name;

                if (aName < bName) {
                  return -1; // a comes before b
                }
                if (aName > bName) {
                  return 1; // a comes after b
                }
                return 0; // a is equal to b
              })
              .forEach(({ id, name }) => {
                if (hashedQuantities[id] != null && hashedQuantities[id] > 0) {
                  productIds.push(id);
                  productNames.push(name);
                  quantities.push(hashedQuantities[id]);
                }
              });
            if (productNames.length === 0) {
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
                const fileData = productNames.map((productName, idx) => {
                  return [productName, quantities[idx], ''];
                });
                const file: ExcelFileData = {
                  filename: `Rahmanov-${supplier.name}-${formattedDate}-TBF`,
                  data: [['', 'Quantity', 'Price'], ...fileData],
                  supplierId: supplier.id,
                  productIds,
                };
                return file;
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

            await downloadXlsxFiles(csvFileData);
          }}
        >
          {t('downloadEmptyOrder')}
        </Button>
      </MenuItem>
      <MenuItem
        onClick={() => {
          setActionsAnchor(null);
        }}
      >
        <Button
          className="w-full"
          variant="outlined"
          color="primary"
          sx={{
            textTransform: 'none',
          }}
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          {t('uploadPrices')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          multiple
          style={{ display: 'none' }}
          onChange={async (event) => {
            setLoading(true);
            const uploadedPrices = await handleFilesSelected(
              selectedHistory.id,
              event,
            );
            await editProductPricesUtil({
              accessToken,
              updatedPrices: Object.entries(uploadedPrices).map(
                ([key, value]) => {
                  const { orderId, productId, supplierId } = JSON.parse(key);
                  return {
                    orderId,
                    productId,
                    supplierId,
                    price: value.value,
                  };
                },
              ),
              setSnackbarMessage,
              setSnackbarOpen,
              fetchWithCreds,
            });
            setPrices((curr) => {
              const newPrices = { ...curr };
              Object.entries(uploadedPrices).forEach(([key, value]) => {
                newPrices[key] = value;
              });
              return newPrices;
            });
            setLoading(false);

            // By default input doesn't trigger onchange if the same files
            // are re-uploaded. Reset the value to empty to allow reuploading
            // the same file/s
            event.target.value = '';
          }}
        />
      </MenuItem>
      <MenuItem
        onClick={() => {
          setActionsAnchor(null);
        }}
      >
        <Button
          className="w-full"
          sx={{ textTransform: 'none' }}
          variant="outlined"
          onClick={async () => {
            setLoading(true);
            await handleCalculate();
            setLoading(false);
          }}
        >
          {t('calculate')}
        </Button>
      </MenuItem>
      <MenuItem
        onClick={() => {
          setActionsAnchor(null);
        }}
      >
        <Button
          className="w-full"
          sx={{ textTransform: 'none' }}
          variant="outlined"
          onClick={async () => {
            const today = new Date();
            const formattedDate = dayMonthYearFromDate(today);

            const sortedProducts = [...selectedProducts];
            sortedProducts.sort((a, b) => {
              const aName = a.name;
              const bName = b.name;

              if (aName < bName) {
                return -1; // a comes before b
              }
              if (aName > bName) {
                return 1; // a comes after b
              }
              return 0; // a is equal to b
            });

            const csvFileData: ExcelFileData[] = selectedSuppliers
              .map((supplier) => {
                const productIds: string[] = [];
                const fileData: (number | string)[][] = [];
                sortedProducts.forEach((product) => {
                  const priceColorPair =
                    prices[
                      priceHash({
                        orderId: selectedHistory.id,
                        productId: product.id,
                        supplierId: supplier.id,
                      })
                    ];
                  if (
                    priceColorPair?.value != null &&
                    priceColorPair?.value > 0 &&
                    hashedQuantities[product.id] != null &&
                    hashedQuantities[product.id] > 0 &&
                    priceColorPair?.color === 'green'
                  ) {
                    fileData.push([
                      product.name,
                      hashedQuantities[product.id],
                      priceColorPair.value,
                    ]);
                    productIds.push(product.id);
                  }
                });
                const excelFileData: ExcelFileData = {
                  filename: `Rahmanov-${supplier.name}-${formattedDate}`,
                  data: [['', 'Quantity', 'Price'], ...fileData],
                  supplierId: supplier.id,
                  productIds,
                };
                return excelFileData;
              })
              .filter((data) => data.data.length > 1);
            await downloadXlsxFiles(csvFileData);
          }}
        >
          {t('downloadCalculatedOrder')}
        </Button>
      </MenuItem>
    </Menu>
  );
}
