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
import { useTranslations } from 'next-intl';

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
  const t = useTranslations();

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{t('deleteCategories')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {t('confirmDeleteCategory')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" variant="contained">
          {t('cancel')}
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
          {t('delete')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
