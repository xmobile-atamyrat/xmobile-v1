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
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface AddSupplierDialogProps {
  handleClose: () => void;
}

export default function AddSupplierDialog({
  handleClose,
}: AddSupplierDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);

        // submit logic

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
            className="my-1 sm:mr-2 min-w-[250px] w-full sm:w-1/3"
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
