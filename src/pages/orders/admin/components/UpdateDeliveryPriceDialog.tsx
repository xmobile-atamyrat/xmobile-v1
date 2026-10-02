import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  TextField,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { fontClassName } from '@/styles/theme';

interface UpdateDeliveryPriceDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (deliveryPrice: number) => Promise<boolean>;
  subtotal: number;
  currentPrice: number | null;
}

export default function UpdateDeliveryPriceDialog({
  open,
  onClose,
  onSubmit,
  subtotal,
  currentPrice,
}: UpdateDeliveryPriceDialogProps) {
  const t = useTranslations();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(currentPrice === null ? '' : currentPrice.toFixed(2));
    }
  }, [open, currentPrice]);

  const parsed = parseFloat(value.replace(',', '.'));
  const isValid = Number.isFinite(parsed) && parsed >= 0;

  const handleSubmit = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      if (await onSubmit(parsed)) onClose();
    } catch (error) {
      console.error('Error updating delivery price:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className={fontClassName.className}>
        {t('setDeliveryPrice')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText className={fontClassName.className}>
          {t('deliveryPriceHint', { subtotal: subtotal.toFixed(2) })}
        </DialogContentText>
        <TextField
          fullWidth
          autoFocus
          margin="normal"
          label={t('deliveryPrice')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={value !== '' && !isValid}
          inputProps={{ inputMode: 'decimal' }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">{t('manat')}</InputAdornment>
            ),
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !isValid}
          sx={{ textTransform: 'none' }}
        >
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
