import { usePlatform } from '@/pages/lib/PlatformContext';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { emailCheck } from '@/pages/user/utils';
import { signupClasses } from '@/styles/classMaps/user/signup';
import {
  colors,
  fontClassName,
  hairline,
  muted,
  navy,
  red,
} from '@/styles/theme';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import {
  Box,
  Button,
  CardMedia,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { User } from '@prisma/client';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import cookie from 'cookie';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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

export default function Signup() {
  const { user, setUser, setAccessToken, isLoading } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const t = useTranslations();
  const platform = usePlatform();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const handleToggle = () => {
    setTooltipOpen((prev) => !prev);
  };
  const handleClose = () => {
    setTooltipOpen(false);
  };

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/user');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return null;
  }

  // Shared field styling — all inputs render identically (design 54px/radius-12,
  // hairline border, navy on focus). See XMobile.dc.html:886-891.
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#fff',
      borderRadius: '12px',
      height: platform === 'web' ? '60px' : '54px',
      fontSize: '15px',
      '& fieldset': { borderColor: hairline, borderWidth: '1.5px' },
      '&:hover fieldset': { borderColor: navy },
      '&.Mui-focused fieldset': { borderColor: navy, borderWidth: '1.5px' },
    },
    '& .MuiInputBase-input::placeholder': { color: muted, opacity: 1 },
  };

  return (
    <Box className={signupClasses.boxes.page[platform]}>
      <Link
        href="/user/sign_in_up"
        className={signupClasses.backButton[platform]}
      >
        <ArrowLeft size={20} color={navy} />
      </Link>
      <Box className={signupClasses.boxes.main[platform]}>
        <CardMedia
          component="img"
          src="/logo/xmobile-processed-logo.png"
          className={signupClasses.boxes.logo[platform]}
        />
        <Typography
          className={`${signupClasses.h3[platform]} ${fontClassName.className}`}
          style={{ color: colors.blackText }}
        >
          {t('signup')}
        </Typography>
        <Typography
          className={`${signupClasses.subtitle[platform]} ${fontClassName.className}`}
          style={{ color: muted }}
        >
          {t('signupSubtitle')}
        </Typography>
        <Paper
          className={signupClasses.paper[platform]}
          elevation={0}
          square={false}
          component="form"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();

            if (errorMessage) setErrorMessage(undefined);

            const formData = new FormData(event.currentTarget);
            const { name, email, password, passwordConfirm, phoneNumber } =
              Object.fromEntries(formData.entries());
            const emailMessage = emailCheck(String(email));
            // TEMP: disable password strength checks to allow any password creation.
            // const passwordMessage = passwordCheck(String(password));
            if (emailMessage) {
              setErrorMessage(emailMessage);
              return;
            }
            // if (passwordMessage) {
            //   setErrorMessage(passwordMessage);
            //   return;
            // }
            if (passwordConfirm !== password) {
              setErrorMessage('errorPasswordConfirm');
              return;
            }
            if (!name) {
              setErrorMessage('errorNameInput');
              return;
            }
            try {
              const {
                success,
                data,
                message,
              }: ResponseApi<{ user: User; accessToken: string }> = await (
                await fetch('/api/user/signup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email,
                    password,
                    name,
                    phoneNumber,
                  }),
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
              if (error.name === 'JsonWebTokenError')
                // todo: locale
                setErrorMessage(
                  error.name === 'JsonWebTokenError'
                    ? 'Token Verification Failed'
                    : (error as Error).message,
                );
            }
          }}
        >
          <Box className={signupClasses.boxes.inputs[platform]}>
            <Box className={signupClasses.boxes.input[platform]}>
              <Box
                component="label"
                className={`${signupClasses.label[platform]} ${fontClassName.className}`}
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
            <Box className={signupClasses.boxes.input[platform]}>
              <Box
                component="label"
                className={`${signupClasses.label[platform]} ${fontClassName.className}`}
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
                      <Tooltip
                        title={
                          <Box className={signupClasses.tooltip[platform]}>
                            <Box>{t('passwordTooltip1')}</Box>
                            <Box>{t('passwordTooltip2')}</Box>
                            <Box>{t('passwordTooltip3')}</Box>
                            <Box>{t('passwordTooltip4')}</Box>
                          </Box>
                        }
                        open={tooltipOpen}
                        onClose={handleClose}
                        disableFocusListener
                        disableHoverListener
                        disableTouchListener
                        arrow
                      >
                        <IconButton onClick={handleToggle}>
                          <Info size={18} color={muted} />
                        </IconButton>
                      </Tooltip>
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
                sx={fieldSx}
              />
            </Box>
            <Box className={signupClasses.boxes.input[platform]}>
              <Box
                component="label"
                className={`${signupClasses.label[platform]} ${fontClassName.className}`}
                style={{ color: '#4A4959' }}
              >
                {t('confirmPassword')}
              </Box>
              <TextField
                fullWidth
                required
                placeholder={t('passwordConfirmPlaceholder')}
                type={showPasswordConfirm ? 'text' : 'password'}
                name="passwordConfirm"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={18} color={muted} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowPasswordConfirm(!showPasswordConfirm)
                        }
                      >
                        {showPasswordConfirm ? (
                          <EyeOff size={18} color={muted} />
                        ) : (
                          <Eye size={18} color={muted} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            </Box>
            <Box className={signupClasses.boxes.input[platform]}>
              <Box
                component="label"
                className={`${signupClasses.label[platform]} ${fontClassName.className}`}
                style={{ color: '#4A4959' }}
              >
                {t('name')}
              </Box>
              <TextField
                fullWidth
                required
                placeholder={t('namePlaceholder')}
                name="name"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <UserIcon size={18} color={muted} />
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            </Box>
            <Box className={signupClasses.boxes.input[platform]}>
              <Box
                component="label"
                className={`${signupClasses.label[platform]} ${fontClassName.className}`}
                style={{ color: '#4A4959' }}
              >
                {`${t('phoneNumber')} `}
                <Typography
                  component="span"
                  className={fontClassName.className}
                  style={{ color: muted, fontWeight: 400 }}
                >
                  {`(${t('optional')})`}
                </Typography>
              </Box>
              <TextField
                fullWidth
                placeholder={t('phoneNumberPlaceholder')}
                name="phoneNumber"
                inputMode="numeric"
                type="tel"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone size={18} color={muted} />
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            </Box>
          </Box>

          <Box className={signupClasses.boxes.links[platform]}>
            {errorMessage != null && (
              <Typography
                className={`${signupClasses.error[platform]} ${fontClassName.className}`}
                style={{ color: red }}
              >
                <span>
                  {errorMessage === 'accountDeleted'
                    ? t.rich('accountDeleted', {
                        link: (chunks) => (
                          <Link
                            href="/user/signin"
                            style={{
                              color: colors.main,
                              textDecoration: 'underline',
                            }}
                          >
                            {chunks}
                          </Link>
                        ),
                      })
                    : t(errorMessage)}
                </span>
              </Typography>
            )}
            <Button
              fullWidth
              variant="contained"
              disableElevation
              type="submit"
              className={`${signupClasses.buttonSubmit[platform]} ${fontClassName.className}`}
              sx={{
                backgroundColor: colors.main,
                '&:hover': { backgroundColor: colors.buttonHoverBg },
                '&:focus': { backgroundColor: colors.buttonHoverBg },
              }}
            >
              {t('signup')}
            </Button>

            <Box className={signupClasses.boxes.text[platform]}>
              <Typography
                className={`${signupClasses.typography} ${fontClassName.className}`}
                style={{ color: muted }}
              >
                {t('haveAccount')}
              </Typography>
              <Button
                className={`${fontClassName.className} ${signupClasses.buttonRedirect}`}
                style={{ color: navy }}
                onClick={() => router.push('/user/signin')}
              >
                {t('signin')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
