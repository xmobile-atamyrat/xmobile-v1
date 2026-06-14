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

interface AddColorProps {
  handleClose: () => void;
  handleCreate: (name: string, hex: string) => Promise<boolean>;
}

export default function AddColor({ handleClose, handleCreate }: AddColorProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#000000');

  const width = isMdUp ? '450px' : '250px';

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>{t('addColor')}</DialogTitle>
      <DialogContent>
        <Box className="flex flex-col gap-2 pt-1">
          <TextField
            label={t('productName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width }}
            required
          />
          <Box className="flex flex-row gap-2 items-center" style={{ width }}>
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              style={{
                width: 48,
                height: 48,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
              }}
            />
            <TextField
              label={t('colorHex')}
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="flex-1"
              required
            />
          </Box>
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
