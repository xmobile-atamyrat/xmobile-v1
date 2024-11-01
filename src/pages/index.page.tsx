import dbClient from '@/lib/dbClient';
import CategoryCard from '@/pages/components/CategoryCard';
import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  ALL_PRODUCTS_CATEGORY_CARD,
  appBarHeight,
  LOCALE_COOKIE_NAME,
  mobileAppBarHeight,
  POST_SOVIET_COUNTRIES,
} from '@/pages/lib/constants';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedCategory } from '@/pages/lib/types';
import { getCookie } from '@/pages/lib/utils';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import cookie, { serialize } from 'cookie';
import geoip from 'geoip-lite';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

// getServerSideProps because we want to fetch the categories from the server on every request
export const getServerSideProps: GetServerSideProps = (async (context) => {
  let messages = {};
  let locale: string | null = null;
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
      if (
        cookie.parse(context.req.headers.cookie ?? '')[LOCALE_COOKIE_NAME] ==
        null
      ) {
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
  // const [snackbarOpen, setSnackbarOpen] = useState(false);
  // const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  // const t = useTranslations();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const router = useRouter();
  const {
    setSelectedCategoryId,
    // selectedCategoryId,
    categories: allCategories,
    stack,
    setStack,
  } = useCategoryContext();
  const [localCategories, setLocalCategories] = useState<ExtendedCategory[]>(
    [],
  );
  const [parentCategory, setParentCategory] = useState<ExtendedCategory>();
  const { setProducts } = useProductContext();

  useEffect(() => {
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

    const currCat = stack.pop();
    setStack([...stack]);
    setParentCategory(currCat);
    if (currCat != null) {
      setSelectedCategoryId(currCat.id);
      setLocalCategories(currCat.successorCategories ?? []);
    }
  }, [allCategories, setSelectedCategoryId, setStack, stack, router]);

  useEffect(() => {
    if (allCategories == null) return;

    if (stack.length === 0) {
      setLocalCategories(allCategories);
    } else {
      const currCat = stack.pop();
      setStack([...stack]);
      setParentCategory(currCat);
      if (currCat != null) {
        setSelectedCategoryId(currCat.id);
        setLocalCategories(currCat.successorCategories ?? []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories]);

  return (
    <Layout
      handleHeaderBackButton={
        stack.length === 0 && parentCategory == null
          ? undefined
          : handleHeaderBackButton
      }
    >
      <Box
        className={`flex flex-wrap gap-4 w-full p-3 ${isMdUp ? 'justify-start' : 'justify-center'}`}
        sx={{
          mt: isMdUp ? `${appBarHeight}px` : `${mobileAppBarHeight}px`,
        }}
      >
        {stack.length > 0 && (
          <CategoryCard
            id=""
            name=""
            initialImgUrl={ALL_PRODUCTS_CATEGORY_CARD}
            onClick={() => {
              setProducts([]);
              if (parentCategory != null) {
                setStack((currStack) => [...currStack, parentCategory]);
              }
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
                  setStack((prevStack) => [...prevStack, parentCategory]);
                }
                setParentCategory(category);
                setSelectedCategoryId(id);

                if (
                  successorCategories == null ||
                  successorCategories.length === 0
                ) {
                  setProducts([]);
                  if (parentCategory != null) {
                    setStack((currStack) => [...currStack, parentCategory]);
                  }
                  router.push('/product');
                } else {
                  setLocalCategories(successorCategories);
                }
              }}
            />
          );
        })}
      </Box>
      {/* <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setSnackbarOpen(false);
        }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage?.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage?.message && t(snackbarMessage.message)}
        </Alert>
      </Snackbar> */}
    </Layout>
  );
}
