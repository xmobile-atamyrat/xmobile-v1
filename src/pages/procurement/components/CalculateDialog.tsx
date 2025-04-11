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
import { ProcurementProduct, Supplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

interface CalculateDialogProps {
  suppliers: Supplier[];
  products: ProcurementProduct[];
  handleClose: () => void;
}

type Color = 'red' | 'green' | 'orange';

const emptyPrices = (products: ProcurementProduct[], suppliers: Supplier[]) =>
  Array.from({ length: products.length }, () => Array(suppliers.length));

export default function CalculateDialog({
  products,
  suppliers,
  handleClose,
}: CalculateDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<{ value: number; color: Color }[][]>(
    emptyPrices(products, suppliers),
  );
  const [productQuantity, setProductQuantity] = useState<
    { [id: string]: number }[]
  >([]);
  const [calculationDone, setCalculationDone] = useState(false);

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
          return { ...price, color: 'green' as Color };
        }
        if (price.value === maxPrice && !maxFound) {
          maxFound = true;
          return { ...price, color: 'red' as Color };
        }
        return { ...price };
      });
    });
    setPrices(newPrices);
  }, [prices]);

  useEffect(() => {
    console.info(prices);
    console.info(productQuantity);
  }, [prices, productQuantity]);

  return (
    <Dialog open fullScreen>
      <DialogTitle>{t('calculate')}</DialogTitle>
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
                      value={productQuantity[prdIdx]?.quantity}
                      type="number"
                      onChange={(e) => {
                        const newProductQuantity = [...productQuantity];
                        newProductQuantity[prdIdx] = {
                          [product.id]:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                        };
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
          <Button variant="contained" color="error" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              //
            }}
            disabled={!calculationDone}
          >
            {t('download')}
          </Button>
        </Box>

        <Box className="flex gap-4">
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              // TODO: implement a confirmation dialog
              // setPrices(emptyPrices(products, suppliers));
              // setCalculationDone(false);
            }}
          >
            {t('clear')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setLoading(true);
              handleCalculate();
              setCalculationDone(true);
              setLoading(false);
            }}
          >
            {t('calculate')}
          </Button>
        </Box>
      </DialogActions>

      {loading && <CircularProgress />}
    </Dialog>
  );
}
