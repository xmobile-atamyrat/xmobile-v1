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

export default function Signup() {
  const { setUser, setAccessToken } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const t = useTranslations();
  const platform = usePlatform();

  return (
    <Box className={`${signinClasses.boxes.main} mt-[100px]`}>
      <Link href="/">
        <ArrowBackIos className={signinClasses.link[platform]}></ArrowBackIos>
      </Link>
      <Box className={signinClasses.boxes.logo[platform]}>
        <CardMedia component="img" src="/xmobile_new_logo.png" />
      </Box>
      <Box className={signinClasses.boxes.text}>
        <Typography variant="h3" className={signinClasses.h3[platform]}>
          {t('signUp')}
        </Typography>
      </Box>
      <Paper
        className={signinClasses.paperSignup[platform]}
        elevation={0}
        square={false}
        component="form"
        onSubmit={async (event) => {
          event.preventDefault();

          if (errorMessage) setErrorMessage(undefined);

          const formData = new FormData(event.currentTarget);
          const { name, email, password, passwordConfirm, phoneNumber } =
            Object.fromEntries(formData.entries());

          if ((password as string).length < 8) {
            setErrorMessage(t('shortPassword'));
            return;
          }
          if (password !== passwordConfirm) {
            setErrorMessage(t('passwordConfirmError'));
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
                body: JSON.stringify({ email, password, name, phoneNumber }),
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
        <Box component="label" className={signinClasses.label[platform]}>
          <Typography component="span" className="font-bold" color="black">
            {`${t('email')} `}
          </Typography>
          <Typography component="span" fontWeight="bold" color="#ff624c">
            *
          </Typography>
        </Box>
        <TextField
          fullWidth
          required
          placeholder={t('emailPlaceholder')}
          type="email"
          name="email"
          className={signinClasses.textField[platform]}
        />
        <Box component="label" className={signinClasses.label[platform]}>
          <Typography component="span" className="font-bold" color="black">
            {`${t('password')} `}
          </Typography>
          <Typography component="span" fontWeight="bold" color="#ff624c">
            *
          </Typography>
        </Box>
        <TextField
          fullWidth
          required
          placeholder={t('passwordPlaceholder')}
          type={showPassword ? 'text' : 'password'}
          name="password"
          className={signinClasses.textField[platform]}
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
        <Box component="label" className={signinClasses.label[platform]}>
          <Typography component="span" className="font-bold" color="black">
            {`${t('confirmPassword')} `}
          </Typography>
          <Typography component="span" fontWeight="bold" color="#ff624c">
            *
          </Typography>
        </Box>
        <TextField
          fullWidth
          required
          placeholder={t('passwordConfirmPlaceholder')}
          type={showPasswordConfirm ? 'text' : 'password'}
          name="passwordConfirm"
          className={signinClasses.textField[platform]}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                >
                  {showPasswordConfirm ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Box component="label" className={signinClasses.label[platform]}>
          <Typography component="span" className="font-bold" color="black">
            {`${t('name')} `}
          </Typography>
          <Typography component="span" fontWeight="bold" color="#ff624c">
            *
          </Typography>
        </Box>
        <TextField
          fullWidth
          required
          placeholder={t('namePlaceholder')}
          name="name"
          className={signinClasses.textField[platform]}
        />
        <Box component="label" className={signinClasses.label[platform]}>
          <Typography component="span" className="font-bold" color="black">
            {`${t('phoneNumber')} `}
          </Typography>
          <Typography component="span" fontWeight="bold" color="#ff624c">
            *
          </Typography>
        </Box>
        <TextField
          fullWidth
          placeholder={t('phoneNumberPlaceholder')}
          name="phoneNumber"
          className={signinClasses.textField[platform]}
        />
        {errorMessage != null && (
          <Typography color="error" className={signinClasses.typo[platform]}>
            {errorMessage}
          </Typography>
        )}
        <Box className={signinClasses.boxes.button}>
          <Button
            fullWidth
            variant="contained"
            className={signinClasses.buttonSubmit[platform]}
            size="large"
            type="submit"
          >
            {t('signUp')}
          </Button>
        </Box>

        <Box className={signinClasses.boxes.text}>
          <Typography className={signinClasses.haveAccount}>
            {t('haveAccount')}
          </Typography>
          <Button
            className={signinClasses.buttonRedirect}
            onClick={() => router.push('/user/signin')}
          >
            {t('signIn')}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
