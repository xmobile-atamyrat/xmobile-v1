import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  appBarHeight,
  HIGHEST_LEVEL_CATEGORY_ID,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';
import { getCookie, setCookie } from '@/pages/lib/utils';

import { appbarClasses } from '@/styles/classMaps/components/appbar';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';

import categoryList from '@/pages/components/Drawer';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import { drawerClasses } from '@/styles/classMaps/components/drawer';
import { interClassname } from '@/styles/theme';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CallIcon from '@mui/icons-material/Call';
import InstagramIcon from '@mui/icons-material/Instagram';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  CardMedia,
  Divider,
  Menu,
  Paper,
  Select,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

interface CustomAppBarProps {
  showSearch?: boolean;
  handleBackButton?: () => void;
  setEditCategoriesModal?: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal?: Dispatch<SetStateAction<DeleteCategoriesProps>>;
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
  const platform = usePlatform();
  return (
    <Box className={appbarClasses.boxes.form[platform]}>
      <Paper
        component="form"
        className={`${appbarClasses.paper[platform]} mt-${mt} w-${width}`}
        elevation={0}
      >
        <InputBase
          className={`${appbarClasses.inputBase[platform]} ${interClassname.className}`}
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
  showSearch = false,
  handleBackButton,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
}: CustomAppBarProps) {
  const { user } = useUserContext();
  const router = useRouter();
  const t = useTranslations();
  const { setSearchKeyword } = useProductContext();
  const [localSearchKeyword, setLocalSearchKeyword] = useState('');
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [selectedLocale, setSelectedLocale] = useState('ru');
  const platform = usePlatform();
  const languages = [
    { val: 'ru', name: 'Русский', img: '/Russia.png' },
    { val: 'tk', name: 'Türkmençe', img: '/Turkmenistan.png' },
    { val: 'tr', name: 'Türkce', img: '/Turkey.png' },
    { val: 'ch', name: 'Çärjowça', img: '/Turkmenistan.png' },
    { val: 'en', name: 'English', img: '/UnitedKingdom.png' },
  ];
  const [menuStatus, setMenuStatus] = useState(false);
  const { categories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuButton = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setMenuStatus(true);
  };

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
        <Box className="w-full min-h-[64px] flex justify-center items-start">
          <Box className="w-[78.95vw] h-full justify-between flex flex-row items-center">
            <Box className="gap-[24px] min-w-[214px] h-full flex flex-row items-center justify-center">
              <Box className="min-w-[100px] h-auto cursor-pointer">
                <CardMedia
                  component="img"
                  src="/xmobile-processed-logo.png"
                  className="w-[100px] h-auto"
                  onClick={() => {
                    router.push('/');
                  }}
                />
              </Box>
              <Divider
                orientation="vertical"
                flexItem
                className="text-[#303030] mx-[-15px] h-[30px] my-auto"
              />
              <Box className="min-w-[200px] h-full flex flex-row items-center">
                <LocationOnIcon className="h-[20px] text-[#303030]" />
                <Typography
                  className={`${interClassname.className} text-[#303030] text-[14px] text-regular leading-[20px] tracking-normal`}
                >
                  {t('shortAddress')}
                </Typography>
              </Box>
              <Divider
                orientation="vertical"
                flexItem
                className="text-[#303030] mx-[-15px] h-[30px] my-auto"
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
                {languages.map((lang) => (
                  <MenuItem
                    key={lang.val}
                    value={lang.val}
                    className={appbarClasses.menuItem[platform]}
                  >
                    <Box className={appbarClasses.boxes.lang[platform]}>
                      <CardMedia
                        component="img"
                        src={lang.img}
                        className="w-[24px] h-[18px]"
                      />
                      <Typography
                        className={`${appbarClasses.typography[platform]} ${interClassname.className}`}
                      >
                        {lang.name}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <Divider
                orientation="vertical"
                flexItem
                className="text-[#303030] mx-[-15px]"
              />
              <Box className="w-[56px] flex flex-row items-center justify-between">
                <IconButton
                  href={'https://www.tiktok.com/@xmobiletm/'}
                  target="_blank"
                  rel="noopener"
                >
                  <CardMedia
                    component="img"
                    src="/tiktok.png"
                    className="w-auto h-[16px]"
                  />
                </IconButton>
                <IconButton
                  href={'https://www.instagram.com/xmobiletm/'}
                  target="_blank"
                  rel="noopener"
                >
                  <InstagramIcon className="w-[16px] h-[16px] text-[#000]"></InstagramIcon>
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>
        <Divider className="text-[#303030] mt-[-10px]" />
        <Box className="my-[28px] w-[78.95vw] h-[48px] flex flex-row justify-between mx-auto">
          {/* Back button, Menu, Logo */}
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
                />
              </IconButton>
            )}
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="open drawer"
              onClick={handleMenuButton}
              className="p-4"
            >
              <MenuIcon className={appbarClasses.menuIcon[platform]} />
            </IconButton>
            <Menu
              open={menuStatus}
              onClose={() => setMenuStatus(false)}
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              {categories?.length > 0 && (
                <Box className={`${drawerClasses.box}`}>
                  {categoryList(
                    categories,
                    selectedCategoryId,
                    setSelectedCategoryId,
                    setEditCategoriesModal,
                    setDeleteCategoriesModal,
                    0, // depth
                    () => setMenuStatus(false),
                  )}
                </Box>
              )}
              {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
                <Paper className={drawerClasses.paper}>
                  <Tooltip title="Edit categories">
                    <IconButton
                      onClick={() => {
                        setSelectedCategoryId(HIGHEST_LEVEL_CATEGORY_ID);
                        setEditCategoriesModal({
                          open: true,
                          dialogType: 'add',
                        });
                      }}
                    >
                      <AddCircleIcon
                        className={drawerClasses.addCircleIcon[platform]}
                        color="primary"
                      />
                    </IconButton>
                  </Tooltip>
                </Paper>
              )}
            </Menu>
          </Box>

          {/* Search Bar */}
          <Box className="w-[30vw] h-[48px]">
            {SearchBar({
              searchKeyword: localSearchKeyword,
              searchPlaceholder: t('search'),
              setSearchKeyword: setLocalSearchKeyword,
              width: '95%',
            })}
          </Box>

          {/* Cart, Profile */}
          <Box className="flex flex-row w-auto h-full justify-between items-center">
            <Box className="flex flex-row items-center">
              <IconButton
                onClick={() => router.push('/cart')}
                className="rounded-none"
              >
                <CardMedia
                  component="img"
                  src="/cartWeb.png"
                  className={appbarClasses.shoppingCCI[platform]}
                />
                <Typography
                  className={`${interClassname.className} font-regular text-[16px] leading-[24px] tracking-normal text-[#303030] ml-[24px]`}
                >
                  {t('cart')}
                </Typography>
              </IconButton>
              <Divider
                orientation="vertical"
                className="h-[32px] text-[#303030] mx-[12px]"
              />
            </Box>
            <IconButton
              onClick={() => router.push('/user/profile')}
              className="rounded-none"
            >
              <CardMedia
                component="img"
                src="/userBlack.png"
                className={appbarClasses.shoppingCCI[platform]}
              />
              <Box className="flex flex-col items-start justify-center ml-[20px]">
                <Typography
                  className={`${interClassname.className} font-regular text-[16px] leading-[24px] tracking-normal text-[#303030]`}
                >
                  {t('user')}
                </Typography>
                <Typography
                  className={`${interClassname.className} font-bold text-[16px] leading-[24px] tracking-normal text-[#303030]`}
                >
                  {user ? user.name.split(' ')[0] : t('guest')}
                </Typography>
              </Box>
            </IconButton>
          </Box>
        </Box>
      </AppBar>
      {showSearch &&
        platform === 'mobile' &&
        SearchBar({
          mt: isMdUp ? undefined : `${appBarHeight}px`,
          searchKeyword: localSearchKeyword,
          searchPlaceholder: t('search'),
          setSearchKeyword: setLocalSearchKeyword,
          width: '95%',
        })}
    </Box>
  );
}
