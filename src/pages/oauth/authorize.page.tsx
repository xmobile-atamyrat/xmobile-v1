import { AUTHORIZE_PARAM_NAMES } from '@/lib/mcp/config';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { fontClassName, navy } from '@/styles/theme';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { UserRole } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useState } from 'react';

type Props = {
  request: {
    clientName: string;
    redirectHost: string;
    /** Whether the client gets the tools that add images (ChatGPT only). */
    canUpload: boolean;
  } | null;
  params: Record<string, string>;
};

/**
 * Where an AI app (ChatGPT) sends a superuser to approve a connection, as
 * the OAuth `authorization_endpoint`. The request is checked here before
 * anything is shown, and checked again by /api/mcp/oauth/approve.
 */
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const [
    { mcpOrigin },
    { OAuthError, validateAuthorizeRequest },
    { clientCanSendFiles, findClient },
  ] = await Promise.all([
    import('@/lib/mcp/config'),
    import('@/lib/mcp/oauthStore'),
    import('@/lib/mcp/clients'),
  ]);
  const origin = mcpOrigin();
  if (origin == null) return { notFound: true };

  // A consent page inside someone else's frame could be clickjacked into an
  // approval.
  ctx.res.setHeader('X-Frame-Options', 'DENY');
  ctx.res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  ctx.res.setHeader('Cache-Control', 'no-store');
  ctx.res.setHeader('Referrer-Policy', 'no-referrer');
  ctx.res.setHeader('X-Robots-Tag', 'noindex');

  const params: Record<string, string> = {};
  AUTHORIZE_PARAM_NAMES.forEach((name) => {
    const value = ctx.query[name];
    if (typeof value === 'string') params[name] = value;
  });
  let request: Props['request'] = null;
  try {
    const valid = await validateAuthorizeRequest(origin, params);
    request = {
      clientName: valid.clientName,
      redirectHost: valid.redirectHost,
      canUpload: clientCanSendFiles(findClient(valid.clientId)),
    };
  } catch (error) {
    // The client and its redirect checked out: the error is the client's to
    // see (RFC 6749 §4.1.2.1). Before that, it stays on this page.
    if (error instanceof OAuthError && error.redirectTo != null) {
      return { redirect: { destination: error.redirectTo, permanent: false } };
    }
    request = null;
  }
  const locale = ctx.locale ?? 'ru';
  return {
    props: {
      messages: (await import(`../../i18n/${locale}.json`)).default,
      request,
      params: request != null ? params : {},
    },
  };
};

export default function AuthorizePage({ request, params }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const { user, accessToken, isLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const decide = async (decision: 'approve' | 'deny') => {
    setBusy(true);
    setFailed(false);
    try {
      const result = (await fetchWithCreds({
        accessToken: accessToken ?? '',
        path: '/api/mcp/oauth/approve',
        method: 'POST',
        body: { ...params, decision },
      })) as unknown as { redirectTo?: string };
      if (typeof result.redirectTo === 'string') {
        window.location.assign(result.redirectTo);
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  let body: JSX.Element;
  if (request == null) {
    body = <Typography>{t('mcpConnectInvalid')}</Typography>;
  } else if (isLoading) {
    body = <CircularProgress sx={{ alignSelf: 'center' }} />;
  } else if (user == null) {
    body = (
      <>
        <Typography>{t('mcpConnectSignIn')}</Typography>
        <Button
          variant="contained"
          onClick={() =>
            router.push(
              `/user/signin?next=${encodeURIComponent(router.asPath)}`,
            )
          }
        >
          {t('signin')}
        </Button>
      </>
    );
  } else if (user.grade !== UserRole.SUPERUSER) {
    body = (
      <>
        <Typography>{t('mcpConnectNotSuperuser')}</Typography>
        <Button
          variant="outlined"
          disabled={busy}
          onClick={() => decide('deny')}
        >
          {t('cancel')}
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <Typography variant="h6" component="h1" sx={{ color: navy }}>
          {t('mcpConnectTitle', { client: request.clientName })}
        </Typography>
        <Typography>
          {t(request.canUpload ? 'mcpConnectBody' : 'mcpConnectBodyNoUploads', {
            client: request.clientName,
          })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('mcpConnectRedirect', { host: request.redirectHost })}
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => decide('deny')}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => decide('approve')}
          >
            {t('mcpConnectAllow')}
          </Button>
        </Stack>
      </>
    );
  }

  return (
    <Box
      className={fontClassName.className}
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 480, width: '100%' }}>
        <Stack spacing={2}>
          <Typography variant="overline" sx={{ color: navy }}>
            xmobile
          </Typography>
          {body}
          {failed && <Typography color="error">{t('serverError')}</Typography>}
        </Stack>
      </Paper>
    </Box>
  );
}
