import { usePlatform } from '@/pages/lib/PlatformContext';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { signinClasses } from '@/styles/classMaps/user/signin.page';
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
    <Box className={signinClasses.boxes.main}>
      <Link href="/">
        <ArrowBackIos className={signinClasses.link[platform]}></ArrowBackIos>
      </Link>
      <Box className={signinClasses.boxes.logo[platform]}>
        <CardMedia component="img" src="/xmobile_new_logo.png" />
      </Box>
      <Box className={signinClasses.boxes.text}>
        <Typography variant="h3" className={signinClasses.h3[platform]}>
          {t('signIn')}
        </Typography>
      </Box>
      <Paper
        className={signinClasses.paper[platform]}
        elevation={0}
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
        <Box component="label" className={signinClasses.label[platform]}>
          <Typography component="span" className="font-bold" color="black">
            {'Email '}
          </Typography>
          <Typography component="span" fontWeight="bold" color="#ff624c">
            *
          </Typography>
        </Box>
        <TextField
          fullWidth
          required
          placeholder="Email / Phone Number"
          type="email"
          name="email"
          InputProps={{
            classes: {
              root: `
                ${signinClasses.textField[platform]}
              `,
            },
          }}
        />
        <Box
          component="label"
          className={`${signinClasses.label[platform]} mt-2`}
        >
          <Typography component="span" className="font-bold" color="black">
            {'Password '}
          </Typography>
          <Typography component="span" fontWeight="bold" color="#ff624c">
            *
          </Typography>
        </Box>
        <TextField
          fullWidth
          required
          // label={t('password')}
          placeholder="Enter your password"
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
            classes: {
              root: `
                ${signinClasses.textField[platform]}
              `,
            },
          }}
        />
        {errorMessage != null && (
          <Typography color="error" className={signinClasses.typo[platform]}>
            {t(errorMessage)}
          </Typography>
        )}
        <Box className={signinClasses.boxes.categories}>
          <Box className={signinClasses.boxes.button}>
            <Button
              fullWidth
              variant="contained"
              className={signinClasses.buttonSubmit[platform]}
              size="large"
              type="submit"
            >
              {t('signIn')}
              {/* Create Account */}
            </Button>
          </Box>
          <Box className={signinClasses.boxes.text}>
            <Typography className="normal-case text-[14px] justify-center">
              {t('dontHaveAccount')}
            </Typography>
            <Button
              className={signinClasses.buttonRedirect[platform]}
              onClick={() => router.push('/user/signup')}
            >
              {/* {t('signUp')} */}
              Register
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
