import HomePromoTile from '@/pages/components/HomePromoTile';
import Layout from '@/pages/components/Layout';
import PopularCategoriesSection, {
  CategoryImage,
} from '@/pages/components/PopularCategoriesSection';
import ProductCard from '@/pages/components/ProductCard';
import PromoBannerSection from '@/pages/components/PromoBannerSection';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { isSecureRequest } from '@/pages/api/utils/requestScheme';
import {
  BUSINESS_NAME,
  COOKIE_EXPIRY_SECONDS,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_TO_OG_LOCALE,
  POST_SOVIET_COUNTRIES,
  SORT_OPTIONS,
} from '@/pages/lib/constants';
import { useHomeSearch } from '@/pages/lib/hooks/useHomeSearch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { readSearchKeyword } from '@/pages/lib/productSearch';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  generateHreflangLinks,
  generateLocalBusinessSchema,
  generateOrganizationSchema,
  getCanonicalUrl,
} from '@/pages/lib/seo';
import {
  ExtendedProduct,
  PageSeoData,
  StorefrontBanner,
} from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { getStorefrontBanners } from '@/lib/promoBanners';
import { homePageClasses } from '@/styles/classMaps';
import { buttonClasses } from '@/styles/classMaps/components/button';
import { fontClassName } from '@/styles/theme';
import { ProductGridSkeleton } from '@/pages/components/SkeletonLoader';
import { Box, ButtonBase, Typography } from '@mui/material';
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
import { useEffect, useMemo } from 'react';

const web = homePageClasses.web;

// getServerSideProps because we want to fetch the categories from the server on every request
export const getServerSideProps: GetServerSideProps = (async (context) => {
  let messages = {};
  const cookieLocale =
    cookie.parse(context.req.headers.cookie ?? '')[LOCALE_COOKIE_NAME] ?? null;
  let locale = cookieLocale;
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

  // Only refresh a locale the user (or the native wrapper) actually chose.
  // Persisting a GeoIP guess would make it indistinguishable from a real
  // choice and pin that visitor to the guess for the next ten years.
  if (cookieLocale != null) {
    context.res.setHeader(
      'Set-Cookie',
      serialize(LOCALE_COOKIE_NAME, finalLocale, {
        // Staging runs a production build over plain HTTP, where a Secure
        // cookie is silently discarded -- follow the real request scheme.
        secure: isSecureRequest(context.req),
        path: '/',
        sameSite: 'lax',
        maxAge: COOKIE_EXPIRY_SECONDS,
      }),
    );
  }

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

  // The newest in-stock products, rendered on the server so their links are
  // in the raw HTML. With a term in the URL (back from a product opened from
  // home results) the results are what's on screen, so seed those too and save
  // the client its own round-trip. The newest list still loads: clearing the
  // search is a shallow route change, so nothing would fetch it afterwards.
  // Each failure stays its own for the same reason: the client refetches a
  // missing search, but never a missing newest list.
  const searchTerm = readSearchKeyword(context.query);
  const [initialProducts, results] = await Promise.all([
    fetchProducts({
      page: 1,
      locale: routeLocale ?? finalLocale,
      inStock: true,
      sortBy: SORT_OPTIONS.NEWEST,
    }).catch((error): ExtendedProduct[] => {
      console.error('Failed to load initial products:', error);
      return [];
    }),
    searchTerm
      ? fetchProducts({
          page: 1,
          searchKeyword: searchTerm,
          locale: routeLocale ?? finalLocale,
        }).catch((error): null => {
          console.error('Failed to load search results:', error);
          return null;
        })
      : null,
  ]);
  const initialSearch = results ? { term: searchTerm, results } : null;

  return {
    props: {
      locale:
        context.locale !== context.defaultLocale ? context.locale : locale,
      messages,
      seoData,
      banners,
      initialProducts,
      initialSearch,
    },
  };
}) satisfies GetServerSideProps<{
  locale: string | null;
  seoData: PageSeoData;
  banners: StorefrontBanner[];
  initialProducts: Product[];
  initialSearch: { term: string; results: ExtendedProduct[] } | null;
}>;

