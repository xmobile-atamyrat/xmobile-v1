import DeleteDialog from '@/pages/components/DeleteDialog';
import { SnackbarProps } from '@/pages/lib/types';
import {
  ActionBasedProducts,
  ActionBasedSuppliers,
  ProductsSuppliersType,
} from '@/pages/procurement/lib/types';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ProcurementProduct, ProcurementSupplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface EmptyOrderProps {
  productQuantities: number[];
  setProductQuantities: Dispatch<SetStateAction<number[]>>;
  selectedSuppliers: ActionBasedSuppliers;
  setSelectedSuppliers: Dispatch<SetStateAction<ActionBasedSuppliers>>;
  selectedProducts: ActionBasedProducts;
  setSelectedProducts: Dispatch<SetStateAction<ActionBasedProducts>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function EmptyOrder({
  selectedProducts,
  selectedSuppliers,
  productQuantities,
  setProductQuantities,
  setSelectedProducts,
  setSelectedSuppliers,
}: EmptyOrderProps) {
  const t = useTranslations();
  const [confirmRemoveItemDialog, setConfirmRemoveItemDialog] = useState<{
    itemType: ProductsSuppliersType;
    item: ProcurementSupplier | ProcurementProduct;
    itemIndex: number;
  }>();

  return (
    <Box className="flex flex-col gap-2">
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell align="center">{t('quantity')}</TableCell>
              {[...selectedSuppliers.existing, ...selectedSuppliers.added].map(
                (supplier, idx) => (
                  <TableCell key={supplier.id} align="center">
                    <Box className="flex w-full items-center gap-2 justify-center">
                      <Typography>{supplier.name}</Typography>
                      <IconButton
                        onClick={() =>
                          setConfirmRemoveItemDialog({
                            itemType: 'supplier',
                            item: supplier,
                            itemIndex: idx,
                          })
                        }
                      >
                        <DeleteIcon color="error" />
                      </IconButton>
                    </Box>
                  </TableCell>
                ),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {[...selectedProducts.existing, ...selectedProducts.added].map(
              (product, prdIdx) => (
                <TableRow key={product.id}>
                  <TableCell align="left">
                    <Box className="flex w-full items-center justify-between">
                      <Typography>{product.name}</Typography>
                      <IconButton
                        onClick={() =>
                          setConfirmRemoveItemDialog({
                            itemType: 'product',
                            item: product,
                            itemIndex: prdIdx,
                          })
                        }
                      >
                        <DeleteIcon color="error" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      value={productQuantities[prdIdx] ?? ''}
                      type="number"
                      onChange={(e) => {
                        const newProductQuantity = [...productQuantities];
                        newProductQuantity[prdIdx] =
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value);
                        setProductQuantities(newProductQuantity);
                      }}
                    />
                  </TableCell>
                  {[
                    ...selectedSuppliers.existing,
                    ...selectedSuppliers.added,
                  ].map((supplier) => (
                    <TableCell key={supplier.id} align="center">
                      <TextField size="small" type="number" disabled />
                    </TableCell>
                  ))}
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {confirmRemoveItemDialog && (
        <DeleteDialog
          blueButtonText={t('cancel')}
          redButtonText={t('delete')}
          title={t('delete')}
          description={t('confirmDelete')}
          handleClose={() => {
            setConfirmRemoveItemDialog(undefined);
          }}
          handleDelete={() => {
            if (confirmRemoveItemDialog?.itemType === 'supplier') {
              setSelectedSuppliers((prev) => ({
                existing: prev.existing.filter(
                  (supplier) => supplier.id !== confirmRemoveItemDialog.item.id,
                ),
                added: prev.added.filter(
                  (supplier) => supplier.id !== confirmRemoveItemDialog.item.id,
                ),
                deleted: [
                  ...prev.deleted,
                  confirmRemoveItemDialog.item as ProcurementSupplier,
                ],
              }));
            } else {
              setSelectedProducts((prev) => ({
                existing: prev.existing.filter(
                  (product) => product.id !== confirmRemoveItemDialog.item.id,
                ),
                added: prev.added.filter(
                  (product) => product.id !== confirmRemoveItemDialog.item.id,
                ),
                deleted: [
                  ...prev.deleted,
                  confirmRemoveItemDialog.item as ProcurementProduct,
                ],
              }));
              setProductQuantities((prev) =>
                prev.filter(
                  (_, idx) => idx !== confirmRemoveItemDialog.itemIndex,
                ),
              );
            }
            setConfirmRemoveItemDialog(undefined);
          }}
        />
      )}
    </Box>
  );
}
