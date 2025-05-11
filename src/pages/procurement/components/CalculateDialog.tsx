import { SnackbarProps } from '@/pages/lib/types';
import { DetailedOrder } from '@/pages/procurement/lib/types';
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
import { Dispatch, SetStateAction, useState } from 'react';

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
  const t = useTranslations();
  // const [productQuantity, setProductQuantity] = useState<number[]>(
  //   history.quantities
  //     ? (history.quantities as number[]).map((quantity) => quantity)
  //     : Array(selectedProducts.existing.length + selectedProducts.added.length),
  // );
  const [calculationDone, setCalculationDone] = useState(false);
  // const [cancelDialog, setCancelDialog] = useState(false);

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
                      return (
                        <TableCell key={supplier.id} align="center"></TableCell>
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
