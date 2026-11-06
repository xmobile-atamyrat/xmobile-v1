import {
  CategoryOption,
  categoryMenuItems,
} from '@/pages/product/components/categoryOptions';
import { parsePrice } from '@/pages/product/utils';
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
import { DollarRate } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

// Creating a price no longer offers a product to attach it to: connecting a
// price to a product happens in one place now, the product's own edit form,
// which is the only one that can refuse to break a reference still in use.
interface AddPriceProps {
  handleClose: () => void;
  handleCreate: (
    name: string,
    priceInDollars: string,
    priceInManat: string,
    categoryId: string | null,
    dollarRateId: number | null,
  ) => Promise<boolean>;
  rates: DollarRate[];
  defaultRateId: number | null;
  defaultCategoryId: string | null;
  categoryOptions: CategoryOption[];
}

export default function AddPrice({
  handleClose,
  handleCreate,
  rates,
  defaultRateId,
  defaultCategoryId,
  categoryOptions,
}: AddPriceProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [name, setName] = useState('');
  const [valueInDollars, setValueInDollars] = useState('');
  const [valueInManat, setValueInManat] = useState('');
  // Optional: a price may be created uncategorized and assigned from the table.
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  // Null until the admin picks one, so a dialog opened before the rates load
  // still lands on the default once they arrive.
  const [pickedRateId, setPickedRateId] = useState<number | null>(null);
  const rateId = pickedRateId ?? defaultRateId;
  const rateValue = (id: number | null) =>
    rates.find((rate) => rate.id === id)?.rate ?? 0;
  const dollarRate = rateValue(rateId);
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
          <FormControl sx={{ width: isMdUp ? '450px' : '250px' }} size="medium">
            <InputLabel>{t('rate')}</InputLabel>
            <Select
              label={t('rate')}
              value={rateId == null ? '' : String(rateId)}
              onChange={(e) => {
                const nextRateId = Number(e.target.value);
                setPickedRateId(nextRateId);
                // Dollars are the base figure, so they stay put and the manat
                // follows the new rate.
                if (valueInDollars !== '') {
                  setValueInManat(
                    parsePrice(
                      (
                        parseFloat(valueInDollars) * rateValue(nextRateId)
                      ).toString(),
                    ).toString(),
                  );
                }
              }}
            >
              {rates.map((rate) => (
                <MenuItem key={rate.id} value={String(rate.id)}>
                  {rate.name} ({rate.rate})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
          <FormControl sx={{ width: isMdUp ? '450px' : '250px' }} size="medium">
            <InputLabel>{t('category')}</InputLabel>
            <Select
              label={t('category')}
              value={categoryId ?? ''}
              onChange={(e) =>
                setCategoryId(e.target.value === '' ? null : e.target.value)
              }
            >
              <MenuItem value="">{t('noCategory')}</MenuItem>
              {categoryMenuItems(categoryOptions)}
            </Select>
          </FormControl>
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
              categoryId,
              rateId,
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
