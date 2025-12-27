import { interClassname } from '@/styles/theme';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface CancelOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (cancellationReason?: string) => Promise<void>;
}

export default function CancelOrderDialog({
  open,
  onClose,
  onConfirm,
}: CancelOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const t = useTranslations();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(cancellationReason.trim() || undefined);
      setCancellationReason('');
      onClose();
    } catch (error) {
      console.error('Error cancelling order:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className={interClassname.className}>
        {t('cancelOrder')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText
          className={interClassname.className}
          id="cancel-dialog-description"
        >
          {t('cancelOrderConfirmation')}
        </DialogContentText>
        <TextField
          fullWidth
          multiline
          rows={3}
          margin="normal"
          label={t('cancellationReason')}
          value={cancellationReason}
          onChange={(e) => setCancellationReason(e.target.value)}
          placeholder={t('reasonPlaceholder')}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="primary"
          variant="outlined"
          sx={{ textTransform: 'none' }}
          disabled={loading}
        >
          {t('cancel')}
        </Button>
        <LoadingButton
          loading={loading}
          onClick={handleConfirm}
          color="error"
          autoFocus
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('confirmCancel')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
