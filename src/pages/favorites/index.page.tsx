import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { ProductGridSkeleton } from '@/pages/components/SkeletonLoader';
import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { ExtendedProduct } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AccountNav from '@/pages/user/components/AccountNav';
import { homePageClasses } from '@/styles/classMaps';
import { buttonClasses } from '@/styles/classMaps/components/button';
import { ordersIndexClasses } from '@/styles/classMaps/orders';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { startTransition, useEffect, useState } from 'react';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function FavoritesPage() {
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();
  const { user, accessToken, isLoading } = useUserContext();
  const { isFavorite, addFavorites } = useFavoritesContext();
  const fetchWithCreds = useFetchWithCreds();
  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const { success, data, message } = await fetchWithCreds<
          ExtendedProduct[]
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

  const renderContent = () => {
    if (isLoading || (user != null && status === 'loading')) {
      return <ProductGridSkeleton count={8} />;
    }
    if (user == null) {
      return notice(t('favoritesSignIn'), [t('signin'), '/user/signin']);
    }
    if (status === 'failed') return notice(t('favoritesLoadError'));

    // Filtered through the context so removing a heart here drops the card at
    // once, and a save that fails brings it back.
    const favorites = products.filter(({ id }) => isFavorite(id));
    if (favorites.length === 0) {
      return notice(t('favoritesEmpty'), [t('startShopping'), '/product']);
    }
    return (
      <Box
        className={
          platform === 'web'
            ? homePageClasses.web.productGrid
            : homePageClasses.newProductsBox.mobile
        }
      >
        {favorites.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            cartProps={{ cartAction: 'add' }}
          />
        ))}
      </Box>
    );
  };

  if (platform === 'web') {
    return (
      <Layout>
        <Box className={ordersIndexClasses.web.grid}>
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
      <Box className={ordersIndexClasses.container.mobile}>
        <Box className={ordersIndexClasses.headerWrap.mobile}>
          <Typography
            className={`${fontClassName.className} ${ordersIndexClasses.title.mobile}`}
          >
            {t('favorites')}
          </Typography>
        </Box>
        <Box className={ordersIndexClasses.content.mobile}>
          {renderContent()}
        </Box>
      </Box>
    </Layout>
  );
}
