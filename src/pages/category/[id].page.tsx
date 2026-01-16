import BASE_URL from '@/lib/ApiEndpoints';
import CategoryCard from '@/pages/components/CategoryCard';
import Layout from '@/pages/components/Layout';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  buildCategoryPath,
  findParentCategory,
} from '@/pages/lib/categoryPathUtils';
import { ALL_PRODUCTS_CATEGORY_CARD } from '@/pages/lib/constants';
import { useLocale } from '@/pages/lib/hooks/useLocale';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { homePageClasses } from '@/styles/classMaps';
import { categoryIdClasses } from '@/styles/classMaps/category/id';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

// Helper function to extract all category IDs recursively
function extractCategoryIds(categories: ExtendedCategory[]): string[] {
  const ids: string[] = [];
  function traverse(cats: ExtendedCategory[]) {
    cats.forEach((cat) => {
      ids.push(cat.id);
      if (cat.successorCategories && cat.successorCategories.length > 0) {
        traverse(cat.successorCategories);
      }
    });
  }
  traverse(categories);
  return ids;
}

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    // Fetch all categories using the existing API
    const { success, data }: ResponseApi<ExtendedCategory[]> = await (
      await fetch(`${BASE_URL}/api/category`)
    ).json();

    if (!success || !data) {
      return {
        paths: [],
        fallback: 'blocking',
      };
    }

    // Extract all category IDs recursively
    const categoryIds = extractCategoryIds(data);

    const paths = categoryIds.map((id) => ({
      params: { id },
    }));

    return {
      paths,
      fallback: 'blocking',
    };
  } catch (error) {
    console.error('Error fetching categories for static generation:', error);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const categoryId = params?.id as string;

  try {
    // Fetch the specific category
    const { success, data: categoryData }: ResponseApi<ExtendedCategory> =
      await (
        await fetch(`${BASE_URL}/api/category?categoryId=${categoryId}`)
      ).json();

    if (!success || !categoryData) {
      return {
        notFound: true,
      };
    }

    // Fetch all categories to find parent
    const {
      success: allSuccess,
      data: allCategories,
    }: ResponseApi<ExtendedCategory[]> = await (
      await fetch(`${BASE_URL}/api/category`)
    ).json();

    let parentCategory: ExtendedCategory | null = null;
    let categoryPath: ExtendedCategory[] = [];
    if (allSuccess && allCategories) {
      parentCategory = findParentCategory(categoryId, allCategories);
      categoryPath = buildCategoryPath(categoryId, allCategories);
    }

    // For static export, we can't rely on context.locale (Next.js i18n)
    // Load default locale messages at build time
    // Client-side will switch locale based on cookie
    const defaultLocale = 'ru';
    let messages = {};
    try {
      messages = (await import(`../../i18n/${defaultLocale}.json`)).default;
    } catch (error) {
      console.error('Error loading messages:', error);
    }

    return {
      props: {
        category: categoryData,
        parentCategory,
        categoryPath,
        messages,
        // Also load all locale messages so client can switch without page reload
        allMessages: {
          en: (await import('../../i18n/en.json')).default,
          ru: (await import('../../i18n/ru.json')).default,
          tk: (await import('../../i18n/tk.json')).default,
          ch: (await import('../../i18n/ch.json')).default,
          tr: (await import('../../i18n/tr.json')).default,
        },
      },
      revalidate: 300, // regenerate static pages every 5 minutes
    };
  } catch (error) {
    console.error('Error fetching category during build:', error);
    return {
      notFound: true,
    };
  }
};

interface CategoryPageProps {
  category: ExtendedCategory;
  parentCategory: ExtendedCategory | null;
  categoryPath: ExtendedCategory[];
}

export default function CategoryPage({
  category,
  parentCategory,
  categoryPath,
}: CategoryPageProps) {
  const router = useRouter();
  const locale = useLocale();
  const platform = usePlatform();
  const { setSelectedCategoryId } = useCategoryContext();
  const { setProducts } = useProductContext();

  // Update selected category ID in context for drawer highlighting
  useEffect(() => {
    setSelectedCategoryId(category.id);
  }, [category.id, setSelectedCategoryId]);

  // Redirect to products if no subcategories
  useEffect(() => {
    if (
      !category.successorCategories ||
      category.successorCategories.length === 0
    ) {
      setProducts([]);
      router.replace(`/product?categoryId=${category.id}`);
    }
  }, [category, router, setProducts]);

  const handleHeaderBackButton = () => {
    if (parentCategory) {
      router.push(`/category/${parentCategory.id}`);
    } else {
      router.push('/');
    }
  };

  // If no subcategories, show loading while redirecting
  if (
    !category.successorCategories ||
    category.successorCategories.length === 0
  ) {
    return (
      <Layout handleHeaderBackButton={handleHeaderBackButton}>
        <Box className="flex justify-center items-center h-64">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={handleHeaderBackButton}>
      <Box className={categoryIdClasses.boxes.main[platform]}>
        <SimpleBreadcrumbs categoryPath={categoryPath} />
        <Box className={categoryIdClasses.boxes.header[platform]}>
          <IconButton
            size="medium"
            edge="start"
            color="inherit"
            className={appbarClasses.backButton[platform]}
            aria-label="open drawer"
            onClick={handleHeaderBackButton}
          >
            <ArrowBackIosIcon
              className={appbarClasses.arrowBackIos[platform]}
            />
          </IconButton>
          <Box className="flex w-full justify-center">
            {category && (
              <Typography
                className={`${interClassname.className} ${homePageClasses.categoriesText[platform]}`}
              >
                {parseName(category.name, locale)}
              </Typography>
            )}
          </Box>
        </Box>
        <Box className={homePageClasses.card[platform]}>
          {/* All Products card - show in every category */}
          <CategoryCard
            id=""
            name=""
            initialImgUrl={ALL_PRODUCTS_CATEGORY_CARD}
            onClick={() => {
              setProducts([]);
              router.push(`/product?categoryId=${category.id}`);
            }}
          />
          {/* Subcategories */}
          {category.successorCategories.map((subCategory) => {
            const { imgUrl, name, id } = subCategory;
            return (
              <CategoryCard
                id={id}
                name={name}
                initialImgUrl={imgUrl ?? undefined}
                key={id}
                onClick={() => {
                  router.push(`/category/${id}`);
                }}
              />
            );
          })}
        </Box>
      </Box>
    </Layout>
  );
}
