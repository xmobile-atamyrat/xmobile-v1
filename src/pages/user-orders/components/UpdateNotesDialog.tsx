import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { interClassname } from '@/styles/theme';

interface UpdateNotesDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (adminNotes: string) => Promise<void>;
  currentNotes?: string | null;
}

export default function UpdateNotesDialog({
  open,
  onClose,
  onSubmit,
  currentNotes,
}: UpdateNotesDialogProps) {
  const t = useTranslations();
  const [adminNotes, setAdminNotes] = useState(currentNotes || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAdminNotes(currentNotes || '');
    }
  }, [open, currentNotes]);

  const handleSubmit = async () => {
    if (!adminNotes.trim()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(adminNotes);
      onClose();
    } catch (error) {
      console.error('Error updating notes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className={interClassname.className}>
        {t('updateNotes')}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          multiline
          rows={6}
          margin="normal"
          label={t('adminNotes')}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
          inputProps={{ maxLength: 500 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !adminNotes.trim()}
          sx={{ textTransform: 'none' }}
        >
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
