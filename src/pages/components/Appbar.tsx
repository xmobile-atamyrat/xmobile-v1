import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { changeLocale } from '@/pages/lib/utils';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import { Avatar, Dialog, Select } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { alpha, styled } from '@mui/material/styles';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useState } from 'react';
import Flag from 'react-flagkit';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: '300px',
  },
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(0, 2),
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0, 1),
  },
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(1, 1, 1, 0),
      paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    },
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1, 1, 1, 0),
      paddingLeft: `calc(1em + ${theme.spacing(2)})`,
      fontSize: '14px',
    },
  },
}));

interface CustomAppBarProps {
  openDrawer: boolean;
  setOpenDrawer: Dispatch<SetStateAction<boolean>>;
}

export default function CustomAppBar({
  setOpenDrawer,
  openDrawer,
}: CustomAppBarProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user } = useUserContext();
  const router = useRouter();
  const isMenuOpen = Boolean(anchorEl);
  const t = useTranslations();
  const { setProducts } = useProductContext();
  const [openSearchBar, setOpenSearchBar] = useState(false);
  const { selectedCategoryId } = useCategoryContext();

  const menuId = 'primary-search-account-menu';
  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      id={menuId}
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
  );

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

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          height: { xs: mobileAppBarHeight, sm: appBarHeight },
        }}
      >
        <Toolbar className="flex items-center justify-between">
          <Box className="flex w-fit h-full items-center justify-start">
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="open drawer"
              sx={{ mr: { sm: 2 } }}
              onClick={() => setOpenDrawer(!openDrawer)}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ fontSize: { xs: 18, sm: 20 } }}
            >
              Xmobile
            </Typography>
          </Box>

          <Box className="flex w-fit h-full items-center justify-center">
            <Search>
              <SearchIconWrapper>
                <SearchIcon
                  sx={{ color: 'white', fontSize: { xs: '20px', sm: '26px' } }}
                />
              </SearchIconWrapper>
              <StyledInputBase
                placeholder={t('search')}
                inputProps={{ 'aria-label': 'search' }}
                onChange={async (event) => {
                  try {
                    await handleSearch(event.target.value);
                  } catch (error) {
                    console.error(error);
                  }
                }}
              />
            </Search>
            <IconButton
              sx={{ display: { sm: 'none' } }}
              onClick={() => setOpenSearchBar(true)}
            >
              <SearchIcon sx={{ color: 'white', fontSize: 25 }} />
            </IconButton>
            <Dialog
              open={openSearchBar}
              onClose={() => setOpenSearchBar(false)}
              sx={{
                '& .MuiDialog-paper': {
                  backgroundColor: 'rgba(0, 0, 0, 0.5)', // adjust alpha value as needed
                  width: '100%',
                  top: '-35%',
                },
                backgroundColor: 'rgba(0, 0, 0, -1)',
              }}
            >
              <Box
                sx={{ padding: 1 }}
                className="flex flex-row justify-start gap-2 items-center"
              >
                <SearchIcon sx={{ color: 'white', fontSize: 25 }} />
                <InputBase
                  placeholder={t('search')}
                  sx={{
                    color: 'white',
                    width: '100%',
                  }}
                  onChange={async (event) => {
                    try {
                      await handleSearch(event.target.value);
                    } catch (error) {
                      console.error(error);
                    }
                  }}
                />
              </Box>
            </Dialog>
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
              }}
              onChange={(event) => {
                const newPath = changeLocale(
                  event.target.value,
                  window.location.search,
                  window.location.pathname,
                );
                window.location.pathname = newPath;
              }}
              style={{
                backgroundColor: 'rgb(59 130 246 / 0.5)',
                color: '#F5F5F5',
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
                    {/* ÇÄR */}
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
                aria-controls={menuId}
                aria-haspopup="true"
                onClick={(event) => setAnchorEl(event.currentTarget)}
                color="inherit"
              >
                {user != null ? (
                  <Avatar
                    sx={{
                      bgcolor: '#4c8dc1',
                      width: { xs: 30, sm: 36 },
                      height: { xs: 30, sm: 36 },
                    }}
                  >
                    {user.name[0].toUpperCase()}
                  </Avatar>
                ) : (
                  <AccountCircle
                    sx={{
                      width: { xs: 30, sm: 36 },
                      height: { xs: 30, sm: 36 },
                    }}
                  />
                )}
              </IconButton>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      {renderMenu}
    </Box>
  );
}
