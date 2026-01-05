import dbClient from '@/lib/dbClient';
import { SearchBar } from '@/pages/components/Appbar';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { fetchNewProducts } from '@/pages/lib/apis';
import {
  LOCALE_COOKIE_NAME,
  POST_SOVIET_COUNTRIES,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { getCookie } from '@/pages/lib/utils';
import { homePageClasses } from '@/styles/classMaps';
import { interClassname } from '@/styles/theme';
import { Box, CardMedia, CircularProgress, Typography } from '@mui/material';
import { Product } from '@prisma/client';
import cookie, { serialize } from 'cookie';
import geoip from 'geoip-lite';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00.000

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999); // Set to 23:59:59.999
      const visitedToday = await dbClient.userVisitRecord.findFirst({
        where: {
          ip,
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      });
      if (!visitedToday) {
        await dbClient.userVisitRecord.create({
          data: {
            ip,
          },
        });
      } else {
        await dbClient.userVisitRecord.update({
          where: {
            id: visitedToday.id,
          },
          data: {
            dailyVisitCount: visitedToday.dailyVisitCount + 1,
          },
        });
      }
    } catch (error) {
      console.error(error);
    }

    try {
      if (locale == null) {
        const geo = geoip.lookup(ip || '');
        if (geo) {
          const { country } = geo;
          if (country === 'TR') {
            locale = 'tr';
          } else if (POST_SOVIET_COUNTRIES.includes(country)) {
            locale = 'ru';
          }
        }
        if (locale != null) {
          context.res.setHeader(
            'Set-Cookie',
            serialize(LOCALE_COOKIE_NAME, locale, {
              // session cookie, expires when the browser is closed
              secure: process.env.NODE_ENV === 'production', // Use secure flag in production
              path: '/',
            }),
          );
        }
      }

      messages = (await import(`../i18n/${context.locale}.json`)).default;
    } catch (error) {
      console.error(error);
    }
  }
  return {
    props: {
      locale,
      messages,
    },
  };
}) satisfies GetServerSideProps<{
  locale: string | null;
}>;

export default function Home({
  locale,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const platform = usePlatform();
  const t = useTranslations();
  const { searchKeyword, setSearchKeyword } = useProductContext();
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newPage, setNewPage] = useState(1);
  const [newHasMore, setHasNewMore] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const fetched = await fetchNewProducts({
          page: 1,
          searchKeyword: searchKeyword || undefined,
        });
        if (!mounted) return;
        setNewProducts(fetched);
        setNewPage(2);
        setHasNewMore(fetched.length >= 20);
      } catch (error) {
        console.error('Error fetching new products:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [searchKeyword]);

  useEffect(() => {
    const loadMoreTrigger = document.getElementById('load-more-products');
    if (!loadMoreTrigger) return () => undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (async () => {
              if (isLoading || !newHasMore) return;
              setIsLoading(true);
              try {
                const fetched = await fetchNewProducts({
                  page: newPage,
                  searchKeyword: searchKeyword || undefined,
                });
                if (fetched.length < 20) {
                  setHasNewMore(false);
                } else {
                  setNewProducts((prev) => [...prev, ...fetched]);
                }
                setNewPage(newPage + 1);
              } catch (error) {
                console.error('Error fetching more products:', error);
              } finally {
                setIsLoading(false);
              }
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
  });

  useEffect(() => {
    if (locale == null || router.locale === locale) return;
    router.push(router.pathname, router.asPath, {
      locale: locale || getCookie(LOCALE_COOKIE_NAME),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <Layout>
      <Box className={homePageClasses.newProductsMobileAppbar[platform]}>
        <Box className={homePageClasses.topLayer}>
          <CardMedia
            component="img"
            src="/xmobile-processed-logo.png"
            className="w-auto h-[40px]"
          />
          <Box className="w-[36px] h-[36px] rounded-full bg-[#f5f5f5] justify-center items-center flex">
            <CardMedia
              component="img"
              src="/bell.png"
              className="w-[20px] h-[20px]"
            />
          </Box>
        </Box>
        {SearchBar({
          searchKeyword,
          searchPlaceholder: t('search'),
          setSearchKeyword,
          width: '100%',
        })}
      </Box>
      <Box className={homePageClasses.main[platform]}>
        {!searchKeyword && (
          <Typography
            className={`${interClassname.className} ${homePageClasses.newProductsTitle[platform]}`}
          >
            {t('newProducts')}
          </Typography>
        )}
        {isLoading && (
          <Box className="flex justify-center items-center h-64">
            <CircularProgress />
          </Box>
        )}
        <Box className={homePageClasses.newProductsBox[platform]}>
          {newProducts.length > 0 &&
            newProducts.map((product, idx) => (
              <ProductCard
                product={product}
                key={idx}
                cartProps={{ cartAction: 'add' }}
              />
            ))}
        </Box>
        {newProducts.length === 0 && (
          <Typography>{t('noProductsFound')}</Typography>
        )}
      </Box>
      <div id="load-more-products" />
    </Layout>
  );
}
