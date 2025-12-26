import { interClassname } from '@/styles/theme';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { UserOrderStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface UpdateStatusDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    status: UserOrderStatus,
    adminNotes?: string,
    cancellationReason?: string,
  ) => Promise<void>;
  currentStatus: UserOrderStatus;
  currentNotes?: string | null;
}

export default function UpdateStatusDialog({
  open,
  onClose,
  onSubmit,
  currentStatus,
  currentNotes,
}: UpdateStatusDialogProps) {
  const t = useTranslations();
  const [status, setStatus] = useState<UserOrderStatus>(currentStatus);
  const [adminNotes, setAdminNotes] = useState(currentNotes || '');
  const [cancellationReason, setCancellationReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setAdminNotes(currentNotes || '');
      setCancellationReason('');
    }
  }, [open, currentStatus, currentNotes]);

  const handleSubmit = async () => {
    if (!status) {
      return;
    }

    const isCancelling =
      status === 'USER_CANCELLED' || status === 'ADMIN_CANCELLED';
    if (isCancelling && !cancellationReason.trim()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(
        status,
        adminNotes || undefined,
        isCancelling ? cancellationReason : undefined,
      );
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCancelling =
    status === 'USER_CANCELLED' || status === 'ADMIN_CANCELLED';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className={interClassname.className}>
        {t('updateStatus')}
      </DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="normal">
          <InputLabel>{t('orderStatus')}</InputLabel>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as UserOrderStatus)}
            label={t('orderStatus')}
          >
            <MenuItem value="PENDING">{t('pending')}</MenuItem>
            <MenuItem value="IN_PROGRESS">{t('inProgress')}</MenuItem>
            <MenuItem value="COMPLETED">{t('completed')}</MenuItem>
            <MenuItem value="USER_CANCELLED">{t('userCancelled')}</MenuItem>
            <MenuItem value="ADMIN_CANCELLED">{t('adminCancelled')}</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          multiline
          rows={4}
          margin="normal"
          label={t('adminNotes')}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
          inputProps={{ maxLength: 500 }}
        />

        {isCancelling && (
          <TextField
            fullWidth
            multiline
            rows={3}
            margin="normal"
            label={t('cancellationReason')}
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            required
            error={!cancellationReason.trim()}
            helperText={
              !cancellationReason.trim() ? t('cancellationReasonRequired') : ''
            }
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || (isCancelling && !cancellationReason.trim())}
          sx={{ textTransform: 'none' }}
        >
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
