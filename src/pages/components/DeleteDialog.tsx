import LoadingButton from '@mui/lab/LoadingButton';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useState } from 'react';

interface DeleteDialogProps {
  title: string;
  description: string;
  handleClose: () => void;
  handleDelete: () => Promise<void> | void;
  blueButtonText: string;
  redButtonText: string;
}

export default function DeleteDialog({
  description,
  title,
  handleClose,
  handleDelete,
  blueButtonText,
  redButtonText,
}: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);

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
          {blueButtonText}
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
          {redButtonText}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
