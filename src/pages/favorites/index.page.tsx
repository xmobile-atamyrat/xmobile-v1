import ActiveFilterChips from '@/pages/components/ActiveFilterChips';
import FilterSheet from '@/pages/components/FilterSheet';
import FilterSidebar from '@/pages/components/FilterSidebar';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { ProductGridSkeleton } from '@/pages/components/SkeletonLoader';
import SortDropdown from '@/pages/components/SortDropdown';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  BUSINESS_NAME,
  DEFAULT_LOCALE,
  LOCALE_TO_OG_LOCALE,
} from '@/pages/lib/constants';
import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import {
  FavoriteProduct,
  filterAndSortFavorites,
} from '@/pages/lib/favoritesFilter';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useProductFilters } from '@/pages/lib/hooks/useProductFilters';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { generateHreflangLinks, getCanonicalUrl } from '@/pages/lib/seo';
import { PageSeoData } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AccountNav from '@/pages/user/components/AccountNav';
import { homePageClasses } from '@/styles/classMaps';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { buttonClasses } from '@/styles/classMaps/components/button';
import { favoriteButtonClasses } from '@/styles/classMaps/components/favoriteButton';
import { favoritesClasses } from '@/styles/classMaps/favorites';
import { ordersIndexClasses } from '@/styles/classMaps/orders';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { startTransition, useEffect, useState } from 'react';

export const getStaticProps = (async (context) => {
  const locale = context.locale ?? DEFAULT_LOCALE;
  const messages = (await import(`../../i18n/${context.locale}.json`)).default;
  const title = `${messages.favorites} | ${BUSINESS_NAME}`;
  const seoData: PageSeoData = {
    title,
    description: title,
    canonicalUrl: getCanonicalUrl(locale, 'favorites'),
    hreflangLinks: generateHreflangLinks('favorites'),
    ogTitle: title,
    ogDescription: title,
    ogLocale:
      LOCALE_TO_OG_LOCALE[locale as keyof typeof LOCALE_TO_OG_LOCALE] ||
      'ru_RU',
    // Crawlers are signed out, so all they would ever index is the sign-in
    // notice. Not in robots.txt: a blocked page can't show them this tag.
    noIndex: true,
  };
  return { props: { messages, seoData } };
}) satisfies GetStaticProps<object>;

