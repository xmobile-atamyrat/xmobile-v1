import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  HIGHEST_LEVEL_CATEGORY_ID,
  LOCALE_COOKIE_NAME,
  LOGO_COLOR,
  LOGO_COLOR_LIGHT,
  MAIN_BG_COLOR,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import { deleteCookie, getCookie, setCookie } from '@/pages/lib/utils';
import { Dvr } from '@mui/icons-material';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import CloseIcon from '@mui/icons-material/Close';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';

import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import {
  Avatar,
  CardMedia,
  Paper,
  Select,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import Flag from 'react-flagkit';

interface CustomAppBarProps {
  openDrawer: boolean;
  setOpenDrawer: Dispatch<SetStateAction<boolean>>;
  showSearch?: boolean;
  handleBackButton?: () => void;
}

export const SearchBar = ({
  handleSearch,
  searchKeyword,
  searchPlaceholder,
  setSearchKeyword,
  mt,
  width,
}: {
  handleSearch?: (keyword: string) => Promise<void> | void;
  searchPlaceholder: string;
  searchKeyword: string;
  setSearchKeyword: Dispatch<SetStateAction<string>>;
  mt?: string;
  width?: string;
}) => {
  return (
    <Box
      className={`flex items-center justify-center w-full bg-[${MAIN_BG_COLOR}]`}
    >
      <Paper
        component="form"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          mt,
          width,
        }}
        className={`rounded-2xl`}
        style={{
          backgroundColor: LOGO_COLOR_LIGHT,
        }}
      >
        <IconButton type="button" sx={{ p: '10px' }}>
          <SearchIcon sx={{ color: 'white' }} />
        </IconButton>
        <InputBase
          sx={{
            ml: 1,
            flex: 1,
            color: 'white', // Set text color to white
            '& .MuiInputBase-input': {
              color: 'white', // Ensure the input text is white
            },
          }}
          placeholder={`${searchPlaceholder}...`}
          onChange={(e) => {
            const keyword = e.target.value;
            setSearchKeyword(keyword);
            if (handleSearch) {
              handleSearch(keyword);
            }
          }}
          value={searchKeyword}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
        />
        {searchKeyword !== '' && (
          <IconButton
            type="button"
            sx={{ p: '10px' }}
            onClick={() => {
              setSearchKeyword('');
              if (handleSearch) {
                handleSearch('');
              }
            }}
          >
            <CloseIcon sx={{ color: 'white' }} />
          </IconButton>
        )}
      </Paper>
    </Box>
  );
};

