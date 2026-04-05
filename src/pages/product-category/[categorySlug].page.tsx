import BASE_URL from '@/lib/ApiEndpoints';
import ProductGridContent from '@/pages/components/ProductGridContent';
import { buildCategoryPath } from '@/pages/lib/categoryPathUtils';
import { LOCALE_TO_OG_LOCALE } from '@/pages/lib/constants';
import {
  generateBreadcrumbJsonLd,
  generateCategoryMetaDescription,
  generateCategoryTitle,
  generateHreflangLinks,
  getCanonicalUrl,
} from '@/pages/lib/seo';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { GetStaticPaths, GetStaticProps } from 'next';

function extractCategorySlugs(categories: ExtendedCategory[]): string[] {
  const slugs: string[] = [];
  function traverse(cats: ExtendedCategory[]) {
    cats.forEach((cat) => {
      if (cat.slug) slugs.push(cat.slug);
      if (cat.successorCategories && cat.successorCategories.length > 0) {
        traverse(cat.successorCategories);
      }
    });
  }
  traverse(categories);
  return slugs;
}

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const { success, data }: ResponseApi<ExtendedCategory[]> = await (
      await fetch(`${BASE_URL}/api/category`)
    ).json();

    if (!success || !data) {
      return { paths: [], fallback: 'blocking' };
    }

    const categorySlugs = extractCategorySlugs(data);

    const paths = categorySlugs.map((categorySlug) => ({
      params: { categorySlug },
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

export const getStaticProps: GetStaticProps = async ({
  params,
  locale = 'tk',
}) => {
  const categorySlug = params?.categorySlug as string;

  try {
    const { success, data: categoryData }: ResponseApi<ExtendedCategory> =
      await (
        await fetch(`${BASE_URL}/api/category?categorySlug=${categorySlug}`)
      ).json();

    if (!success || !categoryData) {
      return { notFound: true };
    }

    const {
      success: allSuccess,
      data: allCategories,
    }: ResponseApi<ExtendedCategory[]> = await (
      await fetch(`${BASE_URL}/api/category`)
    ).json();

    let categoryPath: ExtendedCategory[] = [];
    if (allSuccess && allCategories && categoryData) {
      categoryPath = buildCategoryPath(categoryData.id, allCategories);
    }

    let messages;
    try {
      messages = (await import(`../../i18n/${locale}.json`)).default;
    } catch (messageError) {
      console.error(
        `Error loading messages for locale ${locale}:`,
        messageError,
      );
    }

    let seoData = null;
    if (categoryData) {
      const categoryName = parseName(categoryData.name, locale);
      const title = generateCategoryTitle(
        categoryPath,
        messages?.seoLocationSuffix || '',
        locale,
      );
      const description = generateCategoryMetaDescription(
        // we'll reuse the product catalogue description context
        messages?.categoryDetailsMetaDescription || '',
        categoryName,
      );
      const canonicalUrl = getCanonicalUrl(
        locale,
        `product-category/${categoryData.slug}`,
      );
      const hreflangLinks = generateHreflangLinks(
        `product-category/${categoryData.slug}`,
      );

      let ogImage = categoryData.imgUrl;
      if (ogImage && !ogImage.startsWith('http')) {
        ogImage = `${BASE_URL}/api/localImage?imgUrl=${encodeURIComponent(ogImage)}`;
      }

      const breadcrumbJsonLd = generateBreadcrumbJsonLd(
        categoryPath,
        undefined,
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
        categoryPath,
        messages,
        seoData,
      },
      revalidate: 300,
    };
  } catch (error) {
    console.error('Error fetching category during build:', error);
    return { notFound: true };
  }
};

interface ProductCategoryPageProps {
  category: ExtendedCategory;
  categoryPath: ExtendedCategory[];
}

export default function ProductCategoryPage({
  category,
  categoryPath,
}: ProductCategoryPageProps) {
  return (
    <ProductGridContent
      landingCategoryId={category?.id}
      category={category}
      categoryPath={categoryPath}
    />
  );
}
