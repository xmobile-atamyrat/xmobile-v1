import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { BrandProps, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { flattenCategories } from '@/pages/product/components/categoryOptions';
import {
  ALL_BRANDS_OPTION,
  ALL_CATEGORIES_OPTION,
  buildBrandPriceSections,
  buildPriceListBlob,
  buildPriceSections,
  cascadeCategorySelection,
  defaultBrandPriceListFileName,
  defaultPriceListFileName,
  priceListFileName,
  toggleAllBrands,
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
  ToggleButton,
  ToggleButtonGroup,
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

/** Which grouping the page exports by — one dropdown is shown at a time. */
type PriceListMode = 'category' | 'brand';

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
  const [mode, setMode] = useState<PriceListMode>('category');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<BrandProps[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  // brandId -> ids of the prices that brand's products reference, derived
  // server-side because prices carry no brand of their own.
  const [brandPriceIds, setBrandPriceIds] = useState<Record<string, string[]>>(
    {},
  );
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

        // Brand mode needs both halves: the brands to list, and the map saying
        // which prices each one reaches. One failing makes the mode unusable,
        // so a single message covers them.
        const [brandsResponse, brandPricesResponse] = await Promise.all([
          fetchWithCreds<BrandProps[]>({
            accessToken,
            path: '/api/brand',
            method: 'GET',
          }),
          fetchWithCreds<Record<string, string[]>>({
            accessToken,
            path: '/api/prices/brands',
            method: 'GET',
          }),
        ]);
        if (
          brandsResponse.success &&
          brandsResponse.data != null &&
          brandPricesResponse.success &&
          brandPricesResponse.data != null
        ) {
          setBrands(
            [...brandsResponse.data].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          );
          setBrandPriceIds(brandPricesResponse.data);
        } else {
          console.error(brandsResponse.message ?? brandPricesResponse.message);
          showSnackbar('fetchBrandsError', 'error');
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const sections = useMemo(
    () =>
      mode === 'brand'
        ? buildBrandPriceSections(
            allPrices,
            brands,
            selectedBrands,
            brandPriceIds,
          )
        : buildPriceSections(
            allPrices,
            categories,
            selectedCategories,
            router.locale ?? 'tk',
          ),
    [
      mode,
      allPrices,
      brands,
      selectedBrands,
      brandPriceIds,
      categories,
      selectedCategories,
      router.locale,
    ],
  );

  const priceCount = sections.reduce(
    (total, section) => total + section.prices.length,
    0,
  );

  const suggestedFileName = useMemo(
    () =>
      mode === 'brand'
        ? defaultBrandPriceListFileName(brands, selectedBrands, new Date())
        : defaultPriceListFileName(
            categories,
            selectedCategories,
            router.locale ?? 'tk',
            new Date(),
          ),
    [
      mode,
      brands,
      selectedBrands,
      categories,
      selectedCategories,
      router.locale,
    ],
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
            {t(
              mode === 'brand'
                ? 'priceListDescriptionBrands'
                : 'priceListDescription',
            )}
          </Typography>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            // `null` arrives when the active button is clicked again; keeping
            // the current mode stops the page from having no grouping at all.
            onChange={(_, next: PriceListMode | null) =>
              setMode((previous) => next ?? previous)
            }
            sx={{ width: 'fit-content' }}
          >
            <ToggleButton value="category" sx={{ textTransform: 'none' }}>
              {t('priceListByCategory')}
            </ToggleButton>
            <ToggleButton value="brand" sx={{ textTransform: 'none' }}>
              {t('priceListByBrand')}
            </ToggleButton>
          </ToggleButtonGroup>

          {mode === 'brand' ? (
            <FormControl sx={{ maxWidth: 480 }} size="small">
              <InputLabel>{t('brands')}</InputLabel>
              <Select
                multiple
                value={selectedBrands}
                label={t('brands')}
                onChange={(event) =>
                  setSelectedBrands((previous) => {
                    const next =
                      typeof event.target.value === 'string'
                        ? event.target.value.split(',')
                        : event.target.value;
                    // Brands do not nest, so there is no cascade here: the
                    // select-all row is the only value that is not a brand id.
                    return next.includes(ALL_BRANDS_OPTION)
                      ? toggleAllBrands(brands, previous)
                      : next;
                  })
                }
                renderValue={(selected) =>
                  brands
                    .filter((brand) => selected.includes(brand.id))
                    .map((brand) => brand.name)
                    .join(', ')
                }
              >
                <MenuItem value={ALL_BRANDS_OPTION} divider>
                  <Checkbox
                    checked={
                      brands.length > 0 &&
                      selectedBrands.length === brands.length
                    }
                    indeterminate={
                      selectedBrands.length > 0 &&
                      selectedBrands.length < brands.length
                    }
                    size="small"
                  />
                  <ListItemText
                    primary={t('selectAllBrands')}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                </MenuItem>
                {brands.map((brand) => (
                  <MenuItem key={brand.id} value={brand.id}>
                    <Checkbox
                      checked={selectedBrands.includes(brand.id)}
                      size="small"
                    />
                    <ListItemText primary={brand.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
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
          )}

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
            {mode === 'brand'
              ? t('priceListSelectedCountBrands', {
                  prices: priceCount,
                  brands: sections.length,
                })
              : t('priceListSelectedCount', {
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
