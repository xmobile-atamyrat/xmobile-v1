import {
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
import { useState } from 'react';

interface CalculateDialogProps {
  suppliers: Supplier[];
  products: ProcurementProduct[];
  handleClose: () => void;
}

export default function CalculateDialog({
  products,
  suppliers,
  handleClose,
}: CalculateDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  return (
    <Dialog open fullScreen>
      <DialogTitle>{t('calculate')}</DialogTitle>
      <DialogContent>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                {suppliers.map((supplier) => (
                  <TableCell key={supplier.id} align="center">
                    {supplier.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell align="left">{product.name}</TableCell>
                  {suppliers.map((supplier) => (
                    <TableCell key={supplier.id} align="center">
                      <TextField size="small" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" onClick={handleClose}>
          {t('cancel')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setLoading(true);
          }}
        >
          {t('calculate')}
        </Button>
      </DialogActions>

      {loading && <CircularProgress />}
    </Dialog>
  );
}
