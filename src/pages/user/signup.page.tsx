import { usePlatform } from '@/pages/lib/PlatformContext';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { emailCheck, passwordCheck } from '@/pages/user/utils';
import { signupClasses } from '@/styles/classMaps/user/signup';
import { colors, interClassname, units } from '@/styles/theme';
import { ArrowBackIos, Visibility, VisibilityOff } from '@mui/icons-material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const handleToggle = () => {
    setTooltipOpen((prev) => !prev);
  };
  const handleClose = () => {
    setTooltipOpen(false);
  };

  return (
    <Box className={signupClasses.boxes.page[platform]}>
      <Link href="/">
        <ArrowBackIos className={signupClasses.link[platform]}></ArrowBackIos>
      </Link>
      <Box className={signupClasses.boxes.main[platform]}>
        <CardMedia
          component="img"
          src="/black_logo.png"
          className={signupClasses.boxes.logo[platform]}
        />
        <Box className={signupClasses.boxes.label[platform]}>
          <Typography
            variant="h3"
            className={`${signupClasses.h3[platform]} ${interClassname.className}`}
          >
            {t('signUp')}
          </Typography>
        </Box>
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
            const passwordMessage = passwordCheck(String(password));
            if (emailMessage) {
              setErrorMessage(emailMessage);
              return;
            }
            if (passwordMessage) {
              setErrorMessage(passwordMessage);
              return;
            }
            if (passwordConfirm !== password) {
              setErrorMessage('errorPasswordConfirm');
              return;
            }
            if (!name) {
              setErrorMessage('errorNameInput');
              return;
            }
            if (!phoneNumber) {
              setErrorMessage('errorPhoneNumberInput');
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
              <Box component="label" className={signupClasses.label[platform]}>
                <Typography
                  component="span"
                  className={`font-bold ${interClassname.className}`}
                  color={colors.text}
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
                sx={{
                  marginTop: '12px',
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
                      borderColor: colors.main,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
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
            <Box className={`${signupClasses.boxes.input[platform]} mt-[25px]`}>
              <Box component="label" className={signupClasses.label[platform]}>
                <Typography
                  component="span"
                  className={`font-bold ${interClassname.className}`}
                  color={colors.text}
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
                          <InfoOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  marginTop: '12px',
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
                      borderColor: colors.main,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
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
            <Box className={`${signupClasses.boxes.input[platform]} mt-[25px]`}>
              <Box component="label" className={signupClasses.label[platform]}>
                <Typography
                  component="span"
                  className={`font-bold ${interClassname.className}`}
                  color={colors.text}
                >
                  {t('confirmPassword')}
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
                placeholder={t('passwordConfirmPlaceholder')}
                type={showPasswordConfirm ? 'text' : 'password'}
                name="passwordConfirm"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowPasswordConfirm(!showPasswordConfirm)
                        }
                      >
                        {showPasswordConfirm ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  marginTop: '12px',
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
                      borderColor: colors.main,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
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
            <Box className={`${signupClasses.boxes.input[platform]} mt-[25px]`}>
              <Box component="label" className={signupClasses.label[platform]}>
                <Typography
                  component="span"
                  className={`font-bold ${interClassname.className}`}
                  color={colors.text}
                >
                  {t('name')}
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
                placeholder={t('namePlaceholder')}
                name="name"
                sx={{
                  marginTop: '12px',
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
                      borderColor: colors.main,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
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
            <Box className={`${signupClasses.boxes.input[platform]} mt-[25px]`}>
              <Box component="label" className={signupClasses.label[platform]}>
                <Typography
                  component="span"
                  className={`font-bold ${interClassname.className}`}
                  color={colors.text}
                >
                  {`${t('phoneNumber')} `}
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
                placeholder={t('phoneNumberPlaceholder')}
                name="phoneNumber"
                inputMode="numeric"
                type="tel"
                sx={{
                  marginTop: '12px',
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
                      borderColor: colors.main,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
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
          </Box>

          <Box className={signupClasses.boxes.links[platform]}>
            {errorMessage != null && (
              <Typography
                color="error"
                className={`${signupClasses.error[platform]} ${interClassname.className} `}
              >
                {t(errorMessage)}
              </Typography>
            )}
            <Box className={signupClasses.boxes.button}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                type="submit"
                className={`${signupClasses.buttonSubmit[platform]} ${interClassname.className}`}
                sx={{
                  '&:hover': {
                    backgroundColor: colors.buttonBackground[platform],
                  },
                  '&:focus': {
                    backgroundColor: colors.buttonBackground[platform],
                  },
                }}
              >
                {t('signUp')}
              </Button>
            </Box>

            <Box className={signupClasses.boxes.text[platform]}>
              <Typography
                className={`${signupClasses.typography} ${interClassname.className}`}
              >
                {t('haveAccount')}
              </Typography>
              <Button
                className={`${interClassname.className} ${signupClasses.buttonRedirect}`}
                onClick={() => router.push('/user/signin')}
              >
                {t('signIn')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
