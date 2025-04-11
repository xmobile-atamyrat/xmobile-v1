import LoadingButton from '@mui/lab/LoadingButton';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface DeleteDialogProps {
  title: string;
  description: string;
  handleClose: () => void;
  handleDelete: () => Promise<void>;
}

export default function DeleteDialog({
  description,
  title,
  handleClose,
  handleDelete,
}: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations();

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {description}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          color="primary"
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('cancel')}
        </Button>
        <LoadingButton
          loading={loading}
          onClick={async () => {
            setLoading(true);
            await handleDelete();
            setLoading(false);
            handleClose();
          }}
          color="error"
          autoFocus
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('delete')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
