import dbClient from '@/lib/dbClient';
import { SearchBar } from '@/pages/components/Appbar';
import CategoryCard from '@/pages/components/CategoryCard';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  ALL_PRODUCTS_CATEGORY_CARD,
  HIGHEST_LEVEL_CATEGORY_ID,
  LOCALE_COOKIE_NAME,
  POST_SOVIET_COUNTRIES,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedCategory } from '@/pages/lib/types';
import { getCookie, parseName } from '@/pages/lib/utils';
import { homePageClasses } from '@/styles/classMaps';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { Box, CardMedia, IconButton, Typography } from '@mui/material';
import { Product } from '@prisma/client';
import cookie, { serialize } from 'cookie';
import geoip from 'geoip-lite';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

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
  const {
    setSelectedCategoryId,
    selectedCategoryId,
    categories: allCategories,
    stack,
    setStack,
    parentCategory,
    setParentCategory,
  } = useCategoryContext();
  const [localCategories, setLocalCategories] = useState<ExtendedCategory[]>(
    [],
  );
  const { setProducts } = useProductContext();
  const t = useTranslations();
  const [localSearchKeyword, setLocalSearchKeyword] = useState('');
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [newPage, setNewPage] = useState(1);
  const [newHasMore, setHasNewMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const fetched = await fetchProducts({
          all: true,
          page: 1,
          searchKeyword: localSearchKeyword,
        });
        if (!mounted) return;
        setNewProducts(fetched);
        setNewPage(2);
        setHasNewMore(fetched.length >= 20); // productsPerPage = 20
      } catch (error) {
        console.error('Error fetching new products:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [localSearchKeyword]);

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
                const fetched = await fetchProducts({
                  all: true,
                  page: newPage,
                  searchKeyword: localSearchKeyword,
                });
                setNewPage(newPage + 1);
                if (fetched.length < 20) {
                  setHasNewMore(false);
                } else {
                  setNewProducts((prev) => [...prev, ...fetched]);
                  setNewPage(newPage + 1);
                }
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

  const handleHeaderBackButton = useCallback(() => {
    if (router.pathname.includes('product')) return;

    if (stack.length === 0) {
      setParentCategory(undefined);
      setLocalCategories(allCategories);
      return;
    }

    const currCat = stack.pop()?.[0];
    setStack([...stack]);
    setParentCategory(currCat);
    if (currCat != null) {
      setSelectedCategoryId(currCat.id);
      setLocalCategories(currCat.successorCategories ?? []);
    }
  }, [
    allCategories,
    setSelectedCategoryId,
    setStack,
    stack,
    router,
    setParentCategory,
  ]);

  useEffect(() => {
    if (allCategories == null || allCategories.length === 0) return;

    if (stack.length === 0) {
      setLocalCategories(allCategories);
    } else {
      const currCat = stack.pop()?.[0];
      setStack([...stack]);
      setParentCategory(currCat);
      if (currCat != null) {
        setSelectedCategoryId(currCat.id);
        setLocalCategories(currCat.successorCategories ?? []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories]);

  // Reset categories to the highest level when the `home button` or `logo` is clicked on the index page.
  useEffect(() => {
    if (selectedCategoryId === HIGHEST_LEVEL_CATEGORY_ID) {
      setLocalCategories(allCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);

  return (
    <Layout
      handleHeaderBackButton={
        stack.length === 0 && parentCategory == null
          ? undefined
          : handleHeaderBackButton
      }
    >
      <Box className={homePageClasses.category[platform]}>
        {(stack.length > 0 || parentCategory != null) && (
          <SimpleBreadcrumbs
            onClick={(combo: [ExtendedCategory, string]) => {
              setStack([...stack.slice(0, stack.indexOf(combo) + 1)]);
              handleHeaderBackButton();
            }}
          />
        )}
        {!parentCategory ? (
          <Box className="w-full flex-col px-[24px]">
            <Typography
              className={`${interClassname.className} ${homePageClasses.categoriesText[platform]}`}
            >
              {t('allCategory')}
            </Typography>
          </Box>
        ) : (
          <Box className="flex items-center w-full px-[24px] justify-between">
            <IconButton
              size="medium"
              edge="start"
              color="inherit"
              className={appbarClasses.backButton[platform]}
              aria-label="open drawer"
              onClick={() => {
                router.reload();
              }}
            >
              <ArrowBackIosIcon
                className={appbarClasses.arrowBackIos[platform]}
              />
            </IconButton>
            <Typography
              className={`${interClassname.className} ${homePageClasses.categoriesText[platform]}`}
            >
              {parseName(parentCategory.name, router.locale ?? 'ru')}
            </Typography>
            <IconButton
              size="medium"
              edge="start"
              color="inherit"
              className={`${appbarClasses.backButton[platform]} invisible`}
              aria-label="open drawer"
              onClick={() => {
                router.back();
              }}
            >
              <ArrowBackIosIcon
                className={appbarClasses.arrowBackIos[platform]}
              />
            </IconButton>
          </Box>
        )}

        <Box className={homePageClasses.card[platform]}>
          {parentCategory != null && (
            <CategoryCard
              id=""
              name=""
              initialImgUrl={ALL_PRODUCTS_CATEGORY_CARD}
              onClick={() => {
                if (parentCategory == null) return;
                setProducts([]);
                setStack((currStack) => [
                  ...currStack,
                  [parentCategory, parentCategory.name],
                ]);
                setSelectedCategoryId(parentCategory.id);
                setParentCategory(undefined);
                router.push('/product');
              }}
            />
          )}
          {localCategories?.map((category) => {
            const { imgUrl, name, id, successorCategories } = category;
            return (
              <CategoryCard
                id={id}
                name={name}
                initialImgUrl={imgUrl ?? undefined}
                key={id}
                onClick={() => {
                  if (parentCategory != null) {
                    setStack((prevStack) => [
                      ...prevStack,
                      [parentCategory, parentCategory.name],
                    ]);
                  }
                  setParentCategory(category);
                  setSelectedCategoryId(id);

                  if (
                    successorCategories == null ||
                    successorCategories.length === 0
                  ) {
                    setProducts([]);
                    router.push('/product');
                  } else {
                    setLocalCategories(successorCategories);
                  }
                }}
              />
            );
          })}
        </Box>
      </Box>
      <Box className={homePageClasses.newProducts[platform]}>
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
          searchKeyword: localSearchKeyword,
          searchPlaceholder: t('search'),
          setSearchKeyword: setLocalSearchKeyword,
          width: '100%',
        })}
        <Typography
          className={`${interClassname.className} ${homePageClasses.newProductsTitle}`}
        >
          {t('newProducts')}
        </Typography>
        {isLoading && <Typography>Loading...</Typography>}
        <Box className="grid grid-cols-2 gap-0 w-full px-[12px]">
          {newProducts.length > 0 &&
            newProducts.map((product, idx) => (
              <ProductCard
                product={product}
                key={idx}
                cartProps={{ cartAction: 'add' }}
              />
            ))}
          <div id="load-more-products" />
        </Box>
      </Box>
    </Layout>
  );
}
