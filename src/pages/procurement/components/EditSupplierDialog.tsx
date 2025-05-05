import DeleteDialog from '@/pages/components/DeleteDialog';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { deleteSupplier, fetchSuppliers } from '@/pages/procurement/lib/apis';
import DeleteIcon from '@mui/icons-material/Delete';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from '@mui/material';
import { ProcurementSupplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface EditSupplierDialogProps {
  suppliers: ProcurementSupplier[];
  setSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  handleClose: () => void;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function EditSupplierDialog({
  handleClose,
  suppliers,
  setSnackbarMessage,
  setSnackbarOpen,
  setSuppliers,
}: EditSupplierDialogProps) {
  const t = useTranslations();
  const [editedSuppliers, setEditedSuppliers] = useState<{
    [key: string]: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [deleteSupplierId, setDeleteSupplierId] = useState<string>();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const keys = Object.keys(editedSuppliers);
        if (keys.length === 0) {
          handleClose();
          return;
        }
        setLoading(true);

        try {
          await Promise.all(
            keys.map((key) => {
              return fetchWithCreds({
                accessToken,
                path: '/api/procurement/supplier',
                method: 'PUT',
                body: {
                  id: key,
                  name: editedSuppliers[key],
                },
              });
            }),
          );

          const { success, data, message } = await fetchSuppliers(accessToken);
          if (success) {
            setSuppliers(data);
          } else {
            console.error(message);
            setSnackbarOpen(true);
            setSnackbarMessage({ message: 'serverError', severity: 'error' });
          }

          setLoading(false);
        } catch (error) {
          console.error(error);
          setLoading(false);
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'serverError',
            severity: 'error',
          });
        }

        setLoading(false);
        handleClose();
      }}
    >
      <DialogTitle className="w-full flex justify-center">
        {t('editSuppliers')}
      </DialogTitle>
      <DialogContent>
        <Box className="flex flex-col w-[300px] sm:w-[600px] gap-4 p-2">
          {suppliers.map(({ name, id }) => (
            <Box key={id} className="flex items-center flex-row gap-2">
              <TextField
                defaultValue={name}
                className="my-1 min-w-[250px] w-full sm:w-[80%]"
                onChange={(event) => {
                  const newName = event.target.value;
                  setEditedSuppliers((currEditedSuppliers) => {
                    const newEditedSuppliers = currEditedSuppliers;
                    newEditedSuppliers[id] = newName;
                    return newEditedSuppliers;
                  });
                }}
              />
              <IconButton
                className="flex items-center h-full"
                onClick={() => {
                  setDeleteSupplierId(id);
                }}
              >
                <DeleteIcon color="error" />
              </IconButton>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions className="mb-4 mr-4">
        <Button variant="contained" color="error" onClick={handleClose}>
          {t('cancel')}
        </Button>
        <LoadingButton loading={loading} variant="contained" type="submit">
          {t('submit')}
        </LoadingButton>
      </DialogActions>

      {deleteSupplierId && (
        <DeleteDialog
          title={t('deleteSupplier')}
          description={t('confirmDeleteSupplier')}
          blueButtonText={t('cancel')}
          redButtonText={t('delete')}
          handleClose={() => {
            setDeleteSupplierId(undefined);
          }}
          handleDelete={async () => {
            const { success, data, message } = await deleteSupplier(
              accessToken,
              deleteSupplierId,
            );
            if (success) {
              setSuppliers((prevSuppliers) =>
                prevSuppliers.filter((supplier) => supplier.id !== data.id),
              );
            } else {
              console.error(message);
              setSnackbarOpen(true);
              setSnackbarMessage({
                message: 'serverError',
                severity: 'error',
              });
            }
            setDeleteSupplierId(undefined);
          }}
        />
      )}
    </Dialog>
  );
}
