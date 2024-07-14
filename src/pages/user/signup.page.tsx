import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
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
  const { setUser } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations();

  return (
    <Box className="h-[100vh] flex justify-center items-center bg-[#F8F9FA]">
      <Paper
        className="flex flex-col"
        elevation={3}
        square={false}
        sx={{
          width: { xs: '90%', sm: '400px' },
          height: { xs: '450px', sm: '500px' },
          borderRadius: '16px',
          p: 2,
          gap: { xs: 1, sm: 2 },
        }}
        component="form"
        onSubmit={async (event) => {
          event.preventDefault();

          if (errorMessage) setErrorMessage(undefined);

          const formData = new FormData(event.currentTarget);
          const { name, email, password, phoneNumber } = Object.fromEntries(
            formData.entries(),
          );

          if ((password as string).length < 8) {
            setErrorMessage(t('shortPassword'));
            return;
          }

          try {
            const { success, data, message }: ResponseApi<User> = await (
              await fetch('/api/user/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, phoneNumber }),
              })
            ).json();
            if (message != null) {
              setErrorMessage(message);
            } else if (success && data != null) {
              setUser(data);
              localStorage.setItem('user', JSON.stringify(data));
              router.push('/');
            }
          } catch (error) {
            setErrorMessage((error as Error).message);
          }
        }}
      >
        <Box className="flex flex-col gap-1">
          <Box className="flex flex-row justify-between">
            <Typography variant="h5">{t('signUp')}</Typography>
            <Link href="/">
              <CancelIcon />
            </Link>
          </Box>
          <Divider />
        </Box>
        <TextField fullWidth required label={t('name')} name="name" />
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
        <TextField fullWidth label={t('phoneNumber')} name="phoneNumber" />
        <Box className="flex flex-col gap-2">
          <Box className="flex flex-col gap-2 relative min-h-[70px]">
            <Button
              fullWidth
              variant="contained"
              sx={{ textTransform: 'none' }}
              size="large"
              type="submit"
            >
              {t('signUp')}
            </Button>
            {errorMessage != null && (
              <Typography
                color="error"
                fontSize={14}
                className="absolute bottom-0"
              >
                {errorMessage}
              </Typography>
            )}
          </Box>

          <Divider />

          <Box className="flex flex-row justify-between items-center">
            <Typography sx={{ textTransform: 'none' }} fontSize={14}>
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
