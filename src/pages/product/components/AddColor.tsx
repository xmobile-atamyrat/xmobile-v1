import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface AddColorProps {
  handleClose: () => void;
  handleCreate: (name: string, hex: string) => Promise<boolean>;
}

export default function AddColor({ handleClose, handleCreate }: AddColorProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#000000');

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>{t('addColor')}</DialogTitle>
      <DialogContent>
        <Box className={`flex flex-col gap-2`}>
          <TextField
            placeholder={t('colorName')}
            onChange={(e) => {
              setName(e.target.value);
            }}
            fullWidth
            required
            sx={{ mt: 1 }}
          />
          <TextField
            value={hex}
            type="color"
            label={t('colorCode')}
            onChange={(e) => {
              setHex(e.target.value);
            }}
            fullWidth
            required
            sx={{ mt: 1 }}
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
            const success = await handleCreate(name, hex);
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
