import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { DetailedOrder, HistoryPrice } from '@/pages/procurement/lib/types';
import {
  editProductPricesUtil,
  handleFilesSelected,
} from '@/pages/procurement/lib/utils';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import {
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

interface CalculateDialogProps {
  history: DetailedOrder;
  setSelectedHistory: Dispatch<SetStateAction<DetailedOrder>>;
  selectedSuppliers: ProcurementSupplier[];
  setSelectedSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  selectedProducts: ProcurementProduct[];
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  handleClose: () => void;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  productQuantities: ProcurementOrderProductQuantity[];
  setProductQuantities: Dispatch<
    SetStateAction<ProcurementOrderProductQuantity[]>
  >;
}

export default function CalculateDialog({
  history,
  selectedSuppliers,
  selectedProducts,
  handleClose,
  setSnackbarMessage,
  setSnackbarOpen,
  productQuantities,
}: CalculateDialogProps) {
  const { accessToken } = useUserContext();
  const t = useTranslations();
  const [prices, setPrices] = useState<HistoryPrice>();
  // const [productQuantity, setProductQuantity] = useState<number[]>(
  //   history.quantities
  //     ? (history.quantities as number[]).map((quantity) => quantity)
  //     : Array(selectedProducts.existing.length + selectedProducts.added.length),
  // );
  const [calculationDone, setCalculationDone] = useState(false);
  // const [cancelDialog, setCancelDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // const handleCalculate = useCallback(() => {
  //   const newPrices = prices.map((row) => {
  //     const definedPrices = row.filter((price) => price.value != null);
  //     const minPrice = Math.min(...definedPrices.map((price) => price.value));
  //     const maxPrice = Math.max(...definedPrices.map((price) => price.value));
  //     let minFound = false;
  //     let maxFound = false;
  //     return row.map((price) => {
  //       if (price.value === minPrice && !minFound) {
  //         minFound = true;
  //         return { ...price, color: 'green' as HistoryColor };
  //       }
  //       if (price.value === maxPrice && !maxFound) {
  //         maxFound = true;
  //         return { ...price, color: 'red' as HistoryColor };
  //       }
  //       return { ...price, color: undefined };
  //     });
  //   });
  //   setPrices(newPrices);
  // }, [prices]);

  useEffect(() => {
    if (history == null || history.prices == null) return;
    const newPrices: HistoryPrice = {};
    history.prices.forEach(({ orderId, productId, supplierId, price }) => {
      const key = JSON.stringify({
        orderId,
        productId,
        supplierId,
      });
      newPrices[key] = {
        value: price,
        color: undefined,
      };
    });
    setPrices(newPrices);
  }, [history]);

  return (
    <Dialog open fullScreen>
      <DialogTitle>
        {t('calculate')} - {history.name}
      </DialogTitle>
      <DialogContent>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                <TableCell align="center">{t('quantity')}</TableCell>
                {selectedSuppliers.map((supplier) => (
                  <TableCell key={supplier.id} align="center">
                    {supplier.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedProducts.map((product) => {
                const quantity = productQuantities.find(
                  (pq) => pq.productId === product.id,
                );
                return (
                  <TableRow key={product.id}>
                    <TableCell align="left">{product.name}</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        value={quantity?.quantity ?? ''}
                        type="number"
                        onChange={() => {}}
                      />
                    </TableCell>
                    {selectedSuppliers.map((supplier) => {
                      const priceColorPair =
                        prices?.[
                          JSON.stringify({
                            orderId: history.id,
                            productId: product.id,
                            supplierId: supplier.id,
                          })
                        ];
                      return (
                        <TableCell key={supplier.id} align="center">
                          <TextField
                            size="small"
                            value={priceColorPair?.value ?? ''}
                            type="number"
                            sx={{
                              backgroundColor:
                                priceColorPair?.color || 'inherit',
                            }}
                            onChange={() => {}}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions className="flex justify-between px-8">
        <Box className="flex gap-4">
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              handleClose();
            }}
            sx={{
              textTransform: 'none',
            }}
          >
            {t('cancel')}
          </Button>
        </Box>

        <Box className="flex gap-4">
          <Button
            variant="outlined"
            sx={{
              textTransform: 'none',
            }}
            onClick={async () => {
              try {
                await editProductPricesUtil({
                  accessToken,
                  updatedPrices: Object.entries(prices).map(([key, value]) => {
                    const { orderId, productId, supplierId } = JSON.parse(key);
                    return {
                      orderId,
                      productId,
                      supplierId,
                      price: value.value,
                    };
                  }),
                  setSnackbarMessage,
                  setSnackbarOpen,
                });
              } catch (error) {
                setSnackbarMessage({
                  message: 'serverError',
                  severity: 'error',
                });
                setSnackbarOpen(true);
              }
            }}
          >
            {t('save')}
          </Button>
          <LoadingButton
            loading={uploadLoading}
            variant="outlined"
            color="primary"
            sx={{
              textTransform: 'none',
            }}
            onClick={() => {
              setUploadLoading(true);
              fileInputRef.current?.click();
            }}
          >
            {t('upload')}
          </LoadingButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            multiple
            style={{ display: 'none' }}
            onChange={async (event) => {
              const uploadedPrices = await handleFilesSelected(
                history.id,
                event,
              );
              setUploadLoading(false);
              setPrices((curr) => {
                const newPrices = { ...curr };
                Object.entries(uploadedPrices).forEach(([key, value]) => {
                  newPrices[key] = value;
                });
                return newPrices;
              });
            }}
          />
          <Button
            variant="outlined"
            color="primary"
            sx={{
              textTransform: 'none',
            }}
            onClick={() => {
              // handleCalculate();
              setCalculationDone(true);
              setSnackbarMessage({
                message: 'calculationDone',
                severity: 'success',
              });
              setSnackbarOpen(true);
            }}
          >
            {t('calculate')}
          </Button>

          <Button
            variant="outlined"
            color="primary"
            sx={{
              textTransform: 'none',
            }}
            onClick={async () => {
              // const today = new Date();
              // const formattedDate = dayMonthYearFromDate(today);
              // const csvFileData: ExcelFileData[] = selectedSuppliers
              //   .map((supplier, splIdx) => {
              //     const fileData = prices
              //       .filter((row, prdIdx) => {
              //         return (
              //           row[splIdx]?.value &&
              //           productQuantity[prdIdx] &&
              //           row[splIdx]?.color === 'green'
              //         );
              //       })
              //       .map((row, prdIdx) => {
              //         return [
              //           [
              //             ...selectedProducts.existing,
              //             ...selectedProducts.added,
              //           ][prdIdx].name,
              //           productQuantity[prdIdx],
              //           `$${row[splIdx].value}`,
              //         ];
              //       });
              //     return {
              //       filename: `Rahmanov-${supplier.name}-${formattedDate}`,
              //       data: [['', 'Quantity', 'Price'], ...fileData],
              //     };
              //   })
              //   .filter((data) => data.data.length > 1);
              // await downloadXlsxAsZip(csvFileData, 'prices.zip');
            }}
            disabled={!calculationDone}
          >
            {t('download')}
          </Button>
        </Box>
      </DialogActions>
      {/* {cancelDialog && (
        <DeleteDialog
          blueButtonText={t('yes')}
          redButtonText={t('no')}
          description={t('confirmClose')}
          title={t('cancel')}
          handleClose={() => {
            setSelectedHistory(undefined);
            setSelectedSuppliers(undefined);
            setSelectedProducts(undefined);
            handleClose();
          }}
          handleDelete={() => {
            setCancelDialog(false);
          }}
        />
      )} */}
    </Dialog>
  );
}
