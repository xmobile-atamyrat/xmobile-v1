import Layout from '@/pages/components/Layout';
import PopularCategoriesSection from '@/pages/components/PopularCategoriesSection';
import ProductCard from '@/pages/components/ProductCard';
import PromoBannerSection from '@/pages/components/PromoBannerSection';
import { fetchNewProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  BUSINESS_NAME,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_TO_OG_LOCALE,
  POST_SOVIET_COUNTRIES,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  generateHreflangLinks,
  generateLocalBusinessSchema,
  generateOrganizationSchema,
  getCanonicalUrl,
} from '@/pages/lib/seo';
import { PageSeoData, StorefrontBanner } from '@/pages/lib/types';
import { getStorefrontBanners } from '@/lib/promoBanners';
import { homePageClasses } from '@/styles/classMaps';
import { fontClassName } from '@/styles/theme';
import { ProductGridSkeleton } from '@/pages/components/SkeletonLoader';
import { Box, Typography } from '@mui/material';
import { Product } from '@prisma/client';
import cookie, { serialize } from 'cookie';
import geoip from 'geoip-lite';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

// getServerSideProps because we want to fetch the categories from the server on every request
export const getServerSideProps: GetServerSideProps = (async (context) => {
  let messages = {};
  let locale =
    cookie.parse(context.req.headers.cookie ?? '')[LOCALE_COOKIE_NAME] ?? null;
  let ip =
    context.req.headers['x-real-ip'] ||
    context.req.headers['x-forwarded-for'] ||
    context.req.socket.remoteAddress;
  if (Array.isArray(ip)) {
    ip = ip[0];
  }

  if (ip && typeof ip === 'string') {
    try {
      if (locale == null) {
        const geo = geoip.lookup(ip || '');
        if (geo) {
          const { country } = geo;
          if (country === 'TR') {
            locale = 'tr';
          } else if (POST_SOVIET_COUNTRIES.includes(country)) {
            locale = 'ru';
          } else {
            locale = 'en';
          }
        }
      }
    } catch (error) {
      console.error('GeoIP lookup failed:', error);
    }
  }

  const routeLocale = context.locale;

  // Ensure we have a locale for cookie setting/persistence
  const finalLocale = locale || routeLocale || DEFAULT_LOCALE;

  context.res.setHeader(
    'Set-Cookie',
    serialize(LOCALE_COOKIE_NAME, finalLocale, {
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    }),
  );

  try {
    messages = (await import(`../i18n/${routeLocale}.json`)).default;
  } catch {
    messages = (await import(`../i18n/${DEFAULT_LOCALE}.json`)).default;
  }

  // SEO tags follow routeLocale so they match title/description strings from messages.
  // `locale` (cookie / GeoIP) is still passed to the client to align the URL via router when needed.
  const t = messages as Record<string, string>;
  const businessName = BUSINESS_NAME;

  const titleTemplate = t.homeIndexTitle;
  const descriptionTemplate = t.homeIndexDescription;
  const title = titleTemplate.replace('{businessName}', businessName);
  const description = descriptionTemplate.replace(
    '{businessName}',
    businessName,
  );

  const seoData = {
    title,
    description,
    canonicalUrl: getCanonicalUrl(routeLocale, ''), // Root path
    hreflangLinks: generateHreflangLinks(''), // Root path
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    ogLocale:
      LOCALE_TO_OG_LOCALE[routeLocale as keyof typeof LOCALE_TO_OG_LOCALE] ||
      'ru_RU',
    organizationJsonLd: generateOrganizationSchema(),
    localBusinessJsonLd: generateLocalBusinessSchema(),
  };

  let banners: StorefrontBanner[] = [];
  try {
    banners = await getStorefrontBanners(routeLocale ?? finalLocale);
  } catch (error) {
    console.error('Failed to load promo banners:', error);
  }

  return {
    props: {
      locale:
        context.locale !== context.defaultLocale ? context.locale : locale,
      messages,
      seoData,
      banners,
    },
  };
}) satisfies GetServerSideProps<{
  locale: string | null;
  seoData: PageSeoData;
  banners: StorefrontBanner[];
}>;

export default function Home({
  locale,
  banners,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const platform = usePlatform();
  const t = useTranslations();
  const { categories } = useCategoryContext();
  const { searchKeyword, setSearchKeyword } = useProductContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isFirstRender = useRef(true);

  // Home shows only the newest products — no filters, no infinite scroll.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const fetched = await fetchNewProducts({ page: 1 });
        if (mounted) setProducts(fetched);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // A search on the home page belongs on the dedicated results page.
  // Skip the first run so a stale keyword (e.g. coming back from /product)
  // is just cleared instead of bouncing straight back.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (searchKeyword) setSearchKeyword('');
      return;
    }
    if (searchKeyword) router.push('/product');
  }, [searchKeyword, router, setSearchKeyword]);

  useEffect(() => {
    if (locale == null || router.locale === locale) return;
    router.push(router.pathname, router.asPath, { locale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <Layout showHomeHeader>
      <Box className={homePageClasses.newProductsMobileAppbar[platform]}>
        {platform === 'mobile' && <PromoBannerSection banners={banners} />}
        {platform === 'mobile' && (
          <PopularCategoriesSection categories={categories} />
        )}
      </Box>
      {platform === 'web' && <PromoBannerSection banners={banners} />}
      <Box className="flex flex-row gap-6 w-full">
        <Box className={homePageClasses.main[platform]}>
          <Box className="w-full">
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={platform === 'web' ? 2 : 1.5}
              sx={{
                position: platform === 'web' ? 'sticky' : 'static',
                top: platform === 'web' ? '0px' : 'auto',
                zIndex: 10,
                backgroundColor: '#fff',
                paddingTop: platform === 'web' ? '20px' : '0px',
                paddingBottom: platform === 'web' ? '8px' : '0px',
              }}
            >
              <Typography
                className={`${fontClassName.className} ${homePageClasses.newProductsTitle[platform]}`}
              >
                {t('newProducts')}
              </Typography>
            </Box>

            {isLoading && <ProductGridSkeleton count={8} />}
            <Box className={homePageClasses.newProductsBox[platform]}>
              {products.length > 0 &&
                products.map((product, idx) => (
                  <ProductCard
                    product={product}
                    key={idx}
                    cartProps={{ cartAction: 'add' }}
                  />
                ))}
            </Box>
            {products.length === 0 && !isLoading && (
              <Typography>{t('noProductsFound')}</Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
