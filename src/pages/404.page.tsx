import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { notFoundClasses } from '@/styles/classMaps/not-found.page';
import { img, fontClassName, muted } from '@/styles/theme';
import { Box, Button, CardMedia, InputBase, Typography } from '@mui/material';
import { Compass, Search } from 'lucide-react';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useState } from 'react';

/**
 * Recovery pills on the web 404 — the mockup (:2224) shows four. Real category
 * names are long enough ("Аккумуляторные Батареи для телефонов") that the row
 * still wraps; `flex-wrap` centres each line rather than overflowing.
 */
const MAX_PILLS = 4;

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Custom404() {
  const platform = usePlatform();
  const router = useRouter();
  const t = useTranslations();
  const { categories, setSelectedCategoryId } = useCategoryContext();
  const { setSearchKeyword, setProducts } = useProductContext();
  const [keyword, setKeyword] = useState('');
  const button = {
    web: 'homepage',
    mobile: 'startShopping',
  };

  const handleHome = () => {
    router.push('/');
  };

  // The mockup's pills are hardcoded (Phones / Laptops / Audio / Flash deals);
  // ours are the real root categories an admin flagged `popular`, falling back
  // to plain root categories so the row is never empty on a seeded DB.
  const rootCategories = categories.filter(
    (category) => category.predecessorId == null && category.deletedAt == null,
  );
  const popular = rootCategories.filter((category) => category.popular);
  const pillCategories = (popular.length > 0 ? popular : rootCategories).slice(
    0,
    MAX_PILLS,
  );

  // Same branch Appbar.tsx uses: leaf categories go straight to the product
  // listing, parents open the sub-category page.
  const goToCategory = (category: ExtendedCategory) => {
    setProducts([]);
    setSelectedCategoryId(category.id);
    if (
      category.successorCategories == null ||
      category.successorCategories.length === 0
    ) {
      router.push(`/product-category/${category.slug}`);
    } else {
      router.push(`/category/${category.slug}`);
    }
  };

  // Mirrors the web header's search: seed the shared keyword, then land on the
  // product listing that reads it.
  const runSearch = () => {
    const query = keyword.trim();
    if (!query) return;
    setSearchKeyword(query);
    router.push('/product');
  };

  return (
    <Layout handleHeaderBackButton={() => router.back()}>
      <Box className={notFoundClasses.container[platform]}>
        {platform === 'web' && (
          <span
            aria-hidden
            className={`${notFoundClasses.ghost} ${fontClassName.className}`}
          >
            404
          </span>
        )}
        <Box className={notFoundClasses.content[platform]}>
          <CardMedia
            component="img"
            src={img.not_found[platform]}
            className={notFoundClasses.image[platform]}
          />
          <Box className={notFoundClasses.iconTile[platform]}>
            <Compass size={40} className="text-navy" />
          </Box>
          <Typography
            className={`${fontClassName.className} ${notFoundClasses.heading[platform]}`}
          >
            {t('pageNotFound')}
          </Typography>
          <Typography
            className={`${fontClassName.className} ${notFoundClasses.subheading[platform]}`}
          >
            {t('pageNotFoundSubtitle')}
          </Typography>
          {platform === 'web' ? (
            <>
              <Box className={notFoundClasses.searchRow[platform]}>
                <Box
                  component="form"
                  className={notFoundClasses.searchField}
                  onSubmit={(event: React.FormEvent) => {
                    event.preventDefault();
                    runSearch();
                  }}
                >
                  <Search size={18} color={muted} className="flex-shrink-0" />
                  <InputBase
                    className={`${notFoundClasses.searchInput} ${fontClassName.className}`}
                    placeholder={t('search')}
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                </Box>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleHome}
                  className={`${fontClassName.className} ${notFoundClasses.button[platform]}`}
                >
                  {t(button[platform])}
                </Button>
              </Box>
              {pillCategories.length > 0 && (
                <Box className={notFoundClasses.pills[platform]}>
                  {pillCategories.map((category) => (
                    <Button
                      key={category.id}
                      disableElevation
                      onClick={() => goToCategory(category)}
                      className={`${fontClassName.className} ${notFoundClasses.pill}`}
                    >
                      {parseName(category.name, router.locale ?? 'ru')}
                    </Button>
                  ))}
                </Box>
              )}
            </>
          ) : (
            <Box className={notFoundClasses.buttonContainer[platform]}>
              <Button
                variant="contained"
                disableElevation
                onClick={handleHome}
                className={`${fontClassName.className} ${notFoundClasses.button[platform]}`}
              >
                {t(button[platform])}
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Layout>
  );
}
