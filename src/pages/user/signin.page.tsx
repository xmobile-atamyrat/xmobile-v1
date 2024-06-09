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
import CancelIcon from '@mui/icons-material/Cancel';
import Link from 'next/link';
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { useUserContext } from '@/pages/lib/UserContext';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { VisibilityOff, Visibility } from '@mui/icons-material';
import { useTranslations } from 'next-intl';
import { GetStaticProps } from 'next';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Signin() {
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
          height: '350px',
          borderRadius: '16px',
          p: 2,
          gap: 2,
        }}
        component="form"
        onSubmit={async (event) => {
          event.preventDefault();

          if (errorMessage) setErrorMessage(undefined);

          const formData = new FormData(event.currentTarget);
          const { email, password } = Object.fromEntries(formData.entries());

          try {
            const { success, data, message }: ResponseApi<User> = await (
              await fetch('/api/user/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
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
        <Box className="flex flex-col gap-2">
          <Box className="flex flex-col gap-2 relative min-h-[70px]">
            <Button
              fullWidth
              variant="contained"
              sx={{ textTransform: 'none' }}
              size="large"
              type="submit"
            >
              {t('signIn')}
            </Button>
            {errorMessage != null && (
              <Typography
                color="error"
                fontSize={14}
                className="absolute bottom-0"
              >
                {t(errorMessage)}
              </Typography>
            )}
          </Box>
          <Divider />
          <Box className="flex flex-row justify-between">
            <Button sx={{ textTransform: 'none', px: { xs: 0, sm: 2 } }}>
              {t('forgotPassword')}
            </Button>
            <Button
              sx={{ textTransform: 'none', px: { xs: 0, sm: 2 } }}
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
