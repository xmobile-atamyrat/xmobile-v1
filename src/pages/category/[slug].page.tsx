import BASE_URL from '@/lib/ApiEndpoints';
import CategoryCard from '@/pages/components/CategoryCard';
import Layout from '@/pages/components/Layout';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  buildCategoryPath,
  findParentCategory,
} from '@/pages/lib/categoryPathUtils';
import {
  ALL_PRODUCTS_CATEGORY_CARD,
  LOCALE_TO_OG_LOCALE,
} from '@/pages/lib/constants';
import { expandDynamicPathsForAllLocales } from '@/pages/lib/ssgLocales';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  generateBreadcrumbJsonLd,
  generateCategoryMetaDescription,
  generateCategoryTitle,
  generateHreflangLinks,
  getCanonicalUrl,
} from '@/pages/lib/seo';
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

// Helper function to extract all category slugs recursively
function extractCategorySlugs(categories: ExtendedCategory[]): string[] {
  const slugs: string[] = [];
  function traverse(cats: ExtendedCategory[]) {
    cats.forEach((cat) => {
      slugs.push(cat.slug);
      if (cat.successorCategories && cat.successorCategories.length > 0) {
        traverse(cat.successorCategories);
      }
    });
  }
  traverse(categories);
  return slugs;
}

export const getStaticPaths: GetStaticPaths = async (context) => {
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

    // Extract all category slugs recursively
    const categorySlugs = extractCategorySlugs(data);

    const paths = expandDynamicPathsForAllLocales(context, categorySlugs);

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

export const getStaticProps: GetStaticProps = async ({
  params,
  locale = 'tk',
}) => {
  const categorySlug = params?.slug as string;

  try {
    // Fetch the specific category
    const { success, data: categoryData }: ResponseApi<ExtendedCategory> =
      await (
        await fetch(`${BASE_URL}/api/category?categorySlug=${categorySlug}`)
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
    if (allSuccess && allCategories && categoryData) {
      parentCategory = findParentCategory(categoryData.id, allCategories);
      categoryPath = buildCategoryPath(categoryData.id, allCategories);
    }

    // Load messages first so they can be used for SEO generation
    let messages;
    try {
      messages = (await import(`../../i18n/${locale}.json`)).default;
    } catch (messageError) {
      console.error(
        `Error loading messages for locale ${locale}:`,
        messageError,
      );
    }

    // Generate SEO Data
    let seoData = null;
    if (categoryData) {
      const categoryName = parseName(categoryData.name, locale);
      const title = generateCategoryTitle(
        categoryPath,
        messages?.seoLocationSuffix || '',
        locale,
      );
      const description = generateCategoryMetaDescription(
        messages?.categoryDetailsMetaDescription || '',
        categoryName,
      );
      const canonicalUrl = getCanonicalUrl(
        locale,
        `category/${categoryData.slug}`,
      );
      const hreflangLinks = generateHreflangLinks(
        `category/${categoryData.slug}`,
      );

      let ogImage = categoryData.imgUrl;
      if (ogImage && !ogImage.startsWith('http')) {
        ogImage = `${BASE_URL}/api/localImage?imgUrl=${encodeURIComponent(ogImage)}`;
      }

      const breadcrumbJsonLd = generateBreadcrumbJsonLd(
        categoryPath,
        undefined, // no productName for category page
        locale,
        messages?.home as string,
      );

      seoData = {
        title,
        description,
        canonicalUrl,
        hreflangLinks,
        ogLocale:
          LOCALE_TO_OG_LOCALE[locale as keyof typeof LOCALE_TO_OG_LOCALE] ||
          'ru_RU',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogImage,
        breadcrumbJsonLd,
      };
    }

    return {
      props: {
        category: categoryData,
        parentCategory,
        categoryPath,
        messages,
        seoData,
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
      router.push(`/category/${parentCategory.slug}`);
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
                {parseName(category.name, router.locale ?? 'ru')}
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
            const { imgUrl, name, id, slug } = subCategory;
            return (
              <CategoryCard
                id={id}
                name={name}
                initialImgUrl={imgUrl ?? undefined}
                key={id}
                onClick={() => {
                  router.push(`/category/${slug}`);
                }}
              />
            );
          })}
        </Box>
      </Box>
    </Layout>
  );
}
