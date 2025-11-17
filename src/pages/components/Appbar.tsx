import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  HIGHEST_LEVEL_CATEGORY_ID,
  LOCALE_COOKIE_NAME,
  LOGO_COLOR,
} from '@/pages/lib/constants';
import { deleteCookie, getCookie, setCookie } from '@/pages/lib/utils';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { Dvr } from '@mui/icons-material';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';

import { interClassname } from '@/styles/theme';
import CallIcon from '@mui/icons-material/Call';
import InstagramIcon from '@mui/icons-material/Instagram';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import {
  Avatar,
  CardMedia,
  Divider,
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
    <Box className={appbarClasses.boxes.form}>
      <Paper
        component="form"
        className={`${appbarClasses.paper} mt-${mt} w-${width}`}
        elevation={0}
      >
        <InputBase
          className={appbarClasses.inputBase}
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
      </Paper>
      <SearchIcon className="text-[#30303090]" />
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
  const platform = usePlatform();

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
    <Box className="flex-grow-1">
      <AppBar
        position="sticky"
        className={appbarClasses.appbar[platform]}
        elevation={0}
      >
        <Box className="w-full h-[48px] flex justify-center items-start">
          <Box className="w-[1516px] h-[32px] justify-between flex flex-row">
            <Box className="gap-[24px] min-w-[214px] flex flex-row">
              <Box className="min-w-[234px] flex flex-row items-center">
                <LocationOnIcon className="h-[16px] text-[#303030]" />
                <Typography
                  className={`${interClassname.className} text-[#303030] text-[14px] text-regular leading-[20px] tracking-normal`}
                >
                  {t('address')}
                </Typography>
              </Box>
              <Divider
                orientation="vertical"
                flexItem
                className="text-[#303030] mx-[-15px]"
              />
              <Box className="min-w-[234px] flex flex-row items-center">
                <CallIcon className="h-[16px] text-[#303030]" />
                <Typography
                  className={`${interClassname.className} text-[#303030] text-[14px] text-regular leading-[20px] tracking-normal`}
                >
                  (+993) 61 004933
                </Typography>
              </Box>
            </Box>
            <Box className="gap-[24px] min-w-[214px] flex flex-row">
              <Select
                value={selectedLocale}
                variant="standard"
                disableUnderline
                className={appbarClasses.select[platform]}
                onChange={(event) => {
                  const newLocale = event.target.value;
                  setSelectedLocale(newLocale);
                  setCookie(LOCALE_COOKIE_NAME, newLocale);
                  router.push(router.pathname, router.asPath, {
                    locale: newLocale,
                  });
                }}
              >
                <MenuItem
                  value="ru"
                  className={appbarClasses.menuItem[platform]}
                >
                  <Box className={appbarClasses.boxes.lang[platform]}>
                    <CardMedia
                      component="img"
                      src="/Russia.png"
                      className="w-[24px] h-[18px]"
                    />
                    <Typography
                      className={`${appbarClasses.typography[platform]} ${interClassname.className}`}
                    >
                      Русский
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  value="tk"
                  className={appbarClasses.menuItem[platform]}
                >
                  <Box className={appbarClasses.boxes.lang[platform]}>
                    <CardMedia
                      component="img"
                      src="/Turkmenistan.png"
                      className="w-[24px] h-[18px]"
                    />
                    <Typography
                      className={`${appbarClasses.typography[platform]} ${interClassname.className}`}
                    >
                      Türkmençe
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  value="tr"
                  className={appbarClasses.menuItem[platform]}
                >
                  <Box className={appbarClasses.boxes.lang[platform]}>
                    <CardMedia
                      component="img"
                      src="/Turkey.png"
                      className="w-[24px] h-[18px]"
                    />
                    <Typography
                      className={`${appbarClasses.typography[platform]} ${interClassname.className}`}
                    >
                      Türkce
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  value="ch"
                  className={appbarClasses.menuItem[platform]}
                >
                  <Box className={appbarClasses.boxes.lang[platform]}>
                    <CardMedia
                      component="img"
                      src="/Turkmenistan.png"
                      className="w-[24px] h-[18px]"
                    />
                    <Typography
                      className={`${appbarClasses.typography[platform]} ${interClassname.className}`}
                    >
                      Çärjowça
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  value="en"
                  className={appbarClasses.menuItem[platform]}
                >
                  <Box className={appbarClasses.boxes.lang[platform]}>
                    <CardMedia
                      component="img"
                      src="/UnitedKingdom.png"
                      className="w-[24px] h-[18px]"
                    />
                    <Typography
                      className={`${appbarClasses.typography[platform]} ${interClassname.className}`}
                    >
                      English
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
              <Divider
                orientation="vertical"
                flexItem
                className="text-[#303030] mx-[-15px]"
              />
              <Box className="w-[56px] flex flex-row items-center justify-between">
                <IconButton href={'https://www.tiktok.com/@xmobiletm/'}>
                  <CardMedia
                    component="img"
                    src="/tiktok.png"
                    className="w-[16px] h-[16px]"
                  />
                </IconButton>
                <IconButton href={'https://www.instagram.com/xmobiletm/'}>
                  <InstagramIcon className="w-[16px] h-[16px] text-[#000]"></InstagramIcon>
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>
        <Divider className="text-[#303030]" />
        <Toolbar className={appbarClasses.toolBar}>
          <Box className={appbarClasses.boxes.toolbar}>
            {handleBackButton && (
              <IconButton
                size="large"
                edge="start"
                color="inherit"
                className="p-4"
                aria-label="open drawer"
                onClick={handleBackButton}
              >
                <ArrowBackIosIcon
                  className={appbarClasses.arrowBackIos[platform]}
                  sx={{
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
              className="p-4 pl-[4px]"
            >
              <MenuIcon
                className={appbarClasses.menuIcon[platform]}
                sx={{
                  color: LOGO_COLOR,
                }}
              />
            </IconButton>
            <Box
              className={appbarClasses.boxes.logo[platform]}
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

          <Box className={appbarClasses.boxes.search}>
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

            {user && (
              <Box>
                <IconButton
                  className="pl-1 pr-0"
                  onClick={() => router.push('/cart')}
                >
                  <ShoppingCartCheckoutIcon
                    className={appbarClasses.shoppingCCI[platform]}
                    sx={{ color: LOGO_COLOR }}
                  />
                </IconButton>
              </Box>
            )}
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
                    className={appbarClasses.avatar[platform]}
                    style={{
                      backgroundColor: LOGO_COLOR,
                    }}
                  >
                    {user.name[0].toUpperCase()}
                  </Avatar>
                ) : (
                  <AccountCircle
                    className={appbarClasses.accCircle[platform]}
                    sx={{
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
                className={appbarClasses.menuItemAcc}
                onClick={() => router.push('/product/update-prices')}
              >
                <DriveFolderUploadIcon />
                <Typography>{t('updatePrices')}</Typography>
              </MenuItem>
            )}
            {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
              <MenuItem
                className={appbarClasses.menuItemAcc}
                onClick={() => router.push('/analytics')}
              >
                <AnalyticsIcon />
                <Typography>{t('analytics')}</Typography>
              </MenuItem>
            )}
            {user?.grade === 'SUPERUSER' && (
              <MenuItem
                className={appbarClasses.menuItemAcc}
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
              className={appbarClasses.menuItemAcc}
            >
              <LogoutIcon />
              <Typography>{t('signout')}</Typography>
            </MenuItem>
          </Box>
        ) : (
          <Box>
            <MenuItem
              onClick={() => router.push('/user/signin')}
              className={appbarClasses.menuItemAcc}
            >
              <LoginIcon />
              <Typography>{t('signin')}</Typography>
            </MenuItem>
            <MenuItem
              onClick={() => router.push('/user/signup')}
              className={appbarClasses.menuItemAcc}
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