export default function Home({
  locale,
  banners,
  initialProducts,
  initialSearch,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const platform = usePlatform();
  const t = useTranslations();
  const { categories } = useCategoryContext();
  const { setProducts: setContextProducts } = useProductContext();
  const products: Product[] = initialProducts ?? [];
  // A header search on home stays on home: the results replace the banner and
  // sections, and clearing the field brings them back. The term is read from
  // home's URL (see HOME_PATHNAME), so back from a product restores them.
  const searchTerm = readSearchKeyword(router.query);
  const search = useHomeSearch(searchTerm, router.locale, initialSearch);
  const searchTitle = t('searchResultsFor', { keyword: searchTerm });
  const searchFailure = (
    <Box className="text-center">
      <Typography className={`${fontClassName.className} ${web.emptyText}`}>
        {t('searchLoadError')}
      </Typography>
      <Box className="mt-4 mx-auto max-w-[280px]">
        <ButtonBase
          disableRipple
          onClick={search.retry}
          className={`${fontClassName.className} ${buttonClasses.primary[platform]}`}
        >
          {t('tryAgain')}
        </ButtonBase>
      </Box>
    </Box>
  );

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

  useEffect(() => {
    if (locale == null || router.locale === locale) return;
    router.push(router.pathname, router.asPath, { locale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  if (platform === 'web' && search.isSearching) {
    return (
      <Layout showHomeHeader>
        <Box className={web.page}>
          <Box className={web.sectionHead}>
            <Typography
              className={`${fontClassName.className} ${web.sectionTitle}`}
            >
              {searchTitle}
            </Typography>
          </Box>
          <Box className={web.productGrid}>
            {search.results.map((product) => (
              <ProductCard
                product={product}
                key={product.id}
                cartProps={{ cartAction: 'add' }}
              />
            ))}
          </Box>
          {search.isLoading && (
            <ProductGridSkeleton count={search.results.length ? 5 : 10} />
          )}
          {search.failed && searchFailure}
          {search.results.length === 0 &&
            !search.isLoading &&
            !search.failed && (
              <Typography
                className={`${fontClassName.className} ${web.emptyText}`}
              >
                {t('noProductsFound')}
              </Typography>
            )}
          <div ref={search.sentinelRef} />
        </Box>
      </Layout>
    );
  }

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
          <Box className={web.productGrid}>
            {gridProducts.map((product) => (
              <ProductCard
                product={product}
                key={product.id}
                cartProps={{ cartAction: 'add' }}
              />
            ))}
          </Box>
          {products.length === 0 && (
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

  const mobileProducts = search.isSearching ? search.results : products;
  const mobileLoading = search.isSearching && search.isLoading;
  // Search pages append below the grid, so only its first page gets the
  // full-height skeleton on top.
  const isAppending = search.isSearching && search.results.length > 0;

  return (
    <Layout showHomeHeader>
      {!search.isSearching && (
        <Box className={homePageClasses.newProductsMobileAppbar[platform]}>
          <PromoBannerSection banners={banners} />
          <PopularCategoriesSection categories={categories} />
        </Box>
      )}
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
                {search.isSearching ? searchTitle : t('newProducts')}
              </Typography>
            </Box>

            {mobileLoading && !isAppending && <ProductGridSkeleton count={8} />}
            <Box className={homePageClasses.newProductsBox[platform]}>
              {mobileProducts.length > 0 &&
                mobileProducts.map((product, idx) => (
                  <ProductCard
                    product={product}
                    key={search.isSearching ? product.id : idx}
                    cartProps={{ cartAction: 'add' }}
                  />
                ))}
            </Box>
            {mobileLoading && isAppending && <ProductGridSkeleton count={2} />}
            {search.failed && searchFailure}
            {mobileProducts.length === 0 &&
              !mobileLoading &&
              !search.failed && <Typography>{t('noProductsFound')}</Typography>}
            {search.isSearching && <div ref={search.sentinelRef} />}
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
