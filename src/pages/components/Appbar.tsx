import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import { getCookie, parseName, setCookie } from '@/pages/lib/utils';

import { appbarClasses } from '@/styles/classMaps/components/appbar';
import SearchIcon from '@mui/icons-material/Search';
import {
  ArrowLeft,
  BadgeHelp,
  Bell,
  ChevronDown,
  ChevronUp,
  Globe,
  MapPin,
  Menu as MenuIcon,
  Phone,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  User as UserIcon,
} from 'lucide-react';

import CategoryMegaMenu from '@/pages/components/CategoryMegaMenu';
import NotificationBadge from '@/pages/components/NotificationBadge';
import NotificationMenu from '@/pages/components/NotificationMenu';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { fontClassName } from '@/styles/theme';
// lucide 1.x dropped brand glyphs, so Instagram stays on the MUI icon.
import InstagramIcon from '@mui/icons-material/Instagram';
import { CardMedia, Paper, Select } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

// Real store line — same number the footer contact block already lists.
const HEADER_PHONE = '+99361004933';
const HEADER_PHONE_DISPLAY = '(+993) 61 004933';

interface CustomAppBarProps {
  showHomeHeader?: boolean;
  onHomeFilterClick?: () => void;
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
  showFilter,
  onFilterClick,
  formClassName,
}: {
  handleSearch?: (keyword: string) => Promise<void> | void;
  searchPlaceholder: string;
  searchKeyword: string;
  setSearchKeyword: Dispatch<SetStateAction<string>>;
  mt?: string;
  width?: string;
  showFilter?: boolean;
  onFilterClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  formClassName?: string;
}) => {
  const platform = usePlatform();
  return (
    <Box className={formClassName ?? appbarClasses.boxes.form[platform]}>
      <Paper
        component="form"
        className={`${appbarClasses.paper[platform]} mt-${mt} w-${width}`}
        elevation={0}
      >
        {platform === 'mobile' ? (
          <Search size={18} className="text-[#8B8A98] flex-shrink-0" />
        ) : (
          <SearchIcon className="text-[#30303090]" />
        )}
        <InputBase
          className={`${appbarClasses.inputBase[platform]} ${fontClassName.className}`}
          placeholder={`${searchPlaceholder}${platform === 'web' ? '...' : ''}`}
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
      {showFilter && platform === 'mobile' && (
        <button
          className={appbarClasses.filterButton.mobile}
          onClick={onFilterClick}
          type="button"
          aria-label="filters"
        >
          <SlidersHorizontal size={20} />
        </button>
      )}
    </Box>
  );
};