export default function FavoritesPage() {
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();
  const { user, accessToken, isLoading } = useUserContext();
  const { isFavorite, addFavorites } = useFavoritesContext();
  const fetchWithCreds = useFetchWithCreds();
  const { categories } = useCategoryContext();
  const { filters, setFilters } = useProductFilters();
  const [products, setProducts] = useState<FavoriteProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  // Removed cards still shrinking away, which the context has already dropped.
  const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(new Set());
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const userId = user?.id;

  const setLeaving = (productId: string, leaving: boolean) => {
    setLeavingIds((prev) => {
      const next = new Set(prev);
      if (leaving) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const { success, data, message } = await fetchWithCreds<
          FavoriteProduct[]
        >({
          accessToken,
          path: `/api/favorites?locale=${router.locale}`,
          method: 'GET',
        });
        if (!success) throw new Error(message);
        if (cancelled) return;
        // Together, or the cards render before the context knows their ids and
        // the empty notice flashes.
        startTransition(() => {
          addFavorites(data.map(({ id }) => id));
          setProducts(data);
          setStatus('ready');
        });
      } catch (error) {
        console.error('Failed to load favorites:', error);
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // A refreshed access token is the same user, so it must not reload the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, router.locale]);

  const notice = (text: string, action?: [string, string]) => (
    <Box className={ordersIndexClasses.emptyState[platform]}>
      <Typography
        className={`${fontClassName.className} ${ordersIndexClasses.emptyStateText[platform]}`}
      >
        {text}
      </Typography>
      {action && (
        <Box className="mt-5 mx-auto max-w-[280px]">
          <ButtonBase
            disableRipple
            onClick={() => router.push(action[1])}
            className={`${fontClassName.className} ${buttonClasses.primary[platform]}`}
          >
            {action[0]}
          </ButtonBase>
        </Box>
      )}
    </Box>
  );

  // Filtered through the context so removing a heart here drops the card once
  // it has shrunk away, and a save that fails brings it back.
  const favorites = products.filter(
    ({ id }) => isFavorite(id) || leavingIds.has(id),
  );
  const canFilter =
    !isLoading && user != null && status === 'ready' && favorites.length > 0;

  const renderCards = () => {
    const visible = filterAndSortFavorites(
      favorites,
      filters,
      categories,
      router.locale ?? DEFAULT_LOCALE,
    );
    if (visible.length === 0) {
      return (
        <Box className={productIndexPageClasses.emptyState.wrap}>
          <Box className={productIndexPageClasses.emptyState.iconWrap}>
            <SearchX size={28} color="#8B8A98" />
          </Box>
          <Typography
            className={`${fontClassName.className} ${productIndexPageClasses.emptyState.title}`}
          >
            {t('noProductsFound')}
          </Typography>
        </Box>
      );
    }
    return (
      <Box
        className={
          platform === 'web'
            ? productIndexPageClasses.boxes.productsGrid.web
            : homePageClasses.newProductsBox.mobile
        }
      >
        {visible.map((product) => (
          <Box
            key={product.id}
            className={`${favoriteButtonClasses.cardSlot} ${
              leavingIds.has(product.id)
                ? favoriteButtonClasses.cardLeaving
                : ''
            }`}
            onAnimationEnd={(e) => {
              // The heart's own animation bubbles up to here.
              if (e.target === e.currentTarget) setLeaving(product.id, false);
            }}
          >
            <ProductCard
              product={product}
              cartProps={{ cartAction: 'add' }}
              onFavoriteRemove={() => setLeaving(product.id, true)}
            />
          </Box>
        ))}
      </Box>
    );
  };

  const renderContent = () => {
    if (isLoading || (user != null && status === 'loading')) {
      return <ProductGridSkeleton count={8} />;
    }
    if (user == null) {
      return notice(t('favoritesSignIn'), [t('signin'), '/user/signin']);
    }
    if (status === 'failed') return notice(t('favoritesLoadError'));
    if (favorites.length === 0) {
      return notice(t('favoritesEmpty'), [t('startShopping'), '/product']);
    }
    if (platform !== 'web') return renderCards();
    return (
      <Box className={productIndexPageClasses.boxes.layout.web}>
        <FilterSidebar
          categories={categories}
          selectedCategoryIds={filters.categoryIds}
          selectedBrandIds={filters.brandIds}
          selectedColorIds={filters.colorIds}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          inStock={filters.inStock}
          onFilterChange={setFilters}
        />
        <Box className="flex flex-col w-full min-w-0">
          <Box className={productIndexPageClasses.resultsBar.web}>
            <ActiveFilterChips filters={filters} onChange={setFilters} />
            <SortDropdown
              value={filters.sortBy}
              onChange={(sortBy) => setFilters({ sortBy })}
            />
          </Box>
          {renderCards()}
        </Box>
      </Box>
    );
  };

  if (platform === 'web') {
    return (
      <Layout>
        <Box className={favoritesClasses.grid}>
          <AccountNav active="favorites" />
          <Box className={ordersIndexClasses.web.col}>
            <Box className={ordersIndexClasses.web.headRow}>
              <Typography
                className={`${fontClassName.className} ${ordersIndexClasses.web.title}`}
              >
                {t('favorites')}
              </Typography>
            </Box>
            {renderContent()}
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <FilterSheet
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />
      <Box className={ordersIndexClasses.container.mobile}>
        <Box
          className={`${ordersIndexClasses.headerWrap.mobile} ${favoritesClasses.mobileHeader}`}
        >
          <Typography
            className={`${fontClassName.className} ${ordersIndexClasses.title.mobile}`}
          >
            {t('favorites')}
          </Typography>
          {canFilter && (
            <button
              className={appbarClasses.filterButton.mobile}
              onClick={() => setMobileFilterOpen(true)}
              type="button"
              aria-label={t('filters')}
            >
              <SlidersHorizontal size={20} />
            </button>
          )}
        </Box>
        <Box className={ordersIndexClasses.content.mobile}>
          {renderContent()}
        </Box>
      </Box>
    </Layout>
  );
}
