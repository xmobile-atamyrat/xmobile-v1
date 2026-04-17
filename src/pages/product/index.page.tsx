import { PageSeoData } from '@/pages/lib/types';
import ProductGridContent from '@/pages/components/ProductGridContent';
import { BUSINESS_NAME, LOCALE_TO_OG_LOCALE } from '@/pages/lib/constants';
import {
  generateHreflangLinks,
  generateSearchTitle,
  getCanonicalUrl,
} from '@/pages/lib/seo';
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { searchKeyword } = context.query;
  const locale = context.locale || 'ru';

  const messages = (await import(`../../i18n/${locale}.json`)).default;

  let seoData: PageSeoData;

  // search pages
  if (searchKeyword && typeof searchKeyword === 'string') {
    const title = generateSearchTitle(messages.searchResultsFor, searchKeyword);
    // noIndex for search results to save crawl budget / prevent thin content
    seoData = {
      title,
      description: '', // Optional, or generic
      canonicalUrl: getCanonicalUrl(locale, 'product'), // Point to main product page or self
      noIndex: true,
      // Required by PageSeoData
      ogTitle: title,
      ogDescription: '',
      ogLocale:
        LOCALE_TO_OG_LOCALE[locale as keyof typeof LOCALE_TO_OG_LOCALE] ||
        'ru_RU',
      hreflangLinks: [], // search results don't need hreflang if noindex
    };
  } else {
    // fallback / default product index page
    const title = `${messages.allProducts} | ${BUSINESS_NAME}`;
    const description = messages.productIndexDescription;
    seoData = {
      title,
      description,
      canonicalUrl: getCanonicalUrl(locale, 'product'),
      hreflangLinks: generateHreflangLinks('product'),
      ogTitle: title,
      ogDescription: description,
      ogLocale:
        LOCALE_TO_OG_LOCALE[locale as keyof typeof LOCALE_TO_OG_LOCALE] ||
        'ru_RU',
    };
  }

  // If the query contains ANY parameters flag as noIndex for search and filter results.
  const queryKeys = Object.keys(context.query);
  const hasExtraFilters = queryKeys.length > 0;

  if (hasExtraFilters && seoData) {
    seoData.noIndex = true;
  }

  return {
    props: {
      messages,
      seoData,
    },
  };
};

export default function Products() {
  return <ProductGridContent />;
}
