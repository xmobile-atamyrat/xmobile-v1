import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface AddColorProps {
  brands: { id: string; name: string }[];
  initialBrandId?: string;
  handleClose: () => void;
  handleCreate: (
    name: string,
    hex: string,
    brandId: string | null,
  ) => Promise<boolean>;
}

export default function AddColor({
  brands,
  initialBrandId,
  handleClose,
  handleCreate,
}: AddColorProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#000000');
  const [brandId, setBrandId] = useState(initialBrandId ?? '');

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
          <FormControl style={{ width }}>
            <InputLabel id="add-color-brand">{t('brand')}</InputLabel>
            <Select
              labelId="add-color-brand"
              label={t('brand')}
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <MenuItem value="">
                <em>{t('noBrand')}</em>
              </MenuItem>
              {[...brands]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((brand) => (
                  <MenuItem value={brand.id} key={brand.id}>
                    {brand.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
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
            const success = await handleCreate(name, hex, brandId || null);
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
