import Layout from '@/pages/components/Layout';
import ProfileMenuItem from '@/pages/components/ProfileMenuItem';
import {
  AUTH_REFRESH_COOKIE_NAME,
  LANGUAGES,
  LOCALE_COOKIE_NAME,
  PHONE_NUMBERS,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { deleteCookie, getCookie, setCookie } from '@/pages/lib/utils';
import { cartIndexClasses } from '@/styles/classMaps/cart';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { colors, interClassname } from '@/styles/theme';
import { ArrowForwardIos } from '@mui/icons-material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CallIcon from '@mui/icons-material/Call';
import DescriptionIcon from '@mui/icons-material/Description';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import {
  Box,
  Button,
  CardMedia,
  CircularProgress,
  Dialog,
  Divider,
  Link,
  List,
  ListItemButton,
  Typography,
} from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

// --- Sub-components for cleaner structure ---

interface LanguageDialogProps {
  open: boolean;
  onClose: () => void;
  selectedLocale: string;
  setSelectedLocale: (locale: string) => void;
}

function LanguageDialog({
  open,
  onClose,
  selectedLocale,
  setSelectedLocale,
}: LanguageDialogProps) {
  const router = useRouter();
  const platform = usePlatform();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="language-dialog-title"
      PaperProps={{
        className: `${profileClasses.dialog.main[platform]} h-[300px]`,
      }}
    >
      <Typography
        id="language-dialog-title"
        className={`${profileClasses.typos.language} ${interClassname.className}`}
      >
        {'Language'}
      </Typography>
      <List className={profileClasses.boxes.langList}>
        {LANGUAGES.map((language) => (
          <ListItemButton
            className={profileClasses.boxes.langListitemButton}
            key={language.val}
            selected={selectedLocale === language.val}
            onClick={() => {
              const newLocale = language.val;
              setSelectedLocale(newLocale);
              setCookie(LOCALE_COOKIE_NAME, newLocale);
              router.push(router.pathname, router.asPath, {
                locale: newLocale,
              });
              onClose();
            }}
            sx={{
              '&.Mui-selected': {
                backgroundColor: colors.paperBackground.web,
              },
            }}
          >
            <Box className={profileClasses.boxes.langOption}>
              <CardMedia
                component="img"
                src={language.img}
                className={profileClasses.langImg}
              />
              <Typography
                className={`${profileClasses.typos.langOption} ${interClassname.className}`}
              >
                {language.name}
              </Typography>
            </Box>
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}

interface LogoutDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function LogoutDialog({ open, onClose, onConfirm }: LogoutDialogProps) {
  const platform = usePlatform();
  const t = useTranslations();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="logout-dialog-title"
      PaperProps={{
        className: profileClasses.dialog.main[platform],
      }}
    >
      <Typography
        id="logout-dialog-title"
        className={`${profileClasses.typos.dialogSignOut} ${interClassname.className}`}
      >
        {t('signout').toUpperCase()}
      </Typography>
      <Box className={profileClasses.boxes.verifyTxt}>
        <Typography
          className={`${profileClasses.typos.verifyTxt} ${interClassname.className}`}
        >
          {t('signOutVerify')}
        </Typography>
      </Box>
      <Box className={profileClasses.boxes.verify}>
        <Button onClick={onClose} disableRipple>
          <Box
            className={`${profileClasses.boxes.option} border-[1px] border-[#838383]`}
          >
            <Typography
              className={`${interClassname.className} ${profileClasses.typos.option}`}
              color={colors.black}
            >
              {t('no')}
            </Typography>
          </Box>
        </Button>
        <Button disableRipple onClick={onConfirm}>
          <Box className={`${profileClasses.boxes.option} bg-[#ff3b30]`}>
            <Typography
              className={`${interClassname.className} ${profileClasses.typos.option}`}
              color={colors.white}
            >
              {t('yes')}
            </Typography>
          </Box>
        </Button>
      </Box>
    </Dialog>
  );
}

interface ContactDialogProps {
  open: boolean;
  onClose: () => void;
}

function ContactDialog({ open, onClose }: ContactDialogProps) {
  const platform = usePlatform();
  const t = useTranslations();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="contact-dialog-title"
      PaperProps={{
        className: `${profileClasses.dialog.main[platform]} h-auto`,
      }}
    >
      <Typography
        id="contact-dialog-title"
        className={`${profileClasses.typos.language} ${interClassname.className}`}
      >
        {t('contact')}
      </Typography>
      <List className={profileClasses.boxes.langList}>
        {PHONE_NUMBERS.map((phone) => (
          <ListItemButton
            className={profileClasses.boxes.langListitemButton}
            key={phone}
            onClick={() => {
              window.location.href = `tel:${phone}`;
              onClose();
            }}
            sx={{
              '&:hover': {
                backgroundColor: colors.lightRed,
              },
            }}
          >
            <Box className={profileClasses.boxes.langOption}>
              <CallIcon className="text-[#303030] mr-2" />
              <Typography
                className={`${profileClasses.typos.langOption} ${interClassname.className}`}
              >
                {phone}
              </Typography>
            </Box>
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}

// --- Main component ---

export default function Profile() {
  const { user, setUser, setAccessToken, isLoading } = useUserContext();
  const [openLogout, setOpenLogout] = useState(false);
  const [openLang, setOpenLang] = useState(false);
  const [openContact, setOpenContact] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState('ru');
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();
  const isAdmin = user && ['SUPERUSER', 'ADMIN'].includes(user.grade);

  useEffect(() => {
    setSelectedLocale((prev) => getCookie(LOCALE_COOKIE_NAME) || prev);
  }, []);

  const handleToggleLang = () => setOpenLang(!openLang);
  const handleToggleLogout = () => setOpenLogout(!openLogout);
  const handleToggleContact = () => setOpenContact(!openContact);

  const handleLogoutConfirm = () => {
    handleToggleLogout();
    deleteCookie(AUTH_REFRESH_COOKIE_NAME);
    setUser(undefined);
    setAccessToken(undefined);
  };

  const handleOrdersClick = () => {
    router.push(isAdmin ? '/orders/admin' : '/orders');
  };

  // Loading state
  if (isLoading) {
    return (
      <Layout handleHeaderBackButton={() => router.push('/')}>
        <Box className={cartIndexClasses.box[platform]}>
          <Box className="flex justify-center items-center h-full">
            <CircularProgress />
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={profileClasses.boxes.loggedInMain}>
        {/* Header: Account title */}
        <Box className={profileClasses.accountTitle[platform]}>
          <Typography
            className={`${profileClasses.typos.account[platform]} ${interClassname.className}`}
          >
            {t('account')}
          </Typography>
        </Box>

        <Box className={profileClasses.boxes.sectionBox[platform]}>
          {/* Profile avatar and name/greeting */}
          <Box className={profileClasses.boxes.accountMain[platform]}>
            <CardMedia
              component="img"
              src="/defaultProfile.jpg"
              className={profileClasses.profileImg[platform]}
            />
            <Box className={profileClasses.boxes.account}>
              {user ? (
                <>
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.name[platform]}`}
                  >
                    {`${t('hello')} ${
                      user.name?.trim() ? user.name.trim().split(' ')[0] : ''
                    }`}
                  </Typography>
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.email}`}
                  >
                    {user.email}
                  </Typography>
                </>
              ) : (
                <>
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.name[platform]}`}
                  >
                    {t('guest')}
                  </Typography>
                  <Box className="flex gap-2 mt-1">
                    <Link
                      href="/user/signin"
                      className="text-[#ff624c] text-sm underline"
                    >
                      {t('signin')}
                    </Link>
                    <Typography className="text-sm">/</Typography>
                    <Link
                      href="/user/signup"
                      className="text-[#ff624c] text-sm underline"
                    >
                      {t('signup')}
                    </Link>
                  </Box>
                </>
              )}
            </Box>
          </Box>

          <Box className={profileClasses.boxes.divider[platform]} />

          {/* Menu items */}
          <Box className="w-[90%] flex flex-col items-center mx-auto">
            {/* Always shown: Contact & Language */}
            <ProfileMenuItem
              onClick={handleToggleContact}
              iconSrc="/contact.png"
              text={t('contact')}
            />
            <Divider className={profileClasses.divider[platform]} />
            <ProfileMenuItem
              onClick={handleToggleLang}
              iconSrc="/language.png"
              text={t('appLanguage')}
            />

            {/* User-only items */}
            {user && (
              <>
                <Divider className={profileClasses.divider[platform]} />

                {/* Admin-only items */}
                {isAdmin && (
                  <>
                    <Button
                      className={profileClasses.boxes.sectionOrders[platform]}
                      disableRipple
                      onClick={() => router.push('/product/update-prices')}
                      variant={platform === 'web' ? 'outlined' : 'text'}
                      sx={{ '&:hover': { backgroundColor: colors.lightRed } }}
                    >
                      <DriveFolderUploadIcon
                        className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                      />
                      <Typography
                        className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                      >
                        {t('updatePrices')}
                      </Typography>
                      <ArrowForwardIos
                        className={profileClasses.icons[platform]}
                      />
                    </Button>
                    <Divider className={profileClasses.divider[platform]} />
                    <ProfileMenuItem
                      onClick={() => router.push('/analytics')}
                      IconComponent={
                        <AnalyticsIcon
                          className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                        />
                      }
                      text={t('analytics')}
                    />
                    <Divider className={profileClasses.divider[platform]} />
                    <ProfileMenuItem
                      onClick={() => router.push('/server-logs')}
                      IconComponent={
                        <DescriptionIcon
                          className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                        />
                      }
                      text={t('serverLogs')}
                    />
                    <Divider className={profileClasses.divider[platform]} />
                    {user.grade === 'SUPERUSER' && (
                      <>
                        <ProfileMenuItem
                          onClick={() => router.push('/procurement')}
                          IconComponent={
                            <LocalShippingOutlinedIcon
                              className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                            />
                          }
                          text={t('procurement')}
                        />
                        <Divider className={profileClasses.divider[platform]} />
                      </>
                    )}
                  </>
                )}

                {/* Orders */}
                <ProfileMenuItem
                  onClick={handleOrdersClick}
                  iconSrc="/orders/my_order_icon.svg"
                  text={isAdmin ? t('userOrders') : t('myOrders')}
                />
                <Divider className={profileClasses.divider[platform]} />

                {/* Logout */}
                <ProfileMenuItem
                  onClick={handleToggleLogout}
                  IconComponent={
                    <MeetingRoomOutlinedIcon
                      className={profileClasses.sectionIcon[platform]}
                    />
                  }
                  text={t('signout')}
                  isLogOut
                />
              </>
            )}
          </Box>
        </Box>

        {/* Dialogs - single instances */}
        <LanguageDialog
          open={openLang}
          onClose={handleToggleLang}
          selectedLocale={selectedLocale}
          setSelectedLocale={setSelectedLocale}
        />
        <ContactDialog open={openContact} onClose={handleToggleContact} />
        {user && (
          <LogoutDialog
            open={openLogout}
            onClose={handleToggleLogout}
            onConfirm={handleLogoutConfirm}
          />
        )}
      </Box>
    </Layout>
  );
}
