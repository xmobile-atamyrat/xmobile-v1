import HomePromoTile from '@/pages/components/HomePromoTile';
import Layout from '@/pages/components/Layout';
import PopularCategoriesSection, {
  CategoryImage,
} from '@/pages/components/PopularCategoriesSection';
import ProductCard from '@/pages/components/ProductCard';
import PromoBannerSection from '@/pages/components/PromoBannerSection';
import { fetchNewProducts, fetchProducts } from '@/pages/lib/apis';
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
import { parseName } from '@/pages/lib/utils';
import { getStorefrontBanners } from '@/lib/promoBanners';
import { homePageClasses } from '@/styles/classMaps';
import { fontClassName } from '@/styles/theme';
import { ProductGridSkeleton } from '@/pages/components/SkeletonLoader';
import { Box, Typography } from '@mui/material';
import { Product } from '@prisma/client';
import cookie, { serialize } from 'cookie';
import geoip from 'geoip-lite';
import {
  ArrowRight,
  Banknote,
  Headset,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

const web = homePageClasses.web;

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

  // Seed the first page server-side so product links are in the raw HTML,
  // not just after the client fetch.
  let initialProducts: Product[] = [];
  try {
    initialProducts = await fetchProducts({
      page: 1,
      locale: routeLocale ?? finalLocale,
    });
  } catch (error) {
    console.error('Failed to load initial products:', error);
  }

  return {
    props: {
      locale:
        context.locale !== context.defaultLocale ? context.locale : locale,
      messages,
      seoData,
      banners,
      initialProducts,
    },
  };
}) satisfies GetServerSideProps<{
  locale: string | null;
  seoData: PageSeoData;
  banners: StorefrontBanner[];
  initialProducts: Product[];
}>;

export default function Home({
  locale,
  banners,
  initialProducts,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const platform = usePlatform();
  const t = useTranslations();
  const { categories } = useCategoryContext();
  const {
    searchKeyword,
    setSearchKeyword,
    setProducts: setContextProducts,
  } = useProductContext();
  // Seeded from the server-rendered first page so the grid isn't empty in the
  // raw HTML; the effect below swaps in the newest-products feed on mount.
  const [products, setProducts] = useState<Product[]>(initialProducts ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const isFirstRender = useRef(true);

  // Web "Shop by category" row (spec 1357-1366): real top-level categories,
  // admin-flagged popular ones first, capped at the design's 8 tiles.
  const webCategories = useMemo(() => {
    const topLevel = categories.filter(
      (cat) => cat.predecessorId == null && cat.deletedAt == null,
    );
    return [
      ...topLevel.filter((cat) => cat.popular),
      ...topLevel.filter((cat) => !cat.popular),
    ].slice(0, 8);
  }, [categories]);

  // The two side promos reuse the newest products, so drop them from the grid
  // below instead of showing the same card twice.
  const promoProducts =
    platform === 'web' && products.length >= 6 ? products.slice(0, 2) : [];
  const gridProducts = products.slice(promoProducts.length);

  const trustItems = [
    {
      icon: Truck,
      title: t('nationwideDelivery'),
      subtitle: t('nationwideDeliverySub'),
    },
    {
      icon: ShieldCheck,
      title: t('officialWarranty'),
      subtitle: t('officialWarrantySub'),
    },
    { icon: Banknote, title: t('cashOnDelivery'), subtitle: t('payInCash') },
    {
      icon: Headset,
      title: t('chatCustomerSupport'),
      subtitle: `${t('supportHoursDays')}, ${t('supportHoursTime')}`,
    },
  ];

  // Home shows only the newest products — no filters, no infinite scroll, so
  // there is no list snapshot to restore here (that lives on /product).
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

  if (platform === 'web') {
    return (
      <Layout showHomeHeader>
        <Box className={web.page}>
          {/* hero banner + side promos (spec 1319-1345) */}
          {(banners.length > 0 || promoProducts.length > 0) && (
            <Box
              className={banners.length > 0 ? web.heroRow : web.heroRowNoBanner}
            >
              {banners.length > 0 && (
                <PromoBannerSection banners={banners} variant="hero" />
              )}
              {promoProducts.length > 0 && (
                <Box
                  className={
                    banners.length > 0 ? web.promoCol : web.promoColWide
                  }
                >
                  {promoProducts.map((product, idx) => (
                    <HomePromoTile
                      key={product.id}
                      product={product}
                      tone={idx === 0 ? 'red' : 'grey'}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* trust strip (spec 1348-1353) — real store promises only */}
          <Box className={web.trustRow}>
            {trustItems.map(({ icon: Icon, title, subtitle }) => (
              <Box key={title} className={web.trustCard}>
                <Box className={web.trustIconBox}>
                  <Icon size={22} />
                </Box>
                <Box>
                  <Typography
                    className={`${fontClassName.className} ${web.trustTitle}`}
                  >
                    {title}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${web.trustSub}`}
                  >
                    {subtitle}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* shop by category (spec 1356-1366) */}
          {webCategories.length > 0 && (
            <Box className={web.sectionGap}>
              <Box className={web.sectionHead}>
                <Typography
                  className={`${fontClassName.className} ${web.sectionTitle}`}
                >
                  {t('shopByCategory')}
                </Typography>
                <Link href="/category" className={web.viewAll}>
                  {t('viewAll')}
                  <ArrowRight size={16} />
                </Link>
              </Box>
              <Box className={web.categoryGrid}>
                {webCategories.map((category) => (
                  <Box
                    key={category.id}
                    className={web.categoryTile}
                    onClick={() => {
                      if (
                        category.successorCategories == null ||
                        category.successorCategories.length === 0
                      ) {
                        setContextProducts([]);
                        router.push(`/product-category/${category.slug}`);
                      } else {
                        router.push(`/category/${category.slug}`);
                      }
                    }}
                  >
                    <CategoryImage
                      initialImgUrl={category.imgUrl}
                      className={web.categoryTileImg}
                    />
                    <Typography
                      className={`${fontClassName.className} ${web.categoryTileName}`}
                    >
                      {parseName(
                        category.name,
                        router.locale ?? DEFAULT_LOCALE,
                      )}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* new arrivals grid — the design's "Recommended for you" slot (spec 1383-1390) */}
          <Box className={web.sectionHead}>
            <Typography
              className={`${fontClassName.className} ${web.sectionTitle}`}
            >
              {t('newProducts')}
            </Typography>
            <Link href="/product" className={web.viewAll}>
              {t('viewAll')}
              <ArrowRight size={16} />
            </Link>
          </Box>
          {isLoading && <ProductGridSkeleton count={10} />}
          <Box className={web.productGrid}>
            {gridProducts.map((product) => (
              <ProductCard
                product={product}
                key={product.id}
                cartProps={{ cartAction: 'add' }}
              />
            ))}
          </Box>
          {products.length === 0 && !isLoading && (
            <Typography
              className={`${fontClassName.className} ${web.emptyText}`}
            >
              {t('noProductsFound')}
            </Typography>
          )}
        </Box>
      </Layout>
    );
  }

  return (
    <Layout showHomeHeader>
      <Box className={homePageClasses.newProductsMobileAppbar[platform]}>
        <PromoBannerSection banners={banners} />
        <PopularCategoriesSection categories={categories} />
      </Box>
      <Box className="flex flex-row gap-6 w-full">
        <Box className={homePageClasses.main[platform]}>
          <Box className="w-full">
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={1.5}
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
