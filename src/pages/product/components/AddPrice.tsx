import { parsePrice } from '@/pages/product/utils';
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
  handleCreate: (
    name: string,
    priceInDollars: string,
    priceInManat: string,
  ) => Promise<boolean>;
  dollarRate: number;
}

export default function AddPrice({
  handleClose,
  handleCreate,
  dollarRate,
}: AddPriceProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [name, setName] = useState('');
  const [valueInDollars, setValueInDollars] = useState('');
  const [valueInManat, setValueInManat] = useState('');
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>{t('addPrice')}</DialogTitle>
      <DialogContent>
        <Box className={`flex flex-col gap-2`}>
          <TextField
            placeholder={t('productName')}
            onChange={(e) => {
              setName(e.target.value);
            }}
            style={{
              width: isMdUp ? '450px' : '250px',
            }}
            required
          />
          <TextField
            value={valueInDollars ?? '0'}
            placeholder={t('priceInDollars')}
            onChange={(e) => {
              const value = e.target.value;
              setValueInDollars(value);
              setValueInManat(
                parsePrice(
                  (parseFloat(value) * dollarRate).toString(),
                ).toString(),
              );
            }}
            type="number"
            style={{
              width: isMdUp ? '450px' : '250px',
            }}
            required
          />
          <TextField
            value={valueInManat ?? '0'}
            placeholder={t('priceInManat')}
            onChange={(e) => {
              const value = e.target.value;
              setValueInManat(value);
              setValueInDollars(
                parsePrice(
                  (parseFloat(value) / dollarRate).toString(),
                ).toString(),
              );
            }}
            type="number"
            style={{
              width: isMdUp ? '450px' : '250px',
            }}
            required
          />
        </Box>
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
            const success = await handleCreate(
              name,
              valueInDollars,
              valueInManat,
            );
            if (success) handleClose();
            setLoading(false);
          }}
          color="primary"
          autoFocus
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('add')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
