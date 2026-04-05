import BASE_URL from '@/lib/ApiEndpoints';
import CategoryCard from '@/pages/components/CategoryCard';
import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { generateHreflangLinks, getCanonicalUrl } from '@/pages/lib/seo';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { categoryPageClasses } from '@/styles/classMaps/category';
import { interClassname } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const locale = context.locale || 'ru';
  const messages = (await import(`../../i18n/${locale}.json`)).default;
  const title = messages?.categoryIndexTitle;
  const description = messages?.categoryIndexDescription;

  const seoData = {
    title,
    description,
    canonicalUrl: getCanonicalUrl(locale, 'category'),
    hreflangLinks: generateHreflangLinks('category'),
    ogTitle: title,
    ogDescription: description,
    ogLocale: locale,
    ogType: 'website',
  };

  return {
    props: {
      messages,
      seoData,
    },
  };
};

export default function CategoriesPage() {
  const router = useRouter();
  const platform = usePlatform();
  const { categories: allCategories, setCategories } = useCategoryContext();
  const { setProducts } = useProductContext();
  const t = useTranslations();

  // Context only loads once on app boot; refetch here so /category shows current order.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { success, data, message }: ResponseApi<ExtendedCategory[]> =
          await (await fetch(`${BASE_URL}/api/category`)).json();
        if (cancelled) return;
        if (success && data != null) {
          setCategories(data);
        } else {
          console.error(message);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCategories]);

  return (
    <Layout>
      <Box className={categoryPageClasses.main[platform]}>
        <Box className="w-full flex-col px-[24px] my-[36px]">
          <Typography
            className={`${interClassname.className} ${categoryPageClasses.categoriesText[platform]}`}
          >
            {t('categories')}
          </Typography>
        </Box>
        <Box className={categoryPageClasses.card[platform]}>
          {allCategories?.map((category) => {
            const { imgUrl, name, id, successorCategories } = category;
            return (
              <CategoryCard
                id={id}
                name={name}
                initialImgUrl={imgUrl ?? undefined}
                key={id}
                onClick={() => {
                  // Navigate to category page or products
                  if (
                    successorCategories == null ||
                    successorCategories.length === 0
                  ) {
                    setProducts([]);
                    router.push(`/product?categoryId=${id}`);
                  } else {
                    router.push(`/category/${id}`);
                  }
                }}
              />
            );
          })}
        </Box>
      </Box>
    </Layout>
  );
}
