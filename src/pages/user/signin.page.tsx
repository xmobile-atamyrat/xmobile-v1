import { usePlatform } from '@/pages/lib/PlatformContext';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { emailCheck } from '@/pages/user/utils';
import { signinClasses } from '@/styles/classMaps/user/signin';
import { colors, interClassname, units } from '@/styles/theme';
import { ArrowBackIos, Visibility, VisibilityOff } from '@mui/icons-material';
import {
  Box,
  Button,
  CardMedia,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { User } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

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

  return (
    <Box className={signinClasses.boxes.page[platform]}>
      <Link href="/user">
        <ArrowBackIos
          className={`${signinClasses.link[platform]}`}
          style={{ color: colors.blackText }}
        />
      </Link>
      <Box className={signinClasses.boxes.main[platform]}>
        <CardMedia
          component="img"
          src="/xmobile-processed-logo.png"
          className={signinClasses.boxes.logo[platform]}
        />
        <Box className={signinClasses.boxes.label[platform]}>
          <Typography
            color={colors.blackText}
            variant="h3"
            className={`${signinClasses.h3[platform]} ${interClassname.className}`}
          >
            {t('signIn')}
          </Typography>
        </Box>
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
            const { email, password } = Object.fromEntries(formData.entries());

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
            <Box component="label" className={signinClasses.label[platform]}>
              <Typography
                component="span"
                className={`font-bold ${interClassname.className}`}
                color={colors.blackText}
              >
                {`${t('email')} `}
              </Typography>
              <Typography
                component="span"
                fontWeight="bold"
                color={colors.main}
                className={interClassname.className}
              >
                *
              </Typography>
            </Box>
            <TextField
              fullWidth
              required
              placeholder={t('emailPlaceholder')}
              type="email"
              name="email"
              className={`${interClassname.className} ${signinClasses.textField[platform]}`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  height: units.inputHeight[platform],
                  fontSize: units.inputFontSize[platform],
                  paddingX: '13px',
                  paddingY: '16px',
                  '& fieldset': {
                    borderColor: colors.border[platform],
                  },
                  '&:hover fieldset': {
                    borderColor: colors.borderHover[platform],
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: colors.borderHover[platform],
                  },
                },
                '& .MuiInputBase-input': {
                  paddingX: '13px',
                  paddingY: '16px',
                  fontSize: units.inputFontSize[platform],
                },
                '& .MuiInputBase-input::placeholder': {
                  color: colors.placeholder,
                  opacity: 1,
                },
              }}
            />
          </Box>
          <Box className={`${signinClasses.boxes.input[platform]} mt-[25px]`}>
            <Box component="label" className={signinClasses.label[platform]}>
              <Typography
                component="span"
                className={`font-bold ${interClassname.className}`}
                color={colors.blackText}
              >
                {`${t('password')} `}
              </Typography>
              <Typography
                component="span"
                fontWeight="bold"
                color={colors.main}
                className={interClassname.className}
              >
                *
              </Typography>
            </Box>
            <TextField
              fullWidth
              required
              placeholder={t('passwordPlaceholder')}
              type={showPassword ? 'text' : 'password'}
              name="password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              className={`${interClassname.className} ${signinClasses.textField[platform]}`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  height: units.inputHeight[platform],
                  fontSize: units.inputFontSize[platform],
                  paddingX: '13px',
                  paddingY: '16px',
                  '& fieldset': {
                    borderColor: colors.border[platform],
                  },
                  '&:hover fieldset': {
                    borderColor: colors.borderHover[platform],
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: colors.borderHover[platform],
                  },
                },
                '& .MuiInputBase-input': {
                  paddingX: '13px',
                  paddingY: '16px',
                  fontSize: units.inputFontSize[platform],
                },
                '& .MuiInputBase-input::placeholder': {
                  color: colors.placeholder,
                  opacity: 1,
                },
              }}
            />
          </Box>
          {errorMessage != null && (
            <Typography
              color={colors.blackText}
              className={`${signinClasses.error[platform]} ${interClassname.className} opacity-85`}
            >
              {t(errorMessage)}
            </Typography>
          )}
          <Box className={signinClasses.boxes.links[platform]}>
            <Box className={signinClasses.boxes.button[platform]}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                type="submit"
                disableElevation
                className={`${signinClasses.buttonSubmit[platform]} ${interClassname.className}`}
                sx={{
                  backgroundColor: colors.main,
                  '&:hover': {
                    backgroundColor: colors.buttonHoverBg,
                  },
                  '&:focus': {
                    backgroundColor: colors.buttonHoverBg,
                  },
                }}
              >
                {t('signIn')}
              </Button>
            </Box>
            <Box className={signinClasses.boxes.text[platform]}>
              <Typography
                className={`${signinClasses.typography} ${interClassname.className}`}
              >
                {t('dontHaveAccount')}
              </Typography>
              <Button
                className={`${interClassname.className} ${signinClasses.buttonRedirect}`}
                onClick={() => router.push('/user/signup')}
              >
                {t('signUp')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
