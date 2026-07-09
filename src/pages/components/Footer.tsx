import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { parseName } from '@/pages/lib/utils';
import { footerClasses } from '@/styles/classMaps/components/footer';
import { fontClassName } from '@/styles/theme';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MailIcon from '@mui/icons-material/Mail';
import PhoneIcon from '@mui/icons-material/Phone';
import { Box, CardMedia, Divider, Typography } from '@mui/material';
import { Home, LayoutGrid, Search, ShoppingBag, User } from 'lucide-react';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

const phoneNumbers = ['+99361004933', '+99371211717', '+99342230620'];

const navItems = [
  { href: '/', labelKey: 'home', Icon: Home },
  { href: '/category', labelKey: 'categories', Icon: LayoutGrid },
  { href: '/product', labelKey: 'searchNav', Icon: Search },
  { href: '/cart', labelKey: 'cart', Icon: ShoppingBag },
  { href: '/user', labelKey: 'profileNav', Icon: User },
] as const;

export default function Footer() {
  const t = useTranslations();
  const platform = usePlatform();
  const router = useRouter();
  const { categories: allCategories, setSelectedCategoryId } =
    useCategoryContext();
  const { setProducts } = useProductContext();

  const goTo = (href: string) => {
    router.push(href, href, { locale: router.locale });
    setProducts([]);
    setSelectedCategoryId(undefined);
  };

  return (
    <Box className={footerClasses.boxes.main[platform]}>
      <Box
        component="nav"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        }}
        className={footerClasses.boxes.mainMobile[platform]}
      >
        <Box className={footerClasses.boxes.bottomNavigation}>
          {navItems.map(({ href, labelKey, Icon }) => {
            const active = router.pathname === href;
            return (
              <button
                key={href}
                type="button"
                onClick={() => goTo(href)}
                className={`${footerClasses.navItem.wrapper} ${
                  active
                    ? footerClasses.navItem.active
                    : footerClasses.navItem.inactive
                }`}
              >
                <Icon
                  className={footerClasses.navItem.icon}
                  strokeWidth={1.75}
                />
                <span
                  className={`${fontClassName.className} ${
                    active
                      ? footerClasses.navItem.labelActive
                      : footerClasses.navItem.labelInactive
                  }`}
                >
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </Box>
      </Box>
      <Box className={footerClasses.boxes.mainWeb[platform]}>
        <Box className={footerClasses.boxes.footerMain}>
          {/* Footer Stack */}
          <Box className={footerClasses.boxes.footerStack[platform]}>
            {/* Xmobile logo, address */}
            <Box className={footerClasses.boxes.menu}>
              {/* logo */}
              <Link href="/">
                <CardMedia
                  component="img"
                  image="/logo/xmobile-processed-logo.png"
                  alt="Logo"
                  className={footerClasses.imgs.logo}
                />
              </Link>
            </Box>

            {/* contacts */}
            <Box className={footerClasses.boxes.menu}>
              <Box
                className={`${footerClasses.flexDirections.row} items-center`}
              >
                <PhoneIcon className={footerClasses.imgs.icons[platform]} />
                <Box className={`${footerClasses.flexDirections.col} ml-[5px]`}>
                  {[0, 1, 2].map((number) => (
                    <Typography
                      key={phoneNumbers[number]}
                      className={`${footerClasses.typos.contact} ${fontClassName.className}`}
                    >
                      <a href={`tel:${phoneNumbers[number]}`}>
                        {phoneNumbers[number]}
                      </a>
                    </Typography>
                  ))}
                </Box>
              </Box>
              <Box className={`${footerClasses.flexDirections.row} my-[16px]`}>
                <MailIcon className={footerClasses.imgs.icons[platform]} />
                <Typography
                  className={`${footerClasses.typos.contact} ${fontClassName.className} ml-[5px]`}
                >
                  <a href="mailto: ">xmobiletm@gmail.com</a>
                </Typography>
              </Box>
              {/* Address-icon */}
              <Box className={footerClasses.boxes.address}>
                <LocationOnIcon
                  className={footerClasses.imgs.icons[platform]}
                />
                <Typography
                  className={`${footerClasses.typos.contact} ${fontClassName.className} ml-[5px]`}
                >
                  <Link
                    href={'https://maps.app.goo.gl/sYc6VJSSFJW1aUd76'}
                    target="_blank"
                  >
                    {t('address')}
                  </Link>
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* social media */}
          <Box className={`${footerClasses.boxes.menu} min-w-[14vw] mr-[50px]`}>
            <Typography
              className={`${footerClasses.typos.headers} ${fontClassName.className} mb-[12px]`}
            >
              {t('followUs')}
            </Typography>

            <Box className={footerClasses.flexDirections.col}>
              <Link
                target="_blank"
                href={'https://www.instagram.com/xmobiletm/'}
                className="my-[12px]"
              >
                <Typography
                  className={`${fontClassName.className} ${footerClasses.socialLinks}`}
                >
                  Instagram
                </Typography>
              </Link>
              <Link target="_blank" href={'https://www.tiktok.com/@xmobiletm'}>
                <Typography
                  className={`${fontClassName.className} ${footerClasses.socialLinks}`}
                >
                  TikTok
                </Typography>
              </Link>
            </Box>
          </Box>

          {/* Categories */}
          <Box className={footerClasses.boxes.menu}>
            <Typography
              className={`${fontClassName.className} ${footerClasses.typos.headers}`}
            >
              {t('allCategory')}
            </Typography>
            <Box className={footerClasses.boxes.categoryLinks}>
              {allCategories.map((category) => {
                return (
                  <Typography
                    key={category.id}
                    onClick={() => {
                      setProducts([]);
                      setSelectedCategoryId(category.id);
                      router.push(`/product-category/${category.slug}`);
                    }}
                    className={`${fontClassName.className} ${footerClasses.typos.categoryNames}`}
                  >
                    {parseName(category.name, router.locale ?? 'tk')}
                  </Typography>
                );
              })}
            </Box>
          </Box>
        </Box>
        <Divider className="w-full" />

        <Box className={footerClasses.boxes.rights}>
          <Typography
            className={`${footerClasses.typos.copyright} ${fontClassName.className}`}
          >
            Xmobile © {new Date().getFullYear()}. All Rights Reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
