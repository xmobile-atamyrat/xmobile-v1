import { usePlatform } from '@/pages/lib/PlatformContext';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AuthBrandPanel from '@/pages/user/components/AuthBrandPanel';
import { emailCheck } from '@/pages/user/utils';
import { signinClasses } from '@/styles/classMaps/user/signin';
import {
  colors,
  fontClassName,
  hairline,
  muted,
  navy,
  red,
} from '@/styles/theme';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import {
  Box,
  Button,
  CardMedia,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { User } from '@prisma/client';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import cookie from 'cookie';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookieLocale = cookie.parse(context.req.headers.cookie ?? '')[
    LOCALE_COOKIE_NAME
  ];
  const locale =
    context.locale !== context.defaultLocale
      ? context.locale!
      : cookieLocale ?? context.locale ?? 'ru';
  const messages = (await import(`../../i18n/${locale}.json`)).default;
  return { props: { messages } };
};

export default function Signin() {
  const { user, setUser, setAccessToken, isLoading } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations();
  const platform = usePlatform();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/user');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return null;
  }

  // Shared field styling — both inputs render identically (design 52px/radius-12,
  // hairline border, navy on focus). See XMobile.dc.html:862-865, 2127-2129.
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#fff',
      borderRadius: '12px',
      height: platform === 'web' ? '52px' : '54px',
      fontSize: '15px',
      '& fieldset': { borderColor: hairline, borderWidth: '1.5px' },
      '&:hover fieldset': { borderColor: navy },
      '&.Mui-focused fieldset': { borderColor: navy, borderWidth: '1.5px' },
    },
    '& .MuiInputBase-input::placeholder': { color: muted, opacity: 1 },
  };

  return (
    <Box className={signinClasses.boxes.page[platform]}>
      {platform === 'web' && <AuthBrandPanel />}
      <Box className={signinClasses.boxes.formPane[platform]}>
        <Link href="/user" className={signinClasses.backButton[platform]}>
          <ArrowLeft size={20} color={navy} />
        </Link>
        <Box className={signinClasses.boxes.main[platform]}>
          <CardMedia
            component="img"
            src="/logo/xmobile-processed-logo.png"
            className={signinClasses.boxes.logo[platform]}
          />
          <Typography
            className={`${signinClasses.h3[platform]} ${fontClassName.className}`}
            style={{ color: colors.blackText }}
          >
            {t('signin')}
          </Typography>
          <Typography
            className={`${signinClasses.subtitle[platform]} ${fontClassName.className}`}
            style={{ color: muted }}
          >
            {platform === 'web' ? (
              // Mockup:2125 — web moves the sign-up cross-link up under the
              // title; mobile keeps it in the footer row below the form.
              <>
                {`${t('dontHaveAccount')} `}
                <Link href="/user/signup" className={signinClasses.crossLink}>
                  {t('createAccount')}
                </Link>
              </>
            ) : (
              t('signinSubtitle')
            )}
          </Typography>
          <Paper
            className={signinClasses.paper[platform]}
            elevation={0}
            square={false}
            component="form"
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();

              if (errorMessage) setErrorMessage(undefined);

              const formData = new FormData(event.currentTarget);
              const { email, password } = Object.fromEntries(
                formData.entries(),
              );

              const emailMessage = emailCheck(String(email));
              if (emailMessage) {
                setErrorMessage(emailMessage);
                return;
              }
              if (!password) {
                setErrorMessage('errorPasswordInput');
                return;
              }
              try {
                const {
                  success,
                  data,
                  message,
                }: ResponseApi<{ accessToken: string; user: User }> = await (
                  await fetch('/api/user/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                  })
                ).json();
                if (message != null) {
                  setErrorMessage(message);
                } else if (success && data != null) {
                  setUser(data.user);
                  setAccessToken(data.accessToken);
                  await fetch('/api/guest/migrate', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${data.accessToken}`,
                    },
                    credentials: 'include',
                  });
                  router.push('/');
                }
              } catch (error) {
                if (error.name === 'JsonWebTokenError') {
                  console.error((error as Error).message);
                  setErrorMessage('authError');
                } else setErrorMessage((error as Error).message);
              }
            }}
          >
            <Box className={signinClasses.boxes.input[platform]}>
              <Box
                component="label"
                className={`${signinClasses.label[platform]} ${fontClassName.className}`}
                style={{ color: navy }}
              >
                {t('email')}
              </Box>
              <TextField
                fullWidth
                required
                placeholder={t('emailPlaceholder')}
                type="email"
                name="email"
                className={`${fontClassName.className} ${signinClasses.textField[platform]}`}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail size={18} color={muted} />
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            </Box>
            <Box className={signinClasses.boxes.input[platform]}>
              <Box
                component="label"
                className={`${signinClasses.label[platform]} ${fontClassName.className}`}
                style={{ color: '#4A4959' }}
              >
                {t('password')}
              </Box>
              <TextField
                fullWidth
                required
                placeholder={t('passwordPlaceholder')}
                type={showPassword ? 'text' : 'password'}
                name="password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={18} color={muted} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color={muted} />
                        ) : (
                          <Eye size={18} color={muted} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                className={`${fontClassName.className} ${signinClasses.textField[platform]}`}
                sx={fieldSx}
              />
            </Box>
            {errorMessage != null && (
              <Typography
                className={`${signinClasses.error[platform]} ${fontClassName.className}`}
                style={{ color: red }}
              >
                {t(errorMessage)}
              </Typography>
            )}
            <Button
              fullWidth
              variant="contained"
              size="large"
              type="submit"
              disableElevation
              className={`${signinClasses.buttonSubmit[platform]} ${fontClassName.className}`}
              sx={{
                backgroundColor: colors.main,
                '&:hover': { backgroundColor: colors.buttonHoverBg },
                '&:focus': { backgroundColor: colors.buttonHoverBg },
              }}
            >
              {t('signin')}
            </Button>
            <Box className={signinClasses.divider}>
              <span className={signinClasses.dividerLine} />
              <span
                className={`${signinClasses.dividerText} ${fontClassName.className}`}
              >
                {t('or')}
              </span>
              <span className={signinClasses.dividerLine} />
            </Box>
            <Button
              fullWidth
              disableRipple
              onClick={() => router.push('/')}
              className={`${signinClasses.guestButton} ${fontClassName.className}`}
            >
              <UserRound size={18} color={navy} />
              {t('continueAsGuest')}
            </Button>
          </Paper>
        </Box>
        <Box className={signinClasses.boxes.text[platform]}>
          <Typography
            className={`${signinClasses.typography} ${fontClassName.className}`}
            style={{ color: muted }}
          >
            {t('dontHaveAccount')}
          </Typography>
          <Button
            className={`${fontClassName.className} ${signinClasses.buttonRedirect}`}
            style={{ color: navy }}
            onClick={() => router.push('/user/signup')}
          >
            {t('signup')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
