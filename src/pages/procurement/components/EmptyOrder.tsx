import DeleteDialog from '@/pages/components/DeleteDialog';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { ProductsSuppliersType } from '@/pages/procurement/lib/types';
import {
  deleteProductQuantityUtil,
  editHistoryUtil,
  editProductQuantityUtil,
} from '@/pages/procurement/lib/utils';
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
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface EmptyOrderProps {
  productQuantities: ProcurementOrderProductQuantity[];
  setProductQuantities: Dispatch<
    SetStateAction<ProcurementOrderProductQuantity[]>
  >;
  selectedSuppliers: ProcurementSupplier[];
  setSelectedSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  selectedProducts: ProcurementProduct[];
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  selectedHistory: ProcurementOrder;
}

export default function EmptyOrder({
  selectedProducts,
  selectedSuppliers,
  productQuantities,
  setProductQuantities,
  setSelectedProducts,
  setSelectedSuppliers,
  setSnackbarMessage,
  setSnackbarOpen,
  selectedHistory,
}: EmptyOrderProps) {
  const { accessToken } = useUserContext();
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
              {selectedSuppliers.map((supplier, idx) => (
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
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedProducts.map((product, prdIdx) => {
              const quantity = productQuantities.find(
                (pq) => pq.productId === product.id,
              );
              return (
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
                      value={quantity?.quantity || ''}
                      type="number"
                      onChange={async (e) => {
                        const newQuantity = parseInt(e.target.value, 10);
                        const updatedProductQuantity =
                          await editProductQuantityUtil({
                            accessToken,
                            orderId: selectedHistory.id,
                            productId: product.id,
                            quantity: newQuantity,
                            setSnackbarMessage,
                            setSnackbarOpen,
                          });
                        if (updatedProductQuantity) {
                          setProductQuantities((prev) =>
                            prev.map((pq) =>
                              pq.productId === product.id
                                ? updatedProductQuantity
                                : pq,
                            ),
                          );
                        }
                      }}
                    />
                  </TableCell>
                  {selectedSuppliers.map((supplier) => (
                    <TableCell key={supplier.id} align="center">
                      <TextField size="small" type="number" disabled />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
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
          handleDelete={async () => {
            if (confirmRemoveItemDialog?.itemType === 'supplier') {
              const updatedHistory = await editHistoryUtil({
                id: selectedHistory.id,
                accessToken,
                removedSupplierIds: [confirmRemoveItemDialog.item.id],
                setSnackbarMessage,
                setSnackbarOpen,
              });
              if (updatedHistory) {
                setSelectedSuppliers((prev) =>
                  prev.filter(
                    (supplier) =>
                      supplier.id !== confirmRemoveItemDialog.item.id,
                  ),
                );
              }
            } else {
              const updatedHistory = await editHistoryUtil({
                id: selectedHistory.id,
                accessToken,
                removedProductIds: [confirmRemoveItemDialog.item.id],
                setSnackbarMessage,
                setSnackbarOpen,
              });
              const updatedProductQuantity = await deleteProductQuantityUtil({
                accessToken,
                orderId: selectedHistory.id,
                productId: confirmRemoveItemDialog.item.id,
                setSnackbarMessage,
                setSnackbarOpen,
              });
              if (updatedHistory) {
                setSelectedProducts((prev) =>
                  prev.filter(
                    (product) => product.id !== confirmRemoveItemDialog.item.id,
                  ),
                );
              }
              if (updatedProductQuantity) {
                setProductQuantities((prev) =>
                  prev.filter(
                    (pq) => pq.productId !== confirmRemoveItemDialog.item.id,
                  ),
                );
              }
            }
            setConfirmRemoveItemDialog(undefined);
          }}
        />
      )}
    </Box>
  );
}
