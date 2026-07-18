import FilterSidebar from '@/pages/components/FilterSidebar';
import Layout from '@/pages/components/Layout';
import PopularCategoriesSection from '@/pages/components/PopularCategoriesSection';
import ProductCard from '@/pages/components/ProductCard';
import PromoBannerSection from '@/pages/components/PromoBannerSection';
import SortDropdown from '@/pages/components/SortDropdown';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  BUSINESS_NAME,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_TO_OG_LOCALE,
  POST_SOVIET_COUNTRIES,
} from '@/pages/lib/constants';
import { useProductFilters } from '@/pages/lib/hooks/useProductFilters';
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
import { filterSidebarClasses } from '@/styles/classMaps/components/filterSidebar';
import { fontClassName } from '@/styles/theme';
import { ProductGridSkeleton } from '@/pages/components/SkeletonLoader';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Slide,
  Typography,
} from '@mui/material';
import { X } from 'lucide-react';
import { TransitionProps } from '@mui/material/transitions';
import { Product } from '@prisma/client';
import cookie, { serialize } from 'cookie';
import geoip from 'geoip-lite';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

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
  const { searchKeyword } = useProductContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [localFilters, setLocalFilters] = useState({
    categoryIds: [] as string[],
    brandIds: [] as string[],
    minPrice: '',
    maxPrice: '',
    sortBy: '',
  });

  const { filters, setFilters } = useProductFilters();

  useEffect(() => {
    if (mobileFilterOpen) {
      setLocalFilters({
        categoryIds: filters.categoryIds,
        brandIds: filters.brandIds,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sortBy: filters.sortBy,
      });
    }
  }, [mobileFilterOpen, filters]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const fetched = await fetchProducts({
          page,
          searchKeyword: searchKeyword || undefined,
          categoryIds: filters.categoryIds,
          brandIds: filters.brandIds,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sortBy: filters.sortBy,
        });
        if (!mounted) return;

        if (fetched.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (page === 1) {
          setProducts(fetched);
        } else {
          setProducts((prev) => [...prev, ...fetched]);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [searchKeyword, filters, page]);

  useEffect(() => {
    const loadMoreTrigger = document.getElementById('load-more-products');
    if (!loadMoreTrigger) return () => undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (async () => {
              if (isLoading || !hasMore) return;
              setPage((prev) => prev + 1);
            })();
          }
        });
      },
      { rootMargin: '100px' },
    );

    observer.observe(loadMoreTrigger);
    return () => {
      observer.disconnect();
    };
  }, [isLoading, hasMore]);

  useEffect(() => {
    if (locale == null || router.locale === locale) return;
    router.push(router.pathname, router.asPath, { locale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <Layout showHomeHeader onHomeFilterClick={() => setMobileFilterOpen(true)}>
      <Box className={homePageClasses.newProductsMobileAppbar[platform]}>
        {platform === 'mobile' && !searchKeyword && (
          <PromoBannerSection banners={banners} />
        )}
        {platform === 'mobile' && !searchKeyword && (
          <PopularCategoriesSection categories={categories} />
        )}
      </Box>
      {platform === 'web' && !searchKeyword && (
        <PromoBannerSection banners={banners} />
      )}
      <Box className="flex flex-row gap-6 w-full">
        {platform === 'web' && (
          <FilterSidebar
            categories={categories}
            selectedCategoryIds={filters.categoryIds}
            selectedBrandIds={filters.brandIds}
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              setPage(1);
              setProducts([]);
            }}
          />
        )}

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
                {searchKeyword
                  ? t('searchResultsFor', { keyword: searchKeyword })
                  : t('newProducts')}
              </Typography>
              {platform === 'web' && (
                <SortDropdown
                  value={filters.sortBy}
                  onChange={(val) => {
                    setFilters({ sortBy: val });
                    setPage(1);
                    setProducts([]);
                  }}
                />
              )}
            </Box>

            {isLoading && page === 1 && <ProductGridSkeleton count={8} />}
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
            {isLoading && page > 1 && (
              <Box className="flex justify-center items-center py-4">
                <CircularProgress />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      <div id="load-more-products" />
      <Dialog
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        TransitionComponent={SlideTransition}
        fullWidth
        PaperProps={{
          sx: {
            position: 'fixed',
            bottom: 0,
            m: 0,
            width: '100%',
            maxHeight: '88vh',
            borderRadius: '26px 26px 0 0',
          },
        }}
      >
        <Box className="flex flex-col bg-white">
          <Box className={filterSidebarClasses.dragHandle} />
          <Box className={filterSidebarClasses.header}>
            <Typography
              className={`${fontClassName.className} ${filterSidebarClasses.title}`}
            >
              {t('filter') || 'Filter'}
            </Typography>
            <IconButton
              size="small"
              className={filterSidebarClasses.closeButton}
              onClick={() => setMobileFilterOpen(false)}
            >
              <X size={20} />
            </IconButton>
          </Box>
          <Box className={filterSidebarClasses.body}>
            <FilterSidebar
              variant="mobile"
              categories={categories}
              selectedCategoryIds={localFilters.categoryIds}
              selectedBrandIds={localFilters.brandIds}
              minPrice={localFilters.minPrice}
              maxPrice={localFilters.maxPrice}
              sortBy={localFilters.sortBy}
              onFilterChange={(newFilters) => {
                setLocalFilters((prev) => ({ ...prev, ...newFilters }));
              }}
            />
          </Box>
          <Box className={filterSidebarClasses.footer}>
            <Button
              fullWidth
              disableElevation
              className={`${fontClassName.className} ${filterSidebarClasses.applyButton}`}
              onClick={() => {
                setFilters(localFilters);
                setPage(1);
                setProducts([]);
                setMobileFilterOpen(false);
              }}
            >
              {t('apply') || 'Apply'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Layout>
  );
}
