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
import ReplayIcon from '@mui/icons-material/Replay';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Snackbar,
  Switch,
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

interface Config {
  enabled: boolean;
  maxRetries: number;
  baseDelaySec: number;
  backoffMultiplier: number;
  maxDelaySec: number;
}

interface Props {
  initialConfig: Config;
}

const DEFAULTS: Config = {
  enabled: true,
  maxRetries: 3,
  baseDelaySec: 30,
  backoffMultiplier: 2.0,
  maxDelaySec: 3600,
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken)
    return {
      redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
    };

  try {
    const decoded = await verifyToken(refreshToken, REFRESH_SECRET);
    if (decoded.grade !== UserRole.SUPERUSER) {
      return {
        redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
      };
    }
  } catch {
    return {
      redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
    };
  }

  const { default: dbClient } = await import('@/lib/dbClient');
  const config = await dbClient.pushRetryConfig.findUnique({
    where: { id: 1 },
  });

  return {
    props: {
      messages: (await import(`../../i18n/${ctx.locale}.json`)).default,
      initialConfig: config
        ? {
            enabled: config.enabled,
            maxRetries: config.maxRetries,
            baseDelaySec: config.baseDelaySec,
            backoffMultiplier: config.backoffMultiplier,
            maxDelaySec: config.maxDelaySec,
          }
        : DEFAULTS,
    },
  };
};

export default function PushRetryConfigPage({ initialConfig }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken, isLoading: isUserLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [maxRetries, setMaxRetries] = useState(
    String(initialConfig.maxRetries),
  );
  const [baseDelaySec, setBaseDelaySec] = useState(
    String(initialConfig.baseDelaySec),
  );
  const [backoffMultiplier, setBackoffMultiplier] = useState(
    String(initialConfig.backoffMultiplier),
  );
  const [maxDelaySec, setMaxDelaySec] = useState(
    String(initialConfig.maxDelaySec),
  );
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

  const numberField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
  ) => (
    <Box className="flex flex-col gap-1 max-w-[480px]">
      <Typography
        fontWeight={600}
        fontSize={isMdUp ? 16 : 14}
        className={interClassname.className}
      >
        {label}
      </Typography>
      <TextField
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="number"
        size="small"
        sx={{ mt: 0.5, maxWidth: 200 }}
      />
    </Box>
  );

  const handleSave = async () => {
    const body = {
      enabled,
      maxRetries: Number(maxRetries),
      baseDelaySec: Number(baseDelaySec),
      backoffMultiplier: Number(backoffMultiplier),
      maxDelaySec: Number(maxDelaySec),
    };

    if (
      [
        body.maxRetries,
        body.baseDelaySec,
        body.backoffMultiplier,
        body.maxDelaySec,
      ].some((n) => Number.isNaN(n)) ||
      body.maxDelaySec < body.baseDelaySec ||
      body.backoffMultiplier < 1
    ) {
      showSnackbar(t('pushRetryInvalid'), 'error');
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
        path: '/api/push-retry-config',
        method: 'PUT',
        body,
      });

      if (response.success) {
        showSnackbar(t('pushRetrySaveSuccess'), 'success');
      } else {
        showSnackbar(t('pushRetrySaveError'), 'error');
      }
    } catch (error) {
      console.error('Failed to save push retry config:', error);
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
        <Box className="flex flex-row items-center gap-2">
          <ReplayIcon sx={{ fontSize: isMdUp ? 28 : 24, color: colors.main }} />
          <Typography
            fontWeight={700}
            fontSize={isMdUp ? 22 : 18}
            className={interClassname.className}
          >
            {t('pushRetryConfig')}
          </Typography>
        </Box>

        <Divider />

        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          }
          label={t('pushRetryEnabled')}
        />

        <Divider />

        {numberField(t('pushRetryMaxRetries'), maxRetries, setMaxRetries)}
        <Divider />
        {numberField(t('pushRetryBaseDelay'), baseDelaySec, setBaseDelaySec)}
        <Divider />
        {numberField(
          t('pushRetryMultiplier'),
          backoffMultiplier,
          setBackoffMultiplier,
        )}
        <Divider />
        {numberField(t('pushRetryMaxDelay'), maxDelaySec, setMaxDelaySec)}

        <Divider />

        <Box className="flex flex-col gap-1 mb-4">
          <Typography
            fontSize={isMdUp ? 13 : 12}
            color="text.secondary"
            className={interClassname.className}
            fontStyle="italic"
          >
            {t('pushRetryDesc')}
          </Typography>
        </Box>

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
