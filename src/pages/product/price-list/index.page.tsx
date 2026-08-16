import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { flattenCategories } from '@/pages/product/components/categoryOptions';
import {
  ALL_CATEGORIES_OPTION,
  buildPriceListBlob,
  buildPriceSections,
  cascadeCategorySelection,
  defaultPriceListFileName,
  priceListFileName,
  toggleAllCategories,
} from '@/pages/product/price-list/lib';
import DownloadIcon from '@mui/icons-material/Download';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DollarRate, Prices, UserRole } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function PriceList() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken } = useUserContext();
  const { categories } = useCategoryContext();
  const fetchWithCreds = useFetchWithCreds();
  const [allPrices, setAllPrices] = useState<Prices[]>([]);
  const [dollarRate, setDollarRate] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileNameEdited, setFileNameEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  const isStaff =
    user?.grade === UserRole.SUPERUSER || user?.grade === UserRole.ADMIN;

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarOpen(true);
    setSnackbarMessage({ message, severity });
  };

  const flattenedCats = useMemo(
    () => flattenCategories(categories, router.locale ?? 'tk'),
    [categories, router.locale],
  );

  useEffect(() => {
    if (accessToken) {
      (async () => {
        const pricesResponse = await fetchWithCreds<Prices[]>({
          accessToken,
          path: '/api/prices',
          method: 'GET',
        });
        if (pricesResponse.success && pricesResponse.data != null) {
          setAllPrices(pricesResponse.data);
        } else {
          console.error(pricesResponse.message);
          showSnackbar('fetchPricesError', 'error');
        }

        // The rate drives the sheet's manat formula. Without it the export
        // still works, falling back to each price's stored manat value.
        const rateResponse = await fetchWithCreds<DollarRate>({
          accessToken,
          path: '/api/prices/rate?currency=TMT',
          method: 'GET',
        });
        if (rateResponse.success && rateResponse.data != null) {
          setDollarRate(rateResponse.data.rate);
        } else {
          console.error(rateResponse.message);
          showSnackbar('fetchDollarRateError', 'error');
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const sections = useMemo(
    () =>
      buildPriceSections(
        allPrices,
        categories,
        selectedCategories,
        router.locale ?? 'tk',
      ),
    [allPrices, categories, selectedCategories, router.locale],
  );

  const priceCount = sections.reduce(
    (total, section) => total + section.prices.length,
    0,
  );

  const suggestedFileName = useMemo(
    () =>
      defaultPriceListFileName(
        categories,
        selectedCategories,
        router.locale ?? 'tk',
        new Date(),
      ),
    [categories, selectedCategories, router.locale],
  );

  // The box follows the selection until it is typed in, and then stops: a name
  // someone wrote by hand must survive the next category click.
  useEffect(() => {
    if (!fileNameEdited) setFileName(suggestedFileName);
  }, [suggestedFileName, fileNameEdited]);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const blob = await buildPriceListBlob(sections, dollarRate);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = priceListFileName(fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      showSnackbar('downloadPricesError', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {isStaff && (
        <Box
          sx={{
            mt: isMdUp
              ? `${appBarHeight * 1.25}px`
              : `${mobileAppBarHeight * 1.25}px`,
            px: isMdUp ? 4 : 1,
          }}
          className="flex flex-col gap-4 w-full h-full pb-8"
        >
          <Typography fontWeight={600} fontSize={isMdUp ? 20 : 18}>
            {t('downloadPriceList')}
          </Typography>
          <Typography fontSize={isMdUp ? 16 : 14}>
            {t('priceListDescription')}
          </Typography>

          <FormControl sx={{ maxWidth: 480 }} size="small">
            <InputLabel>{t('categories')}</InputLabel>
            <Select
              multiple
              value={selectedCategories}
              label={t('categories')}
              onChange={(event) =>
                setSelectedCategories((previous) => {
                  const next =
                    typeof event.target.value === 'string'
                      ? event.target.value.split(',')
                      : event.target.value;
                  // The select-all row is not a category: it never reaches the
                  // cascade, it replaces the selection outright.
                  return next.includes(ALL_CATEGORIES_OPTION)
                    ? toggleAllCategories(categories, previous)
                    : cascadeCategorySelection(categories, previous, next);
                })
              }
              renderValue={(selected) =>
                flattenedCats
                  .filter((option) => selected.includes(option.id))
                  .map((option) => option.name)
                  .join(', ')
              }
            >
              <MenuItem value={ALL_CATEGORIES_OPTION} divider>
                <Checkbox
                  checked={
                    flattenedCats.length > 0 &&
                    selectedCategories.length === flattenedCats.length
                  }
                  indeterminate={
                    selectedCategories.length > 0 &&
                    selectedCategories.length < flattenedCats.length
                  }
                  size="small"
                />
                <ListItemText
                  primary={t('selectAllCategories')}
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
              </MenuItem>
              {flattenedCats.map((option) => (
                <MenuItem
                  key={option.id}
                  value={option.id}
                  sx={{ pl: 2 + option.depth * 1.5 }}
                >
                  <Checkbox
                    checked={selectedCategories.includes(option.id)}
                    size="small"
                  />
                  <ListItemText primary={option.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={t('priceListFileName')}
            size="small"
            sx={{ maxWidth: 480 }}
            value={fileName}
            onChange={(event) => {
              setFileNameEdited(true);
              setFileName(event.target.value);
            }}
            InputProps={{ endAdornment: '.xlsx' }}
          />

          <Typography fontSize={isMdUp ? 16 : 14}>
            {t('priceListSelectedCount', {
              prices: priceCount,
              categories: sections.length,
            })}
          </Typography>

          <Box className="flex flex-row gap-2">
            <Button
              variant="contained"
              disabled={loading || priceCount === 0}
              startIcon={<DownloadIcon />}
              sx={{
                textTransform: 'none',
                fontSize: isMdUp ? 18 : 16,
                height: isMdUp ? 52 : 42,
              }}
              onClick={handleDownload}
            >
              <Typography>{t('downloadPrices')}</Typography>
            </Button>
          </Box>

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              setSnackbarOpen(false);
            }}
          >
            <Alert
              onClose={() => setSnackbarOpen(false)}
              severity={snackbarMessage?.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbarMessage?.message && t(snackbarMessage.message)}
            </Alert>
          </Snackbar>
        </Box>
      )}
    </Layout>
  );
}
