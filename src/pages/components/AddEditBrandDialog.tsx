import { addEditBrand } from '@/pages/lib/utils';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface AddEditBrandDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'add' | 'edit';
  brand?: { id: string; name: string } | null;
  snackbarErrorHandler?: (message: string) => void;
}

export default function AddEditBrandDialog({
  open,
  onClose,
  onSuccess,
  mode,
  brand,
  snackbarErrorHandler,
}: AddEditBrandDialogProps) {
  const t = useTranslations();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && brand) {
        setName(brand.name);
      } else {
        setName('');
      }
    }
  }, [open, mode, brand]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const res = await addEditBrand({
      type: mode,
      name,
      id: brand?.id,
    });
    setLoading(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else if (snackbarErrorHandler)
      snackbarErrorHandler(res.message || 'Error saving brand');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {mode === 'add'
          ? t('addNewBrand') || 'Add Brand'
          : t('editBrand') || 'Edit Brand'}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label={t('brandName') || 'Brand Name'}
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('cancel')}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
