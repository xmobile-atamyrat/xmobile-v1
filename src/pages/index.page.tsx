import AppDownloadBanner from '@/pages/components/AppDownloadBanner';
import HomeBrandChips from '@/pages/components/HomeBrandChips';
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
  HOME_BRAND_QUERY_KEY,
  HOME_NEW_PRODUCTS,
  HOME_RECOMMENDED_PRODUCTS,
  LOCALE_COOKIE_NAME,
  LOCALE_TO_OG_LOCALE,
  SORT_OPTIONS,
} from '@/pages/lib/constants';
import {
  isCrawler,
  isSupportedLocale,
  Locale,
  localeFromAcceptLanguage,
  localeFromCountry,
  localizedPath,
} from '@/lib/localeDetection';
import { useBrandProducts } from '@/pages/lib/hooks/useBrandProducts';
import { useHomeSearch } from '@/pages/lib/hooks/useHomeSearch';
import { useImagelessProducts } from '@/pages/lib/hooks/useImagelessProducts';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { readSearchKeyword } from '@/pages/lib/productSearch';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  generateHreflangLinks,
  generateLocalBusinessSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  getCanonicalUrl,
} from '@/pages/lib/seo';
import {
  ExtendedProduct,
  PageSeoData,
  StorefrontBanner,
} from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { getHomeBrands, HomeBrand } from '@/lib/homeBrands';
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
import {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import type { ParsedUrlQuery } from 'querystring';

const web = homePageClasses.web;

// Web shows the two newest products as promo tiles beside the hero, so the
// newest list is fetched with room for them on top of a full section.
const HOME_PROMO_TILES = 2;

// Each section's "view all" opens the catalog in the same order, which keeps
// going past what home had room for. Recommended's lists only the picks.
const RECOMMENDED_LISTING_HREF = `/product?recommended=1&sortBy=${SORT_OPTIONS.RECOMMENDED}`;
const NEWEST_LISTING_HREF = '/product';
// Staff only; see ProductGridContent.
const IMAGELESS_LISTING_HREF = '/product?imageless=1';

/** GeoIP's locale for the visitor's address, or null if it can't tell. */
function localeFromIp(req: GetServerSidePropsContext['req']): Locale | null {
  let ip =
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress;
  if (Array.isArray(ip)) {
    [ip] = ip;
  }
  // X-Forwarded-For is "client, proxy1, proxy2"; geoip wants one address.
  ip = ip?.split(',')[0].trim();
  if (!ip) return null;
  try {
    const geo = geoip.lookup(ip);
    return geo ? localeFromCountry(geo.country) : null;
  } catch (error) {
    console.error('GeoIP lookup failed:', error);
    return null;
  }
}

// getServerSideProps because we want to fetch the categories from the server on every request
export const getServerSideProps: GetServerSideProps = (async (context) => {
  let messages = {};
  const { req } = context;
  const cookieLocale =
    cookie.parse(req.headers.cookie ?? '')[LOCALE_COOKIE_NAME] ?? null;
  const routeLocale = context.locale ?? DEFAULT_LOCALE;
  const picked = isSupportedLocale(cookieLocale) ? cookieLocale : null;

  // In production nginx already applied the cookie, the browser's language and
  // the link's (scripts/prod_scripts/nginx-locale-*). Only full page loads from
  // people are redirected: client navigations keep the visitor's language, and
  // a crawler must index each home as the language its URL names.
  //  - The pick is applied here again, so home still honours it when nginx
  //    lacks the snippet (staging, dev, or a restart-nginx.sh that dropped it).
  //    Behind nginx it already matches and this does nothing.
  //  - GeoIP is the last guess and lives here, as it needs the GeoIP database:
  //    plain `/`, no pick, and a browser language we don't ship.
  if (!req.headers['x-nextjs-data'] && !isCrawler(req.headers['user-agent'])) {
    let wanted: Locale | null = picked;
    if (
      !wanted &&
      context.locale === context.defaultLocale &&
      localeFromAcceptLanguage(req.headers['accept-language']) == null
    ) {
      wanted = localeFromIp(req);
    }
    if (wanted && wanted !== routeLocale) {
      return {
        redirect: {
          destination: localizedPath(wanted, context.resolvedUrl),
          permanent: false,
        },
      };
    }
  }

  // Only refresh a locale the user (or the native wrapper) actually chose.
  // Persisting a GeoIP guess would make it indistinguishable from a real
  // choice and pin that visitor to the guess for the next ten years.
  if (picked) {
    context.res.setHeader(
      'Set-Cookie',
      serialize(LOCALE_COOKIE_NAME, picked, {
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
    websiteJsonLd: generateWebSiteSchema(),
    localBusinessJsonLd: generateLocalBusinessSchema(),
  };

  let banners: StorefrontBanner[] = [];
  try {
    banners = await getStorefrontBanners(routeLocale);
  } catch (error) {
    console.error('Failed to load promo banners:', error);
  }

  // The admin-picked and the newest in-stock products, rendered on the server
  // so their links are in the raw HTML. With a term in the URL (back from a
  // product opened from home results) the results are what's on screen, so
  // seed those too and save the client its own round-trip. The sections still
  // load: clearing the search is a shallow route change, so nothing would fetch
  // them afterwards. Each failure stays its own for the same reason: the client
  // refetches a missing search, but never a missing section.
  const searchTerm = readSearchKeyword(context.query);
  const productLocale = routeLocale;
  // The brand in the URL is seeded too, but only if it is one of the chips
  // shown, so a stale or made-up id costs no query. Brands load first because
  // they gate that seed; a failure leaves the strip empty, not the page broken.
  let brands: HomeBrand[] = [];
  try {
    brands = await getHomeBrands();
  } catch (error) {
    console.error('Failed to load brands:', error);
  }
  const rawBrand = context.query[HOME_BRAND_QUERY_KEY];
  const brandParam = Array.isArray(rawBrand) ? rawBrand[0] : rawBrand;
  const brandId = brands.find((brand) => brand.id === brandParam)?.id ?? null;
  // The newest row leaves out picks so no card appears in both sections; a
  // pick past the recommended row's cap still shows in its "view all".
  const [initialProducts, recommendedProducts, results, brandProducts] =
    await Promise.all([
      fetchProducts({
        page: 1,
        locale: productLocale,
        inStock: true,
        recommended: false,
        sortBy: SORT_OPTIONS.NEWEST,
        limit: HOME_NEW_PRODUCTS + HOME_PROMO_TILES,
      }).catch((error): ExtendedProduct[] => {
        console.error('Failed to load initial products:', error);
        return [];
      }),
      fetchProducts({
        page: 1,
        locale: productLocale,
        inStock: true,
        recommended: true,
        sortBy: SORT_OPTIONS.RECOMMENDED,
        limit: HOME_RECOMMENDED_PRODUCTS,
      }).catch((error): ExtendedProduct[] => {
        console.error('Failed to load recommended products:', error);
        return [];
      }),
      searchTerm
        ? fetchProducts({
            page: 1,
            searchKeyword: searchTerm,
            locale: productLocale,
          }).catch((error): null => {
            console.error('Failed to load search results:', error);
            return null;
          })
        : null,
      brandId
        ? fetchProducts({
            page: 1,
            brandIds: [brandId],
            inStock: true,
            sortBy: SORT_OPTIONS.RECOMMENDED,
            limit: HOME_RECOMMENDED_PRODUCTS,
            locale: productLocale,
          }).catch((error): null => {
            console.error('Failed to load brand products:', error);
            return null;
          })
        : null,
    ]);
  const initialSearch = results ? { term: searchTerm, results } : null;
  const initialBrand =
    brandId && brandProducts ? { brandId, products: brandProducts } : null;

  return {
    props: {
      messages,
      seoData,
      banners,
      initialProducts,
      recommendedProducts,
      initialSearch,
      brands,
      initialBrand,
    },
  };
}) satisfies GetServerSideProps<{
  seoData: PageSeoData;
  banners: StorefrontBanner[];
  initialProducts: Product[];
  recommendedProducts: Product[];
  initialSearch: { term: string; results: ExtendedProduct[] } | null;
  brands: HomeBrand[];
  initialBrand: { brandId: string; products: ExtendedProduct[] } | null;
}>;

/** A mobile section's title row, with its way on to the full catalog. */
function MobileSectionHead({ title, href }: { title: string; href?: string }) {
  const t = useTranslations();
  return (
    <Box className={homePageClasses.mobileSectionHead}>
      <Typography
        component="h2"
        className={`${fontClassName.className} ${homePageClasses.newProductsTitle.mobile}`}
      >
        {title}
      </Typography>
      {href && (
        <Link
          href={href}
          className={`${fontClassName.className} ${homePageClasses.mobileViewAll}`}
        >
          {t('viewAll')}
          <ArrowRight size={14} />
        </Link>
      )}
    </Box>
  );
}

/** Retry prompt for a section whose fetch failed. */
function LoadFailure({
  onRetry,
  platform,
}: {
  onRetry: () => void;
  platform: 'web' | 'mobile';
}) {
  const t = useTranslations();
  return (
    <Box className="text-center">
      <Typography
        className={`${fontClassName.className} ${homePageClasses.web.emptyText}`}
      >
        {t('searchLoadError')}
      </Typography>
      <Box className="mt-4 mx-auto max-w-[280px]">
        <ButtonBase
          disableRipple
          onClick={onRetry}
          className={`${fontClassName.className} ${buttonClasses.primary[platform]}`}
        >
          {t('tryAgain')}
        </ButtonBase>
      </Box>
    </Box>
  );
}

export default function Home({
  banners,
  initialProducts,
  recommendedProducts,
  initialSearch,
  brands,
  initialBrand,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const platform = usePlatform();
  const t = useTranslations();
  const { categories } = useCategoryContext();
  const { setProducts: setContextProducts } = useProductContext();
  const products: Product[] = initialProducts ?? [];
  const recommended: Product[] = recommendedProducts ?? [];
  // A header search on home stays on home: the results replace the banner and
  // sections, and clearing the field brings them back. The term is read from
  // home's URL (see HOME_PATHNAME), so back from a product restores them.
  const searchTerm = readSearchKeyword(router.query);
  const search = useHomeSearch(searchTerm, router.locale, initialSearch);
  // Staff only: what still needs a photo, above the picks (null for others).
  const imageless = useImagelessProducts(router.locale);
  const imagelessTitle =
    imageless && `${t('imagelessProducts')} (${imageless.total})`;
  const searchTitle = t('searchResultsFor', { keyword: searchTerm });
  const searchFailure = (
    <LoadFailure onRetry={search.retry} platform={platform} />
  );

  // The brand picked on mobile lives in the URL so back from a product keeps
  // it; an id that isn't one of the chips counts as no pick.
  const brandParam = router.query[HOME_BRAND_QUERY_KEY];
  const selectedBrand =
    (brands as HomeBrand[]).find(
      (brand) =>
        brand.id === (Array.isArray(brandParam) ? brandParam[0] : brandParam),
    ) ?? null;
  const brandProducts = useBrandProducts(
    selectedBrand?.id ?? null,
    router.locale,
    initialBrand,
  );
  const selectBrand = (id: string | null) => {
    const query: ParsedUrlQuery = { ...router.query };
    if (id) query[HOME_BRAND_QUERY_KEY] = id;
    else delete query[HOME_BRAND_QUERY_KEY];
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

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
  const gridProducts = products
    .slice(promoProducts.length)
    .slice(0, HOME_NEW_PRODUCTS);

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

          {imageless && imageless.products.length > 0 && (
            <Box component="section" className={web.sectionGap}>
              <Box className={web.sectionHead}>
                <Typography
                  component="h2"
                  className={`${fontClassName.className} ${web.sectionTitle}`}
                >
                  {imagelessTitle}
                </Typography>
                <Link href={IMAGELESS_LISTING_HREF} className={web.viewAll}>
                  {t('viewAll')}
                  <ArrowRight size={16} />
                </Link>
              </Box>
              <Typography
                className={`${fontClassName.className} ${homePageClasses.staffHint}`}
              >
                {t('imagelessProductsHint')}
              </Typography>
              <Box className={web.productGrid}>
                {imageless.products.map((product) => (
                  <ProductCard
                    product={product}
                    key={product.id}
                    cartProps={{ cartAction: 'add' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* admin-picked products, in their order — the design's
              "Recommended for you" slot (spec 1383-1390) */}
          {recommended.length > 0 && (
            <Box component="section" className={web.sectionGap}>
              <Box className={web.sectionHead}>
                <Typography
                  component="h2"
                  className={`${fontClassName.className} ${web.sectionTitle}`}
                >
                  {t('recommendedProducts')}
                </Typography>
                <Link href={RECOMMENDED_LISTING_HREF} className={web.viewAll}>
                  {t('viewAll')}
                  <ArrowRight size={16} />
                </Link>
              </Box>
              <Box className={web.productGrid}>
                {recommended.map((product) => (
                  <ProductCard
                    product={product}
                    key={product.id}
                    cartProps={{ cartAction: 'add' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* new arrivals grid */}
          <Box component="section">
            <Box className={web.sectionHead}>
              <Typography
                component="h2"
                className={`${fontClassName.className} ${web.sectionTitle}`}
              >
                {t('newProducts')}
              </Typography>
              <Link href={NEWEST_LISTING_HREF} className={web.viewAll}>
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
        </Box>
      </Layout>
    );
  }

  const mobileProducts = search.isSearching
    ? search.results
    : products.slice(0, HOME_NEW_PRODUCTS);
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
          <AppDownloadBanner />
          <Box className="w-full px-5">
            <HomeBrandChips
              brands={brands}
              selectedId={selectedBrand?.id ?? null}
              onSelect={selectBrand}
            />
          </Box>
        </Box>
      )}
      <Box className="flex flex-row gap-6 w-full">
        <Box className={homePageClasses.main[platform]}>
          {!search.isSearching &&
            imageless &&
            imageless.products.length > 0 && (
              <Box
                component="section"
                className={homePageClasses.mobileSection}
              >
                <MobileSectionHead
                  title={imagelessTitle ?? ''}
                  href={IMAGELESS_LISTING_HREF}
                />
                <Typography
                  className={`${fontClassName.className} ${homePageClasses.staffHint}`}
                >
                  {t('imagelessProductsHint')}
                </Typography>
                <Box className={homePageClasses.newProductsBox[platform]}>
                  {imageless.products.map((product) => (
                    <ProductCard
                      product={product}
                      key={product.id}
                      cartProps={{ cartAction: 'add' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          {!search.isSearching && selectedBrand && (
            <Box component="section" className={homePageClasses.mobileSection}>
              <MobileSectionHead
                title={selectedBrand.name}
                href={`/product?brandIds=${encodeURIComponent(selectedBrand.id)}`}
              />
              {brandProducts.isLoading && <ProductGridSkeleton count={4} />}
              <Box className={homePageClasses.newProductsBox[platform]}>
                {brandProducts.products.map((product) => (
                  <ProductCard
                    product={product}
                    key={product.id}
                    cartProps={{ cartAction: 'add' }}
                  />
                ))}
              </Box>
              {brandProducts.failed && (
                <LoadFailure
                  onRetry={brandProducts.retry}
                  platform={platform}
                />
              )}
              {brandProducts.products.length === 0 &&
                !brandProducts.isLoading &&
                !brandProducts.failed && (
                  <Typography>{t('noProductsFound')}</Typography>
                )}
            </Box>
          )}
          {!search.isSearching && !selectedBrand && recommended.length > 0 && (
            <Box component="section" className={homePageClasses.mobileSection}>
              <MobileSectionHead
                title={t('recommendedProducts')}
                href={RECOMMENDED_LISTING_HREF}
              />
              <Box className={homePageClasses.newProductsBox[platform]}>
                {recommended.map((product) => (
                  <ProductCard
                    product={product}
                    key={product.id}
                    cartProps={{ cartAction: 'add' }}
                  />
                ))}
              </Box>
            </Box>
          )}
          {/* A picked brand is the whole feed: New products would bury it. */}
          {(search.isSearching || !selectedBrand) && (
            <Box component="section" className="w-full">
              <MobileSectionHead
                title={search.isSearching ? searchTitle : t('newProducts')}
                href={search.isSearching ? undefined : NEWEST_LISTING_HREF}
              />

              {mobileLoading && !isAppending && (
                <ProductGridSkeleton count={8} />
              )}
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
              {mobileLoading && isAppending && (
                <ProductGridSkeleton count={2} />
              )}
              {search.failed && searchFailure}
              {mobileProducts.length === 0 &&
                !mobileLoading &&
                !search.failed && (
                  <Typography>{t('noProductsFound')}</Typography>
                )}
              {search.isSearching && <div ref={search.sentinelRef} />}
            </Box>
          )}
        </Box>
      </Box>
    </Layout>
  );
}
