import CategoryCard from '@/pages/components/CategoryCard';
import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { generateHreflangLinks, getCanonicalUrl } from '@/pages/lib/seo';
import { categoryPageClasses } from '@/styles/classMaps/category';
import { interClassname } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const locale = context.locale || 'ru';

  const messages = (await import(`../../i18n/${context.locale}.json`)).default;

  const title = messages?.categoryIndexTitle || 'Categories | X-Mobile';
  const description =
    messages?.categoryIndexDescription || 'All product categories at X-Mobile.';

  const seoData = {
    title,
    description,
    canonicalUrl: getCanonicalUrl(locale, 'category'),
    hreflangLinks: generateHreflangLinks('category'),
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
  const { categories: allCategories } = useCategoryContext();
  const { setProducts } = useProductContext();
  const t = useTranslations();

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
