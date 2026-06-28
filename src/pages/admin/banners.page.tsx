import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import AddEditBannerDialog from '@/pages/components/AddEditBannerDialog';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import { deleteBanner, fetchAllBanners } from '@/pages/lib/apis';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import {
  getBannerMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
} from '@/pages/lib/mediaUrls';
import { PromoBannerData } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { colors, interClassname } from '@/styles/theme';
import AddIcon from '@mui/icons-material/Add';
import CollectionsIcon from '@mui/icons-material/Collections';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Snackbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { UserRole } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

type SnackbarSeverity = 'error' | 'warning' | 'success';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  const redirectHome = {
    redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
  };
  if (!refreshToken) return redirectHome;

  try {
    const decoded = await verifyToken(refreshToken, REFRESH_SECRET);
    if (
      decoded.grade !== UserRole.ADMIN &&
      decoded.grade !== UserRole.SUPERUSER
    ) {
      return redirectHome;
    }
  } catch {
    return redirectHome;
  }

  return {
    props: {
      messages: (await import(`../../i18n/${ctx.locale}.json`)).default,
    },
  };
};

export default function BannersAdminPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken, isLoading: isUserLoading } = useUserContext();

  const [banners, setBanners] = useState<PromoBannerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromoBannerData | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] =
    useState<SnackbarSeverity>('success');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const showSnackbar = (message: string, severity: SnackbarSeverity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const isAuthorized =
    user &&
    (user.grade === UserRole.ADMIN || user.grade === UserRole.SUPERUSER);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllBanners(accessToken);
      setBanners(data);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthorized) loadBanners();
  }, [isAuthorized, loadBanners]);

  if (!isUserLoading && !isAuthorized) {
    router.push('/');
  }
  if (isUserLoading || !isAuthorized) {
    return null;
  }

  const handleDialogSuccess = (
    message: string,
    severity: SnackbarSeverity = 'success',
  ) => {
    showSnackbar(message, severity);
    if (severity === 'success') loadBanners();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteBanner(deletingId, accessToken);
      showSnackbar(t('bannerDeleted'), 'success');
      await loadBanners();
    } catch (error) {
      showSnackbar((error as Error).message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Layout handleHeaderBackButton={() => router.push('/user')}>
      <Box
        sx={{
          mt: isMdUp
            ? `${appBarHeight * 1.25}px`
            : `${mobileAppBarHeight * 1.25}px`,
          px: isMdUp ? 4 : 2,
        }}
        className="flex flex-col gap-6 w-full"
      >
        <Box className="flex flex-row items-center justify-between gap-2">
          <Box className="flex flex-row items-center gap-2">
            <CollectionsIcon
              sx={{ fontSize: isMdUp ? 28 : 24, color: colors.main }}
            />
            <Typography
              fontWeight={700}
              fontSize={isMdUp ? 22 : 18}
              className={interClassname.className}
            >
              {t('promoBanners')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none' }}
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            {t('addBanner')}
          </Button>
        </Box>

        <Divider />

        {loading && (
          <Box className="flex justify-center py-10">
            <CircularProgress />
          </Box>
        )}

        {!loading && banners.length === 0 && (
          <Typography color="text.secondary">{t('noBanners')}</Typography>
        )}

        {!loading && banners.length > 0 && (
          <Box className="flex flex-col gap-3">
            {banners.map((banner) => (
              <Box
                key={banner.id}
                className="flex flex-row items-center gap-4 border border-[#eee] rounded-[10px] p-3"
              >
                <img
                  alt="banner"
                  src={
                    getBannerMediaUrl(banner.imgUrls.default) ??
                    PRODUCT_IMAGE_FALLBACK
                  }
                  width={isMdUp ? 160 : 96}
                  style={{
                    aspectRatio: '3 / 1',
                    objectFit: 'cover',
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                  onError={(error) => {
                    error.currentTarget.onerror = null;
                    error.currentTarget.src = PRODUCT_IMAGE_FALLBACK;
                  }}
                />
                <Box className="flex flex-col gap-1 flex-1 min-w-0">
                  <Box className="flex flex-row items-center gap-2 flex-wrap">
                    <Chip
                      size="small"
                      label={
                        banner.isActive
                          ? t('bannerActive')
                          : t('bannerInactive')
                      }
                      color={banner.isActive ? 'success' : 'default'}
                    />
                    <Typography fontSize={13} color="text.secondary">
                      {t('bannerSortOrder')}: {banner.sortOrder}
                    </Typography>
                  </Box>
                  {banner.redirectUrl ? (
                    <Typography fontSize={13} className="truncate">
                      {t('bannerRedirect')}: {banner.redirectUrl}
                    </Typography>
                  ) : (
                    <Typography fontSize={13} color="text.secondary">
                      {t('bannerRedirectNone')}
                    </Typography>
                  )}
                  {(banner.startsAt || banner.endsAt) && (
                    <Typography fontSize={12} color="text.secondary">
                      {banner.startsAt
                        ? new Date(banner.startsAt).toLocaleString()
                        : '…'}{' '}
                      —{' '}
                      {banner.endsAt
                        ? new Date(banner.endsAt).toLocaleString()
                        : '…'}
                    </Typography>
                  )}
                </Box>
                <Box className="flex flex-row gap-1">
                  <IconButton
                    onClick={() => {
                      setEditing(banner);
                      setDialogOpen(true);
                    }}
                  >
                    <EditOutlinedIcon color="primary" />
                  </IconButton>
                  <IconButton onClick={() => setDeletingId(banner.id)}>
                    <DeleteOutlinedIcon color="error" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {dialogOpen && (
        <AddEditBannerDialog
          banner={editing}
          existingBanners={banners}
          handleClose={() => setDialogOpen(false)}
          onSuccess={handleDialogSuccess}
        />
      )}

      {deletingId != null && (
        <DeleteDialog
          title={t('deleteBannerTitle')}
          description={t('deleteBannerDescription')}
          handleClose={() => setDeletingId(null)}
          handleDelete={handleDelete}
        />
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