export default function CustomAppBar({
  showHomeHeader = false,
  onHomeFilterClick,
  handleBackButton,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
}: CustomAppBarProps) {
  const { user } = useUserContext();
  const { unreadCount } = useNotificationContext();
  const router = useRouter();
  const t = useTranslations();
  const { searchKeyword, setSearchKeyword, setProducts } = useProductContext();
  // Layout (and with it this Appbar) remounts on every navigation, so seed the
  // field from the shared keyword — otherwise the header search goes blank the
  // moment it lands on the results page.
  const [localSearchKeyword, setLocalSearchKeyword] = useState(
    searchKeyword ?? '',
  );
  // This Appbar mounts on every page (Layout), returning null on non-home
  // mobile pages *after* hooks run. Skip the first debounce so an unused
  // instance doesn't clobber the shared searchKeyword with its empty state.
  const isFirstSearchRun = useRef(true);
  const [selectedLocale, setSelectedLocale] = useState('ru');
  const platform = usePlatform();
  const languages = [
    { val: 'ru', name: 'Русский', img: '/flags/Russia.png' },
    { val: 'tk', name: 'Türkmençe', img: '/flags/Turkmenistan.png' },
    { val: 'tr', name: 'Türkce', img: '/flags/Turkey.png' },
    { val: 'ch', name: 'Çärjowça', img: '/flags/Turkmenistan.png' },
    { val: 'en', name: 'English', img: '/flags/UnitedKingdom.png' },
  ];
  const [menuStatus, setMenuStatus] = useState(false);
  const { categories, setSelectedCategoryId } = useCategoryContext();
  const [notificationAnchorEl, setNotificationAnchorEl] =
    useState<null | HTMLElement>(null);

  // Both "All categories" triggers (search scope + category bar) toggle the one
  // mega menu, which drops from the bottom of the header rather than anchoring.
  const handleMenuButton = () => setMenuStatus((isOpen) => !isOpen);

  useEffect(() => {
    if (router.locale && router.locale !== router.defaultLocale) {
      setSelectedLocale(router.locale);
    } else {
      setSelectedLocale(
        getCookie(LOCALE_COOKIE_NAME) || router.defaultLocale || 'ru',
      );
    }
  }, [router.locale, router.defaultLocale]);

  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return undefined;
    }
    const handler = setTimeout(() => {
      setSearchKeyword(localSearchKeyword);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearchKeyword]);

  if (platform === 'mobile' && !showHomeHeader) {
    return null;
  }

  if (platform === 'mobile') {
    return (
      <Box className={appbarClasses.appbar.mobile}>
        {/* Header: guest greeting + Sign in, or location + notification */}
        <Box className={appbarClasses.boxes.header.mobile}>
          {user ? (
            <Box className={appbarClasses.boxes.deliverTo.mobile}>
              <MapPin size={15} className="text-[#E41E2B]" />
              <div>
                <div className="text-[11px] text-[#8B8A98] font-normal">
                  {t('deliverTo')}
                </div>
                <div className="text-[15px] text-[#20166E] font-bold">
                  {t('shortAddress')}
                </div>
              </div>
            </Box>
          ) : (
            <Box
              className={`${appbarClasses.boxes.guestGreeting.mobile} ${fontClassName.className}`}
            >
              <div className="text-[11px] text-[#8B8A98] font-normal">
                {t('welcomeToXmobile')} 👋
              </div>
              <div className="text-[18px] text-[#20166E] font-bold leading-tight">
                {t('browsingAsGuest')}
              </div>
            </Box>
          )}
          {user ? (
            <>
              <button
                className={appbarClasses.notificationButton.mobile}
                onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                  setNotificationAnchorEl(e.currentTarget)
                }
                type="button"
                aria-label="notifications"
              >
                <Bell size={20} className="text-[#20166E]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-[#E41E2B]" />
                )}
              </button>
              <NotificationMenu
                anchorEl={notificationAnchorEl}
                open={Boolean(notificationAnchorEl)}
                onClose={() => setNotificationAnchorEl(null)}
              />
            </>
          ) : (
            <button
              className={`${appbarClasses.guestSignInButton.mobile} ${fontClassName.className}`}
              onClick={() => router.push('/user/signin')}
              type="button"
            >
              {t('signin')}
            </button>
          )}
        </Box>

        {/* Search bar with filter */}
        {SearchBar({
          searchKeyword: localSearchKeyword,
          searchPlaceholder: t('search'),
          setSearchKeyword: setLocalSearchKeyword,
          showFilter: Boolean(onHomeFilterClick),
          onFilterClick: onHomeFilterClick
            ? () => onHomeFilterClick()
            : undefined,
        })}
      </Box>
    );
  }

  // ---- Web header (spec 1281-1315): utility bar / main header / category bar.
  const web = appbarClasses.web;
  const activeCategorySlug = (router.query.slug ??
    router.query.categorySlug) as string | undefined;

  const runWebSearch = () => {
    const keyword = localSearchKeyword.trim();
    if (!keyword) return;
    setSearchKeyword(keyword);
    router.push('/product');
  };

  // Same branch the categories index uses: leaf categories go straight to the
  // product listing, parents open the sub-category page.
  const goToCategory = (category: ExtendedCategory) => {
    setProducts([]);
    setSelectedCategoryId(category.id);
    if (
      category.successorCategories == null ||
      category.successorCategories.length === 0
    ) {
      router.push(`/product-category/${category.slug}`);
    } else {
      router.push(`/category/${category.slug}`);
    }
  };

  return (
    <Box className="flex-grow-1">
      <AppBar
        position="sticky"
        className={appbarClasses.appbar[platform]}
        elevation={0}
      >
        {/* ---- Utility bar ---- */}
        <Box
          className={`${web.bleed} ${web.utilityBar} ${fontClassName.className}`}
        >
          <Box className={web.utilityAddressGroup}>
            <MapPin className={web.utilityIcon} />
            <span className="whitespace-nowrap">{t('deliverTo')}</span>
            <span className={web.utilityAddress}>{t('shortAddress')}</span>
          </Box>
          <Box className={web.utilityGroup}>
            <a
              href={`tel:${HEADER_PHONE}`}
              className={`${web.utilityItem} ${web.utilityItemPhone}`}
            >
              <Phone className={web.utilityIcon} />
              {HEADER_PHONE_DISPLAY}
            </a>
            <button
              type="button"
              className={web.utilityItem}
              onClick={() => router.push('/orders')}
            >
              <Truck className={web.utilityIcon} />
              {t('myOrders')}
            </button>
            <button
              type="button"
              className={web.utilityItem}
              onClick={() => router.push('/support')}
            >
              <BadgeHelp className={web.utilityIcon} />
              {t('supportTitle')}
            </button>
            <Select
              value={selectedLocale}
              variant="standard"
              disableUnderline
              className={appbarClasses.select[platform]}
              renderValue={(value) => (
                <Box className="flex flex-row items-center gap-1.5 text-white text-[13px]">
                  <Globe className={web.utilityIcon} />
                  <Typography
                    className={`${fontClassName.className} text-[13px] text-white`}
                  >
                    {languages.find((lang) => lang.val === value)?.name}
                  </Typography>
                </Box>
              )}
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
                      className={`${appbarClasses.typography[platform]} ${fontClassName.className}`}
                    >
                      {lang.name}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
            <Box className={web.utilitySocial}>
              <a
                href="https://www.instagram.com/xmobiletm/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className={web.utilitySocialButton}
              >
                <InstagramIcon className="w-[15px] h-[15px]" />
              </a>
              <a
                href="https://www.tiktok.com/@xmobiletm/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className={web.utilitySocialButton}
              >
                <CardMedia
                  component="img"
                  src="/icons/tiktok.png"
                  className="w-auto h-[14px] invert brightness-0"
                />
              </a>
            </Box>
          </Box>
        </Box>

        {/* ---- Main header: logo, search, account/cart ---- */}
        <Box className={`${web.bleed} ${web.mainBar}`}>
          {handleBackButton && (
            <button
              type="button"
              aria-label="back"
              className={web.backButton}
              onClick={handleBackButton}
            >
              <ArrowLeft className={web.backIcon} />
            </button>
          )}
          <CardMedia
            component="img"
            src="/logo/xmobile-processed-logo.png"
            className={web.logo}
            onClick={() => router.push('/')}
          />
          <form
            className={web.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              runWebSearch();
            }}
          >
            <button
              type="button"
              aria-expanded={menuStatus}
              className={`${web.searchScope} ${fontClassName.className}`}
              onClick={handleMenuButton}
            >
              {t('allCategory')}
              {menuStatus ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <Box className={web.searchField}>
              <Search className="w-[18px] h-[18px] text-muted flex-shrink-0" />
              <InputBase
                className={`${web.searchInput} ${fontClassName.className}`}
                placeholder={t('search')}
                value={localSearchKeyword}
                onChange={(e) => setLocalSearchKeyword(e.target.value)}
              />
            </Box>
            <button
              type="submit"
              className={`${web.searchSubmit} ${fontClassName.className}`}
            >
              <Search className="w-[18px] h-[18px]" />
              {t('searchNav')}
            </button>
          </form>

          <Box className={web.actions}>
            <Box className={web.account} onClick={() => router.push('/user')}>
              <UserIcon className={web.accountIcon} />
              <Box className="flex flex-col items-start">
                <span
                  className={`${web.accountLabel} ${fontClassName.className}`}
                >
                  {user ? t('account') : t('signin')}
                </span>
                <span
                  className={`${web.accountValue} ${fontClassName.className}`}
                >
                  {user ? user.name.split(' ')[0] : t('guest')}
                </span>
              </Box>
            </Box>
            {user && (
              <>
                <NotificationBadge
                  onClick={(e: React.MouseEvent<HTMLElement>) =>
                    setNotificationAnchorEl(e.currentTarget)
                  }
                />
                <NotificationMenu
                  anchorEl={notificationAnchorEl}
                  open={Boolean(notificationAnchorEl)}
                  onClose={() => setNotificationAnchorEl(null)}
                />
              </>
            )}
            <button
              type="button"
              aria-label={t('cart')}
              title={t('cart')}
              className={web.iconAction}
              onClick={() => router.push('/cart')}
            >
              <ShoppingCart className={web.actionIcon} />
            </button>
          </Box>
        </Box>

        {/* ---- Category bar ---- */}
        <Box className={`${web.bleed} ${web.categoryBar}`}>
          <button
            type="button"
            aria-expanded={menuStatus}
            className={`${web.categoryMenuButton} ${
              menuStatus ? web.categoryMenuButtonOpen : ''
            } ${fontClassName.className}`}
            onClick={handleMenuButton}
          >
            <MenuIcon className="w-[18px] h-[18px]" />
            {t('allCategory')}
          </button>
          <Box className={web.categoryList}>
            {categories?.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => goToCategory(category)}
                className={`${web.categoryChip} ${
                  activeCategorySlug === category.slug
                    ? web.categoryChipActive
                    : web.categoryChipInactive
                } ${fontClassName.className}`}
              >
                {parseName(category.name, router.locale ?? 'ru')}
              </button>
            ))}
          </Box>
        </Box>

        {/* Shared mega menu: opened by both "All categories" triggers above */}
        <CategoryMegaMenu
          categories={categories}
          open={menuStatus}
          onClose={() => setMenuStatus(false)}
          onNavigate={goToCategory}
          setEditCategoriesModal={setEditCategoriesModal}
          setDeleteCategoriesModal={setDeleteCategoriesModal}
        />
      </AppBar>
    </Box>
  );
}
