import { parseName } from '@/pages/lib/utils';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useState } from 'react';

interface OutOfStockDialogProps {
  /** Out-of-stock cart items; `name` is the raw locale-keyed JSON blob. */
  items: { id: string; name: string }[];
  onClose: () => void;
  onRemove: () => Promise<void>;
  /** When provided, renders a back-to-cart action (checkout page only). */
  onBackToCart?: () => void;
}

export default function OutOfStockDialog({
  items,
  onClose,
  onRemove,
  onBackToCart,
}: OutOfStockDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle id="out-of-stock-dialog-title">
        {t('outOfStockInCartTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="out-of-stock-dialog-description">
          {t('outOfStockInCartDescription')}
        </DialogContentText>
        <Box className="mt-3 flex flex-col gap-1">
          {items.map((item) => (
            <Typography key={item.id} className="font-semibold">
              {parseName(item.name, router.locale ?? 'tk')}
            </Typography>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="primary"
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('cancel')}
        </Button>
        {onBackToCart && (
          <Button
            onClick={onBackToCart}
            color="primary"
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            {t('backToCart')}
          </Button>
        )}
        <LoadingButton
          loading={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await onRemove();
            } finally {
              setLoading(false);
            }
          }}
          color="error"
          autoFocus
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('removeOutOfStockItems')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
