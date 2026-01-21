import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { parsePrice } from '@/pages/product/utils';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import { Colors } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

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
  const [name, setName] = useState('');
  const [valueInDollars, setValueInDollars] = useState('');
  const [valueInManat, setValueInManat] = useState('');
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [allColors, setAllColors] = useState<Colors[]>([]);
  const [selectedColor, setSelectedColor] = useState<Colors>();
  const [colorPickerAnchor, setColorPickerAnchor] =
    useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      const response = await fetchWithCreds<Colors[]>({
        accessToken,
        path: '/api/colors',
        method: 'GET',
      });
      if (response.success && response.data) {
        setAllColors(response.data);
      }
    })();
  }, [accessToken]);

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>{t('addPrice')}</DialogTitle>
      <DialogContent>
        <Box className={`flex flex-col gap-4 mt-2`}>
          <TextField
            label={t('productName')}
            onChange={(e) => {
              setName(e.target.value);
            }}
            fullWidth
            required
            size="small"
          />
          <TextField
            value={valueInDollars ?? '0'}
            label={t('priceInDollars')}
            onChange={(e) => {
              const value = e.target.value;
              setValueInDollars(value);
              const computedManat = parsePrice(
                (parseFloat(value) * dollarRate).toString(),
              ).toString();
              setValueInManat(computedManat);
            }}
            type="number"
            fullWidth
            required
            size="small"
          />
          <TextField
            value={valueInManat ?? '0'}
            label={t('priceInManat')}
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
            fullWidth
            required
            size="small"
            InputProps={{
              endAdornment: selectedColor && (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: selectedColor.hex,
                    border: '1px solid #ccc',
                    marginLeft: 1,
                  }}
                />
              ),
            }}
          />

          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2">{t('color') || 'Color'}:</Typography>
            <Button
              variant="outlined"
              onClick={(e) => {
                setColorPickerAnchor(e.currentTarget);
              }}
              sx={{
                minWidth: 60,
                height: 40,
                border: selectedColor
                  ? `2px solid ${selectedColor.hex}`
                  : '1px solid #ccc',
                backgroundColor: selectedColor
                  ? selectedColor.hex
                  : 'transparent',
                '&:hover': {
                  border: selectedColor
                    ? `2px solid ${selectedColor.hex}`
                    : '1px solid #ccc',
                },
              }}
            >
              {selectedColor ? (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: selectedColor.hex,
                    border: '1px solid #fff',
                  }}
                />
              ) : (
                <Typography variant="caption">
                  {t('select') || 'Select'}
                </Typography>
              )}
            </Button>
            {selectedColor && (
              <Button
                size="small"
                color="error"
                onClick={() => {
                  setSelectedColor(undefined);
                }}
              >
                {t('clear') || 'Clear'}
              </Button>
            )}
          </Box>

          <Popover
            open={Boolean(colorPickerAnchor)}
            anchorEl={colorPickerAnchor}
            onClose={() => setColorPickerAnchor(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
          >
            <Box
              sx={{
                p: 2,
                maxWidth: 300,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              {allColors.map((color) => (
                <Box
                  key={color.id}
                  onClick={() => {
                    setSelectedColor(color);
                    setColorPickerAnchor(null);
                  }}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: color.hex,
                    border:
                      selectedColor?.id === color.id
                        ? '3px solid #1976d2'
                        : '2px solid #ccc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      border: '3px solid #1976d2',
                    },
                  }}
                  title={color.name}
                />
              ))}
            </Box>
          </Popover>
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
