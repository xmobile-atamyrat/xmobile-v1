import DeleteDialog from '@/pages/components/DeleteDialog';
import { SnackbarProps } from '@/pages/lib/types';
import { HistoryColor, HistoryPrice } from '@/pages/procurement/lib/types';
import {
  ExcelFileData,
  dayMonthYearFromDate,
  downloadXlsxAsZip,
  emptyHistoryPrices,
} from '@/pages/procurement/lib/utils';
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
  CalculationHistory,
  ProcurementProduct,
  Supplier,
} from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useCallback, useState } from 'react';

interface CalculateDialogProps {
  history: CalculationHistory;
  suppliers: Supplier[];
  products: ProcurementProduct[];
  handleClose: () => void;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function CalculateDialog({
  history,
  products,
  suppliers,
  handleClose,
  setSnackbarMessage,
  setSnackbarOpen,
}: CalculateDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<HistoryPrice[][]>(
    emptyHistoryPrices(products, suppliers),
  );
  const [productQuantity, setProductQuantity] = useState<number[]>(
    Array(products.length),
  );
  const [calculationDone, setCalculationDone] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);

  const handleCalculate = useCallback(() => {
    const newPrices = prices.map((row) => {
      const definedPrices = row.filter((price) => price.value !== undefined);
      const minPrice = Math.min(...definedPrices.map((price) => price.value));
      const maxPrice = Math.max(...definedPrices.map((price) => price.value));
      let minFound = false;
      let maxFound = false;
      return row.map((price) => {
        if (price.value === undefined) return price;
        if (price.value === minPrice && !minFound) {
          minFound = true;
          return { ...price, color: 'green' as HistoryColor };
        }
        if (price.value === maxPrice && !maxFound) {
          maxFound = true;
          return { ...price, color: 'red' as HistoryColor };
        }
        return { ...price };
      });
    });
    setPrices(newPrices);
  }, [prices]);

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
                {suppliers.map((supplier) => (
                  <TableCell key={supplier.id} align="center">
                    {supplier.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product, prdIdx) => (
                <TableRow key={product.id}>
                  <TableCell align="left">{product.name}</TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      value={productQuantity[prdIdx] ?? ''}
                      type="number"
                      onChange={(e) => {
                        const newProductQuantity = [...productQuantity];
                        newProductQuantity[prdIdx] =
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value);
                        setProductQuantity(newProductQuantity);
                      }}
                    />
                  </TableCell>
                  {suppliers.map((supplier, splIdx) => (
                    <TableCell key={supplier.id} align="center">
                      <TextField
                        size="small"
                        value={prices[prdIdx][splIdx]?.value}
                        type="number"
                        sx={{
                          backgroundColor:
                            prices[prdIdx][splIdx]?.color || 'inherit',
                        }}
                        onChange={(e) => {
                          const newPrices = [...prices];
                          newPrices[prdIdx][splIdx] = {
                            value:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            color: newPrices[prdIdx][splIdx]?.color,
                            id: newPrices[prdIdx][splIdx]?.id,
                          };
                          setPrices(newPrices);
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions className="flex justify-between px-8">
        <Box className="flex gap-4">
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setCancelDialog(true);
            }}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={async () => {
              const today = new Date();
              const formattedDate = dayMonthYearFromDate(today);

              const csvFileData: ExcelFileData[] = suppliers
                .map((supplier, splIdx) => {
                  const fileData = prices
                    .filter((row, prdIdx) => {
                      return (
                        row[splIdx]?.value &&
                        productQuantity[prdIdx] &&
                        row[splIdx]?.color === 'green'
                      );
                    })
                    .map((row, prdIdx) => {
                      return [
                        products[prdIdx].name,
                        productQuantity[prdIdx],
                        `$${row[splIdx].value}`,
                      ];
                    });

                  return {
                    filename: `Rahmanov-${supplier.name}-${formattedDate}`,
                    data: [['', 'Quantity', 'Price'], ...fileData],
                  };
                })
                .filter((data) => data.data.length > 1);

              await downloadXlsxAsZip(csvFileData, 'prices.zip');
            }}
            disabled={!calculationDone}
          >
            {t('download')}
          </Button>
        </Box>

        <Box className="flex gap-4">
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setLoading(true);
              handleCalculate();
              setCalculationDone(true);
              setSnackbarMessage({
                message: t('calculationDone'),
                severity: 'success',
              });
              setSnackbarOpen(true);
              setLoading(false);
            }}
          >
            {t('calculate')}
          </Button>
        </Box>
      </DialogActions>

      {loading && <CircularProgress />}
      {cancelDialog && (
        <DeleteDialog
          blueButtonText={t('no')}
          redButtonText={t('yes')}
          description={t('confirmClose')}
          title={t('cancel')}
          handleClose={() => setCancelDialog(false)}
          handleDelete={handleClose}
        />
      )}
    </Dialog>
  );
}
