import Layout from '@/pages/components/Layout';
import { appBarHeight } from '@/pages/lib/constants';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { BrandProps, ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { categoryIdClasses } from '@/styles/classMaps/category/id';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { homePageClasses } from '@/styles/classMaps';
import { colors, fontClassName } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Snackbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { ReactNode, useCallback, useEffect, useState } from 'react';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

type Brand = Pick<BrandProps, 'id' | 'name'>;

export default function BrandOrderPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const platform = usePlatform();
  const t = useTranslations();
  const { user, accessToken, isLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    message: string;
    severity: 'error' | 'warning';
  }>({ message: '', severity: 'error' });

  const showSnackbar = (message: string, severity: 'error' | 'warning') => {
    setSnackbar({ message, severity });
    setSnackbarOpen(true);
  };

  const isStaff = user != null && ['ADMIN', 'SUPERUSER'].includes(user.grade);

  const handleBackToUser = useCallback(() => {
    router.push('/user');
  }, [router]);

  const loadBrands = useCallback(async () => {
    setLoadError(false);
    try {
      const res: ResponseApi<Brand[]> = await fetchWithoutCreds(
        '/api/brand',
        'GET',
      );
      if (res.success && res.data) {
        setBrands(res.data);
        return;
      }
    } catch {
      // Falls through to the error state.
    }
    setLoadError(true);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/user/signin');
      return;
    }
    if (!isStaff) router.push('/');
  }, [user, isStaff, isLoading, router]);

  useEffect(() => {
    if (isStaff) loadBrands();
  }, [isStaff, loadBrands]);

  const move = async (index: number, offset: -1 | 1) => {
    if (brands == null || !accessToken) return;
    const next = [...brands];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setBusy(true);
    try {
      const res = await fetchWithCreds({
        accessToken,
        path: '/api/brand',
        method: 'PATCH',
        body: { order: next.map((brand) => brand.id) },
      });
      if (res.success) {
        setBrands(next);
      } else if (res.message === 'brandOrderStale') {
        await loadBrands();
        showSnackbar(t('brandOrderStale'), 'warning');
      } else {
        showSnackbar(t('brandOrderSaveError'), 'error');
      }
    } catch {
      showSnackbar(t('brandOrderSaveError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!isLoading && !isStaff) return null;

  let list: ReactNode;
  if (loadError) {
    list = (
      <Typography color="error" className={fontClassName.className}>
        {t('fetchBrandsError')}
      </Typography>
    );
  } else if (brands == null) {
    list = (
      <Box className="flex justify-center py-8">
        <CircularProgress />
      </Box>
    );
  } else {
    list = (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        {brands.length === 0 && (
          <Typography
            className={fontClassName.className}
            sx={{ p: 2 }}
            color="text.secondary"
          >
            {t('noBrands')}
          </Typography>
        )}
        {brands.map((brand, i) => (
          <Box
            key={brand.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              pl: 1.5,
              py: 0.75,
              pr: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              className={fontClassName.className}
              sx={{ flex: 1, minWidth: 0 }}
              fontSize={15}
            >
              {brand.name}
            </Typography>
            <Tooltip title={t('moveBrandUp')}>
              <span>
                <IconButton
                  size="small"
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={t('moveBrandUp')}
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('moveBrandDown')}>
              <span>
                <IconButton
                  size="small"
                  disabled={busy || i === brands.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t('moveBrandDown')}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Layout handleHeaderBackButton={handleBackToUser}>
      <Box
        className={`${categoryIdClasses.boxes.main[platform]} flex flex-col gap-4 w-full max-w-[720px] mx-auto`}
        sx={{
          mt: isMdUp ? `${appBarHeight * 1.25}px` : undefined,
          px: isMdUp ? 4 : 2,
          pb: 4,
        }}
      >
        <Box className={categoryIdClasses.boxes.header[platform]}>
          <IconButton
            size="medium"
            edge="start"
            color="inherit"
            className={appbarClasses.backButton[platform]}
            aria-label={t('back')}
            onClick={handleBackToUser}
          >
            <ArrowBackIosIcon
              className={appbarClasses.arrowBackIos[platform]}
            />
          </IconButton>
          <Box className="flex w-full justify-center">
            <Typography
              className={`${fontClassName.className} ${homePageClasses.categoriesText[platform]}`}
            >
              {t('brandOrder')}
            </Typography>
          </Box>
        </Box>

        <Box className="hidden md:flex flex-row items-center gap-2">
          <FormatListNumberedIcon sx={{ fontSize: 28, color: colors.main }} />
          <Typography
            fontWeight={700}
            fontSize={22}
            className={fontClassName.className}
          >
            {t('brandOrder')}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          className={fontClassName.className}
          sx={{ lineHeight: 1.5 }}
        >
          {t('brandOrderSubtitle')}
        </Typography>

        {list}
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbarOpen(false)}
          className={fontClassName.className}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
