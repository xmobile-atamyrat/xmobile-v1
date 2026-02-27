import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import Layout from '@/pages/components/Layout';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { colors, interClassname } from '@/styles/theme';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { UserRole } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useState } from 'react';

interface Props {
  initialHardMin: string;
  initialSoftMin: string;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken || refreshToken === undefined)
    return { redirect: { destination: '/', permanent: false } };

  try {
    const decoded = await verifyToken(refreshToken, REFRESH_SECRET);
    if (decoded.grade !== UserRole.SUPERUSER) {
      return { redirect: { destination: '/', permanent: false } };
    }
  } catch {
    return { redirect: { destination: '/', permanent: false } };
  }

  const { default: dbClient } = await import('@/lib/dbClient');
  const appVersion = await dbClient.appVersion.findUnique({
    where: { platform: 'ALL' },
  });

  return {
    props: {
      messages: (await import(`../../i18n/${ctx.locale}.json`)).default,
      initialHardMin: appVersion?.hardMinVersion ?? '1.0.0',
      initialSoftMin: appVersion?.softMinVersion ?? '1.0.0',
    },
  };
};

export default function AppVersionAdminPage({
  initialHardMin,
  initialSoftMin,
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken, isLoading: isUserLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [hardMin, setHardMin] = useState(initialHardMin);
  const [softMin, setSoftMin] = useState(initialSoftMin);
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success',
  );
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const isAuthorized = user && user.grade === UserRole.SUPERUSER;

  if (!isUserLoading && !isAuthorized) {
    router.push('/');
  }

  if (isUserLoading || !isAuthorized) {
    return null;
  }

  const handleSave = async () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(hardMin) || !semverRegex.test(softMin)) {
      showSnackbar(t('appVersionFormatDesc'), 'error');
      return;
    }

    setLoading(true);
    try {
      if (!accessToken) {
        showSnackbar('No access token found', 'error');
        setLoading(false);
        return;
      }

      const response = await fetchWithCreds({
        accessToken,
        path: '/api/app-version',
        method: 'PUT',
        body: { hardMinVersion: hardMin, softMinVersion: softMin },
      });

      if (response.success) {
        showSnackbar(t('appVersionSaveSuccess'), 'success');
      } else {
        showSnackbar(t('appVersionSaveError'), 'error');
      }
    } catch (error) {
      console.error('Failed to save app version:', error);
      showSnackbar(t('serverError'), 'error');
    } finally {
      setLoading(false);
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
        {/* Header */}
        <Box className="flex flex-row items-center gap-2">
          <SystemUpdateAltIcon
            sx={{ fontSize: isMdUp ? 28 : 24, color: colors.main }}
          />
          <Typography
            fontWeight={700}
            fontSize={isMdUp ? 22 : 18}
            className={interClassname.className}
          >
            {t('appVersions')}
          </Typography>
        </Box>

        <Divider />

        {/* Hard Min Version */}
        <Box className="flex flex-col gap-1 max-w-[480px]">
          <Typography
            fontWeight={600}
            fontSize={isMdUp ? 16 : 14}
            className={interClassname.className}
          >
            {t('appVersionHardMin')}
          </Typography>
          <TextField
            value={hardMin}
            onChange={(e) => setHardMin(e.target.value)}
            placeholder="1.0.0"
            size="small"
            sx={{ mt: 0.5, maxWidth: 200 }}
          />
        </Box>

        <Divider />

        {/* Soft Min Version */}
        <Box className="flex flex-col gap-1 max-w-[480px]">
          <Typography
            fontWeight={600}
            fontSize={isMdUp ? 16 : 14}
            className={interClassname.className}
          >
            {t('appVersionSoftMin')}
          </Typography>
          <TextField
            value={softMin}
            onChange={(e) => setSoftMin(e.target.value)}
            placeholder="1.0.0"
            size="small"
            sx={{ mt: 0.5, maxWidth: 200 }}
          />
        </Box>

        <Divider />

        <Box className="flex flex-col gap-1 mb-4">
          <Typography
            fontSize={isMdUp ? 13 : 12}
            color="text.secondary"
            className={interClassname.className}
            fontStyle="italic"
          >
            {t('appVersionFormatDesc')}
          </Typography>
        </Box>

        {/* Save button */}
        <Box>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontSize: isMdUp ? 16 : 14,
              height: isMdUp ? 44 : 38,
              minWidth: 120,
              backgroundColor: loading ? colors.placeholder : colors.main,
              '&:hover': {
                backgroundColor: colors.buttonHoverBg,
              },
            }}
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {loading ? t('loading') : t('save')}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setSnackbarOpen(false);
        }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
