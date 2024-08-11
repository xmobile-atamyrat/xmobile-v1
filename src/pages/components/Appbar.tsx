import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  appBarHeight,
  LOGO_COLOR,
  LOGO_COLOR_LIGHT,
  MAIN_BG_COLOR,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { changeLocale } from '@/pages/lib/utils';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import CloseIcon from '@mui/icons-material/Close';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
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
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useState } from 'react';
import Flag from 'react-flagkit';

interface CustomAppBarProps {
  openDrawer: boolean;
  setOpenDrawer: Dispatch<SetStateAction<boolean>>;
  showSearch?: boolean;
  handleBackButton?: () => void;
}

export default function CustomAppBar({
  setOpenDrawer,
  openDrawer,
  showSearch = false,
  handleBackButton,
}: CustomAppBarProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user } = useUserContext();
  const router = useRouter();
  const isMenuOpen = Boolean(anchorEl);
  const t = useTranslations();
  const { setProducts } = useProductContext();
  const { selectedCategoryId } = useCategoryContext();
  const [searchKeyword, setSearchKeyword] = useState('');
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  const handleSearch = async (keyword: string) => {
    if (keyword === '') {
      const { success, data }: ResponseApi<Product[]> = await (
        await fetch(`${BASE_URL}/api/product?categoryId=${selectedCategoryId}`)
      ).json();
      if (success && data != null) setProducts(data);
    } else {
      const { success, data }: ResponseApi<Product[]> = await (
        await fetch(`${BASE_URL}/api/product?searchKeyword=${keyword}`)
      ).json();
      if (success && data != null) setProducts(data);
    }
  };

  const searchBar = (
    <Box
      className={`flex items-center justify-center w-full bg-[${MAIN_BG_COLOR}]`}
    >
      <Paper
        component="form"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          mt: isMdUp ? undefined : `${appBarHeight}px`,
          width: '95%',
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
          placeholder={`${t('search')}...`}
          onChange={(e) => {
            const keyword = e.target.value;
            setSearchKeyword(keyword);
            handleSearch(keyword);
          }}
          value={searchKeyword}
        />
        {searchKeyword !== '' && (
          <IconButton
            type="button"
            sx={{ p: '10px' }}
            onClick={() => {
              setSearchKeyword('');
              handleSearch('');
            }}
          >
            <CloseIcon sx={{ color: 'white' }} />
          </IconButton>
        )}
      </Paper>
    </Box>
  );

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
                  style={{
                    color: LOGO_COLOR,
                  }}
                  fontSize="small"
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
                  width: { xs: 30, md: 36 },
                  height: { xs: 30, md: 36 },
                  color: LOGO_COLOR,
                }}
              />
            </IconButton>
            <Box
              sx={{
                width: { xs: 100, sm: 120 },
                height: { xs: 100, sm: 120 },
              }}
              className="flex items-center justify-center"
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
                {searchBar}
              </Box>
            )}
            <Select
              defaultValue={router.locale}
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
                const newPath = changeLocale(
                  event.target.value,
                  window.location.pathname,
                );
                window.location.pathname = newPath;
              }}
            >
              <MenuItem value="tk" sx={{ py: { xs: 0, sm: 1 }, px: 2 }}>
                <Box className="flex flex-row justify-start gap-1 sm:gap-2 w-full items-center">
                  <Flag country="TM" size={18} />
                  <Typography sx={{ fontSize: { xs: 14, sm: 18 } }}>
                    tkm
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
              <MenuItem value="ru" sx={{ py: { xs: 0, sm: 1 }, px: 2 }}>
                <Box className="flex flex-row justify-start gap-1 sm:gap-2 w-full items-center">
                  <Flag country="RU" size={18} />
                  <Typography sx={{ fontSize: { xs: 14, sm: 18 } }}>
                    rus
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
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
      {showSearch && !isMdUp && searchBar}
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
          <MenuItem
            onClick={() => {
              localStorage.removeItem('user');
              router.reload();
            }}
            className="flex flex-row gap-2 items-center justify-start"
          >
            <LogoutIcon />
            <Typography>{t('signout')}</Typography>
          </MenuItem>
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
