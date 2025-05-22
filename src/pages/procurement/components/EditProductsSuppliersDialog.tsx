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

interface EditDialogProps {
  title: string;
  description?: string;
  currentName: string;
  handleClose: () => void;
  handleEdit: (name: string) => Promise<void> | void;
}

export default function EditDialog({
  description,
  title,
  handleClose,
  handleEdit,
  currentName,
}: EditDialogProps) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations();
  const [newName, setNewName] = useState<string>(currentName);

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {description && (
          <DialogContentText id="alert-dialog-description">
            {description}
          </DialogContentText>
        )}
        <TextField
          className="w-[400px]"
          value={newName}
          onChange={(e) => {
            setNewName(e.currentTarget.value);
          }}
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
            setLoading(true);
            await handleEdit(newName);
            setLoading(false);

            handleClose();
          }}
          color="primary"
          autoFocus
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('submit')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
