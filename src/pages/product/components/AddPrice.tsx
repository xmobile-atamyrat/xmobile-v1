import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface AddPriceProps {
  handleClose: () => void;
  handleCreate: () => Promise<void>;
}

export default function AddPrice({ handleClose, handleCreate }: AddPriceProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>{t('addPrice')}</DialogTitle>
      <DialogContent>
        <Box
          className={`flex flex-col gap-2 min-w-[${isMdUp ? '300' : '250'}px]`}
        >
          <TextField placeholder={t('productName')} />
          <TextField placeholder={t('price')} />
        </Box>
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
            await handleCreate();
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