export default function CustomAppBar({
  setOpenDrawer,
  openDrawer,
  showSearch = false,
  handleBackButton,
}: CustomAppBarProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, setUser, setAccessToken } = useUserContext();
  const router = useRouter();
  const isMenuOpen = Boolean(anchorEl);
  const t = useTranslations();
  const { setSearchKeyword } = useProductContext();
  const { setStack, setParentCategory, setSelectedCategoryId } =
    useCategoryContext();
  const [localSearchKeyword, setLocalSearchKeyword] = useState('');
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [selectedLocale, setSelectedLocale] = useState('ru');

  useEffect(() => {
    setSelectedLocale((prev) => getCookie(LOCALE_COOKIE_NAME) || prev);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchKeyword(localSearchKeyword);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearchKeyword]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (appBarTheme) => appBarTheme.zIndex.drawer + 1,
          height: { xs: mobileAppBarHeight, md: appBarHeight },
        }}
        style={{
          backgroundColor: MAIN_BG_COLOR,
        }}
      >
        <Toolbar className="flex items-center justify-between">
          <Box className="flex w-fit h-full items-center justify-start">
            {handleBackButton && (
              <IconButton
                size="large"
                edge="start"
                color="inherit"
                aria-label="open drawer"
                sx={{ p: 1 }}
                onClick={handleBackButton}
              >
                <ArrowBackIosIcon
                  sx={{
                    width: { xs: 24, md: 28 },
                    height: { xs: 24, md: 28 },
                    color: LOGO_COLOR,
                  }}
                />
              </IconButton>
            )}
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="open drawer"
              onClick={() => setOpenDrawer(!openDrawer)}
              sx={{ p: 1, pl: '4px' }}
            >
              <MenuIcon
                sx={{
                  width: { xs: 30, md: 34 },
                  height: { xs: 30, md: 34 },
                  color: LOGO_COLOR,
                }}
              />
            </IconButton>
            <Box
              sx={{
                width: { xs: 100, sm: 120 },
                height: '100%',
              }}
              className="flex items-center justify-center"
              onClick={() => {
                setParentCategory(undefined);
                setSelectedCategoryId(HIGHEST_LEVEL_CATEGORY_ID);
                setStack([]);
                router.push('/');
              }}
              component="button"
            >
              <CardMedia component="img" src="/logo-recolored-cropped.jpeg" />
            </Box>
          </Box>

          <Box className="flex w-fit h-full items-center justify-center">
            {isMdUp && showSearch && (
              <Box
                sx={{
                  width: 400,
                }}
              >
                {SearchBar({
                  mt: isMdUp ? undefined : `${appBarHeight}px`,
                  searchKeyword: localSearchKeyword,
                  searchPlaceholder: t('search'),
                  setSearchKeyword: setLocalSearchKeyword,
                  width: '95%',
                })}
              </Box>
            )}

            <Select
              value={selectedLocale}
              color="info"
              size="small"
              sx={{
                width: { xs: 80, sm: 110 },
                height: { xs: 36, sm: 40 },
                '& .MuiInputBase-input': {
                  padding: { xs: '8px', sm: '20px' },
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: LOGO_COLOR, // Change border color here
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: LOGO_COLOR, // Change border color on hover
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: LOGO_COLOR, // Change border color when focused
                },
              }}
              onChange={(event) => {
                const newLocale = event.target.value;
                setSelectedLocale(newLocale);
                setCookie(LOCALE_COOKIE_NAME, newLocale);
                router.push(router.pathname, router.asPath, {
                  locale: newLocale,
                });
              }}
            >
              <MenuItem value="ru" sx={{ py: { xs: 0, sm: 1 }, px: 2 }}>
                <Box className="flex flex-row justify-start gap-1 sm:gap-2 w-full items-center">
                  <Flag country="RU" size={18} />
                  <Typography sx={{ fontSize: { xs: 14, sm: 18 } }}>
                    rus
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="tk" sx={{ py: { xs: 0, sm: 1 }, px: 2 }}>
                <Box className="flex flex-row justify-start gap-1 sm:gap-2 w-full items-center">
                  <Flag country="TM" size={18} />
                  <Typography sx={{ fontSize: { xs: 14, sm: 18 } }}>
                    tkm
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="tr" sx={{ py: { xs: 0, sm: 1 }, px: 2 }}>
                <Box className="flex flex-row justify-start gap-1 sm:gap-2 w-full items-center">
                  <Flag country="TR" size={18} />
                  <Typography sx={{ fontSize: { xs: 14, sm: 18 } }}>
                    tür
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="ch" sx={{ py: { xs: 0, sm: 1 }, px: 2 }}>
                <Box className="flex flex-row justify-start gap-1 sm:gap-2 w-full items-center">
                  <Flag country="TM" size={18} />
                  <Typography sx={{ fontSize: { xs: 14, sm: 18 } }}>
                    çär
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="en" sx={{ py: { xs: 0, sm: 1 }, px: 2 }}>
                <Box className="flex flex-row justify-start gap-1 sm:gap-2 w-full items-center">
                  <Flag country="US" size={18} />
                  <Typography sx={{ fontSize: { xs: 14, sm: 18 } }}>
                    eng
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
            <Box>
              <IconButton
                sx={{
                  pl: 1,
                  pr: 0,
                }}
                onClick={() => router.push('/cart')}
              >
                <ShoppingCartCheckoutIcon
                  sx={{
                    width: { xs: 30, sm: 36 },
                    height: { xs: 30, sm: 36 },
                    color: LOGO_COLOR,
                  }}
                />
              </IconButton>
            </Box>
            <Box>
              <IconButton
                edge="end"
                aria-label="account of current user"
                aria-haspopup="true"
                onClick={(event) => setAnchorEl(event.currentTarget)}
                color="inherit"
              >
                {user != null ? (
                  <Avatar
                    sx={{
                      width: { xs: 30, sm: 36 },
                      height: { xs: 30, sm: 36 },
                    }}
                    style={{
                      backgroundColor: LOGO_COLOR,
                    }}
                  >
                    {user.name[0].toUpperCase()}
                  </Avatar>
                ) : (
                  <AccountCircle
                    sx={{
                      width: { xs: 36, md: 42 },
                      height: { xs: 36, md: 42 },
                      color: LOGO_COLOR,
                    }}
                  />
                )}
              </IconButton>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      {showSearch &&
        !isMdUp &&
        SearchBar({
          mt: isMdUp ? undefined : `${appBarHeight}px`,
          searchKeyword: localSearchKeyword,
          searchPlaceholder: t('search'),
          setSearchKeyword: setLocalSearchKeyword,
          width: '95%',
        })}
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={isMenuOpen}
        onClose={() => setAnchorEl(null)}
      >
        {user != null ? (
          <Box>
            {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
              <MenuItem
                className="flex flex-row gap-2 items-center justify-start"
                onClick={() => router.push('/product/update-prices')}
              >
                <DriveFolderUploadIcon />
                <Typography>{t('updatePrices')}</Typography>
              </MenuItem>
            )}
            {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
              <MenuItem
                className="flex flex-row gap-2 items-center justify-start"
                onClick={() => router.push('/analytics')}
              >
                <AnalyticsIcon />
                <Typography>{t('analytics')}</Typography>
              </MenuItem>
            )}
            {user?.grade === 'SUPERUSER' && (
              <MenuItem
                className="flex flex-row gap-2 items-center justify-start"
                onClick={() => router.push('/procurement')}
              >
                <Dvr />
                <Typography>{t('procurement')}</Typography>
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                (async () => {
                  try {
                    deleteCookie(AUTH_REFRESH_COOKIE_NAME);
                    setUser(undefined);
                    setAccessToken(undefined);
                  } catch (error) {
                    console.error(error);
                  }
                })();
              }}
              className="flex flex-row gap-2 items-center justify-start"
            >
              <LogoutIcon />
              <Typography>{t('signout')}</Typography>
            </MenuItem>
          </Box>
        ) : (
          <Box>
            <MenuItem
              onClick={() => router.push('/user/signin')}
              className="flex flex-row gap-2 items-center justify-start"
            >
              <LoginIcon />
              <Typography>{t('signin')}</Typography>
            </MenuItem>
            <MenuItem
              onClick={() => router.push('/user/signup')}
              className="flex flex-row gap-2 items-center justify-start"
            >
              <AppRegistrationIcon />
              <Typography>{t('signup')}</Typography>
            </MenuItem>
          </Box>
        )}
      </Menu>
    </Box>
  );
}
