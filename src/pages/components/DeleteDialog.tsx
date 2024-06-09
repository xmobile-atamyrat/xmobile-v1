import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

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
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
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
            handleClose();
            setLoading(false);
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
