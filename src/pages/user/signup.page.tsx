import { MAIN_BG_COLOR } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { signupClasses } from '@/styles/classMaps/user/signup';
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

export default function Signup() {
  const { setUser, setAccessToken } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations();
  const platform = usePlatform();

  return (
    <Box className={`${signupClasses.boxes.main} bg-[${MAIN_BG_COLOR}]`}>
      <Paper
        className={signupClasses.paper[platform]}
        elevation={3}
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
        <Box className={signupClasses.boxes.categories}>
          <Box className={signupClasses.boxes.text}>
            <Typography variant="h5">{t('signUp')}</Typography>
            <Link href="/">
              <CancelIcon />
            </Link>
          </Box>
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
        <TextField fullWidth label={t('phoneNumber')} name="phoneNumber" />
        <Box className={signupClasses.boxes.categories}>
          <Box className={signupClasses.boxes.button}>
            <Button
              fullWidth
              variant="contained"
              className="normal-case"
              size="large"
              type="submit"
            >
              {t('signUp')}
            </Button>
            {errorMessage != null && (
              <Typography color="error" className={signupClasses.typo}>
                {errorMessage}
              </Typography>
            )}
          </Box>

          <Divider />

          <Box className={signupClasses.boxes.text}>
            <Typography className="normal-case font-[14px]">
              {t('haveAccount')}
            </Typography>
            <Button
              sx={{ textTransform: 'none' }}
              onClick={() => router.push('/user/signin')}
            >
              {t('signIn')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
