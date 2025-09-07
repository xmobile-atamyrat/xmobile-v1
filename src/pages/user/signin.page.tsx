import CustomAppBar from '@/pages/components/Appbar';
import Footer from '@/pages/components/Footer';
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
import { Inter } from 'next/font/google';
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
const inter = Inter({ subsets: ['latin'], weight: ['400', '600', '700'] });

interface SigninProps {
  handleHeaderBackButton?: () => void;
  showSearch?: boolean;
}

export default function Signin({
  handleHeaderBackButton,
  showSearch = false,
}: SigninProps) {
  const { setUser, setAccessToken } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();

  // in order to get which error we are facing to implement the ui correctly but couldn't do that so till I figure it out commenting
  // const [emailError, setEmailError] = useState<string | undefined>(undefined);
  // const [passwordError, setPasswordError] = useState<string | undefined>(
  //   undefined,
  // );

  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations();
  const platform = usePlatform();
  const [openDrawer, setOpenDrawer] = useState(false);
  const isWeb = platform === 'web';

  return (
    <Box className={signinClasses.boxes.page[platform]}>
      {isWeb && (
        <CustomAppBar
          openDrawer={openDrawer}
          setOpenDrawer={setOpenDrawer}
          handleBackButton={handleHeaderBackButton}
          showSearch={showSearch}
        />
      )}
      <Link href="/">
        <ArrowBackIos className={signinClasses.link[platform]}></ArrowBackIos>
      </Link>
      <Box className={signinClasses.boxes.main[platform]}>
        <CardMedia
          component="img"
          src="/xmobile_new_logo.png"
          className={signinClasses.boxes.logo[platform]}
        />
        <Box className={signinClasses.boxes.label[platform]}>
          <Typography
            variant="h3"
            className={`${signinClasses.h3[platform]} ${inter.className}`}
          >
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
          <Box className={signinClasses.boxes.input[platform]}>
            <Box component="label" className={signinClasses.label[platform]}>
              <Typography
                component="span"
                className={`font-bold ${inter.className}`}
                color="#1b1b1b"
              >
                {`${t('email')} `}
              </Typography>
              <Typography
                component="span"
                fontWeight="bold"
                color="#ff624c"
                className={inter.className}
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
              className={`${inter.className} ${signinClasses.textField[platform]}`}
              sx={{
                marginTop: '12px',
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  height: isWeb ? '80px' : '48px',
                  fontSize: isWeb ? '18px' : '14px',
                  paddingX: '13px',
                  paddingY: '16px',
                  '& fieldset': {
                    borderColor: isWeb ? '#fff' : '#E6E6E6',
                  },
                  '&:hover fieldset': {
                    borderColor: '#ff624c',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff624c',
                  },
                },
                '& .MuiInputBase-input': {
                  paddingX: '13px',
                  paddingY: '16px',
                  fontSize: isWeb ? '18px' : '14px',
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#838383',
                  opacity: 1,
                },
              }}
            />
          </Box>
          <Box className={`${signinClasses.boxes.input[platform]} mt-[25px]`}>
            <Box component="label" className={signinClasses.label[platform]}>
              <Typography
                component="span"
                className={`font-bold ${inter.className}`}
                color="#1b1b1b"
              >
                {`${t('password')} `}
              </Typography>
              <Typography
                component="span"
                fontWeight="bold"
                color="#ff624c"
                className={inter.className}
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
              className={`${inter.className} ${signinClasses.textField[platform]}`}
              sx={{
                marginTop: '12px',
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  height: isWeb ? '80px' : '48px',
                  fontSize: isWeb ? '18px' : '14px',
                  paddingX: '13px',
                  paddingY: '16px',
                  '& fieldset': {
                    borderColor: isWeb ? '#fff' : '#E6E6E6',
                  },
                  '&:hover fieldset': {
                    borderColor: '#ff624c',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff624c',
                  },
                },
                '& .MuiInputBase-input': {
                  paddingX: '13px',
                  paddingY: '16px',
                  fontSize: isWeb ? '18px' : '14px',
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#838383',
                  opacity: 1,
                },
              }}
            />
          </Box>
          {errorMessage != null && (
            <Typography
              className={`${signinClasses.error[platform]} ${inter.className}`}
            >
              {t(errorMessage)}
            </Typography>
          )}
          <Box className={signinClasses.boxes.links[platform]}>
            <Box className={signinClasses.boxes.button[platform]}>
              <Button
                fullWidth
                variant="contained"
                className={`${signinClasses.buttonSubmit[platform]} ${inter.className}`}
                size="large"
                type="submit"
                sx={{
                  '&:hover': {
                    backgroundColor: isWeb ? '#ec4d38' : '#1b1b1b',
                  },
                  '&:focus': {
                    backgroundColor: isWeb ? '#ec4d38' : '#1b1b1b',
                  },
                }}
              >
                {t('signIn')}
              </Button>
            </Box>
            <Box className={signinClasses.boxes.text[platform]}>
              <Typography
                className={`normal-case text-[16px] mr-[19px] justify-center w-[300px] ${inter.className}`}
              >
                {t('dontHaveAccount')}
              </Typography>
              <Button
                className={`${inter.className} ${signinClasses.buttonRedirect}`}
                onClick={() => router.push('/user/signup')}
              >
                {t('signUp')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
      {isWeb && <Footer />}
    </Box>
  );
}
