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
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import BASE_URL from '@/lib/ApiEndpoints';

interface DeleteCategoriesDialogProps {
  handleClose: () => void;
  handleDelete: () => Promise<void>;
}

export default function DeleteCategoriesDialog({
  handleClose,
  handleDelete,
}: DeleteCategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setCategories } = useCategoryContext();
  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{'Delete Categories'}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          Are you sure you want to delete the selected categories? All the
          subcategories and products will be deleted as well.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" variant="contained">
          Cancel
        </Button>
        <LoadingButton
          loading={loading}
          onClick={async () => {
            setLoading(true);
            await handleDelete();
            const {
              success: catSuccess,
              data: categories,
            }: ResponseApi<ExtendedCategory[]> = await (
              await fetch(`${BASE_URL}/api/category`)
            ).json();

            if (catSuccess && categories) setCategories(categories);
            handleClose();
            setLoading(false);
          }}
          color="error"
          autoFocus
          variant="contained"
        >
          Delete
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
