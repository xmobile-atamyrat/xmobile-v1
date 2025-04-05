import { fetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
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
}

export default function AddSupplierDialog({
  handleClose,
  setSuppliers,
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
          const { success, data, message } = await fetchWithCreds<Supplier>(
            accessToken,
            '/api/procurement/supplier',
            'POST',
            {
              name: supplierName,
            },
          );
          if (success) {
            setSuppliers((currentSuppliers) => [...currentSuppliers, data]);
          } else {
            console.error(message);
          }
        } catch (error) {
          setLoading(false);
          console.error(error);
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
