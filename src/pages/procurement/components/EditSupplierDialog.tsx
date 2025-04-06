import { fetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { fetchSuppliers } from '@/pages/procurement/lib/apis';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { Supplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface EditSupplierDialogProps {
  suppliers: Supplier[];
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
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
  const { accessToken } = useUserContext();
  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);

        try {
          await Promise.all(
            Object.keys(editedSuppliers).map((key) => {
              return fetchWithCreds(
                accessToken,
                '/api/procurement/supplier',
                'PUT',
                {
                  id: key,
                  name: editedSuppliers[key],
                },
              );
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
            <TextField
              key={id}
              defaultValue={name}
              className="my-1 min-w-[250px] w-full sm:w-[95%]"
              onChange={(event) => {
                const newName = event.target.value;
                setEditedSuppliers((currEditedSuppliers) => {
                  const newEditedSuppliers = currEditedSuppliers;
                  newEditedSuppliers[id] = newName;
                  return newEditedSuppliers;
                });
              }}
            />
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
    </Dialog>
  );
}
