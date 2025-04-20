import { SnackbarProps } from '@/pages/lib/types';
import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface AddEditHistoryDialogProps {
  initialTitle?: string;
  handleClose: () => void;
  handleSubmit: (title: string) => Promise<void>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function AddEditHistoryDialog({
  initialTitle,
  handleClose,
  handleSubmit,
  setSnackbarMessage,
  setSnackbarOpen,
}: AddEditHistoryDialogProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        {initialTitle == null ? t('createHistory') : t('editHistory')}
      </DialogTitle>
      <DialogContent>
        <TextField
          value={title ?? ''}
          onChange={(e) => setTitle(e.currentTarget.value)}
          className="w-[400px]"
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          color="error"
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('cancel')}
        </Button>
        <LoadingButton
          loading={loading}
          onClick={async () => {
            if (title == null || title === '') {
              setSnackbarMessage({
                message: 'emptyField',
                severity: 'error',
              });
              setSnackbarOpen(true);
              return;
            }
            setLoading(true);
            await handleSubmit(title);
            setLoading(false);

            handleClose();
          }}
          color="primary"
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('submit')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
