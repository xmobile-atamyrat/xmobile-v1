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
  handleCreate: (name: string, value: string) => Promise<boolean>;
}

export default function AddPrice({ handleClose, handleCreate }: AddPriceProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>{t('addPrice')}</DialogTitle>
      <DialogContent>
        <Box className={`flex flex-col gap-2 w-[${isMdUp ? '500' : '250'}px]`}>
          <TextField
            placeholder={t('productName')}
            onChange={(e) => {
              setName(e.target.value);
            }}
            className="w-full"
          />
          <TextField
            placeholder={t('price')}
            onChange={(e) => {
              setValue(e.target.value);
            }}
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
            const success = await handleCreate(name, value);
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
