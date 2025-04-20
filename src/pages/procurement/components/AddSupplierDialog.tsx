import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { createSupplier } from '@/pages/procurement/lib/apis';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { Supplier } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface AddSupplierDialogProps {
  handleClose: () => void;
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function AddSupplierDialog({
  handleClose,
  setSuppliers,
  setSnackbarMessage,
  setSnackbarOpen,
}: AddSupplierDialogProps) {
  const t = useTranslations();
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
          const formData = new FormData(
            event.currentTarget as unknown as HTMLFormElement,
          );
          const formJson = Object.fromEntries(formData.entries());
          const { supplierName } = formJson;
          const { success, data, message } = await createSupplier(
            accessToken,
            supplierName as string,
          );
          if (success) {
            setSuppliers((currentSuppliers) => [...currentSuppliers, data]);
          } else {
            console.error(message);
            setSnackbarOpen(true);
            setSnackbarMessage({ message: 'serverError', severity: 'error' });
          }
        } catch (error) {
          setLoading(false);
          console.error(error);
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
        {t('addSupplier')}
      </DialogTitle>
      <DialogContent>
        <Box className="flex flex-col w-[300px] sm:w-[600px] gap-4 p-2">
          <Typography>
            {t('supplierName')}
            <span style={{ color: 'red' }}>*</span>
          </Typography>
          <TextField
            name="supplierName"
            className="my-1 min-w-[250px] w-full sm:w-[95%]"
          />
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
