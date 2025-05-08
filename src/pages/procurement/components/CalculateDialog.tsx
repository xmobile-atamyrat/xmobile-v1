import { SnackbarProps } from '@/pages/lib/types';
import {
  Box,
  Button,
  CircularProgress,
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
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useRef, useState } from 'react';

interface CalculateDialogProps {
  history: ProcurementOrder;
  setSelectedHistory: Dispatch<SetStateAction<ProcurementOrder>>;
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
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  // const [prices, setPrices] = useState<HistoryPrice[][]>(
  //   parseInitialHistoryPrices(
  //     history.prices,
  //     [...selectedProducts.existing, ...selectedProducts.added],
  //     [...selectedSuppliers.existing, ...selectedSuppliers.added],
  //   ),
  // );
  // const [productQuantity, setProductQuantity] = useState<number[]>(
  //   history.quantities
  //     ? (history.quantities as number[]).map((quantity) => quantity)
  //     : Array(selectedProducts.existing.length + selectedProducts.added.length),
  // );
  const [calculationDone, setCalculationDone] = useState(false);
  // const [cancelDialog, setCancelDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    console.info(files);
  };

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
                        disabled
                        // onChange={(e) => {
                        //   const newProductQuantity = [...productQuantity];
                        //   newProductQuantity[prdIdx] =
                        //     e.target.value === ''
                        //       ? undefined
                        //       : Number(e.target.value);
                        //   setProductQuantity(newProductQuantity);
                        // }}
                      />
                    </TableCell>
                    {selectedSuppliers.map((supplier) => (
                      <TableCell key={supplier.id} align="center">
                        <TextField
                          size="small"
                          // value={prices[prdIdx][splIdx]?.value}
                          type="number"
                          // sx={{
                          //   backgroundColor:
                          //     prices[prdIdx][splIdx]?.color || 'inherit',
                          // }}
                          // onChange={(e) => {
                          //   const newPrices = [...prices];
                          //   newPrices[prdIdx][splIdx] = {
                          //     value:
                          //       e.target.value === ''
                          //         ? undefined
                          //         : Number(e.target.value),
                          //     color: newPrices[prdIdx][splIdx]?.color,
                          //   };
                          //   setPrices(newPrices);
                          // }}
                        />
                      </TableCell>
                    ))}
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
          {/* <Button
            variant="outlined"
            sx={{
              textTransform: 'none',
            }}
            onClick={async () => {
              setLoading(true);
              try {
                await editHistoryUtil({
                  id: history.id,
                  accessToken,
                  prices: prices.map((col) => col.map((row) => row.value)),
                  quantities: productQuantity,
                  setSnackbarMessage,
                  setSnackbarOpen,
                });
              } catch (error) {
                setSnackbarMessage({
                  message: 'serverError',
                  severity: 'error',
                });
                setSnackbarOpen(true);
              } finally {
                setLoading(false);
              }
            }}
          >
            {t('save')}
          </Button> */}
          <Button
            variant="outlined"
            color="primary"
            sx={{
              textTransform: 'none',
            }}
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            {t('upload')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilesSelected}
          />
          <Button
            variant="outlined"
            color="primary"
            sx={{
              textTransform: 'none',
            }}
            onClick={() => {
              setLoading(true);
              // handleCalculate();
              setCalculationDone(true);
              setSnackbarMessage({
                message: 'calculationDone',
                severity: 'success',
              });
              setSnackbarOpen(true);
              setLoading(false);
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

      {loading && <CircularProgress />}
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
