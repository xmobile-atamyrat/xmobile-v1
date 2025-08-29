import { MAIN_BG_COLOR } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { signinClasses } from '@/styles/classMaps/user/signin.page';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { User } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Signin() {
  const { setUser, setAccessToken } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations();
  const platform = usePlatform();
  return (
    <Box className={`${signinClasses.boxes.main} bg-[${MAIN_BG_COLOR}]`}>
      <Paper
        className={signinClasses.paper[platform]}
        elevation={3}
        square={false}
        component="form"
        onSubmit={async (event) => {
          event.preventDefault();

          if (errorMessage) setErrorMessage(undefined);

          const formData = new FormData(event.currentTarget);
          const { email, password } = Object.fromEntries(formData.entries());

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
        <Box className={signinClasses.boxes.categories}>
          <Box className={signinClasses.boxes.text}>
            <Typography variant="h5">{t('signIn')}</Typography>
            <Link href="/">
              <CancelIcon />
            </Link>
          </Box>
          <Divider />
        </Box>
        <TextField
          fullWidth
          required
          label={t('email')}
          type="email"
          name="email"
        />
        <TextField
          fullWidth
          required
          label={t('password')}
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
        />
        <Box className={signinClasses.boxes.categories}>
          <Box className={signinClasses.boxes.button}>
            <Button
              fullWidth
              variant="contained"
              className="normal-case"
              size="large"
              type="submit"
            >
              {t('signIn')}
            </Button>
            {errorMessage != null && (
              <Typography color="error" className={signinClasses.typo}>
                {t(errorMessage)}
              </Typography>
            )}
          </Box>
          <Divider />
          <Box className={signinClasses.boxes.text}>
            <Typography className="normal-case font-[14px]">
              {t('dontHaveAccount')}
            </Typography>
            <Button
              className={signinClasses.button[platform]}
              onClick={() => router.push('/user/signup')}
            >
              {t('signUp')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
