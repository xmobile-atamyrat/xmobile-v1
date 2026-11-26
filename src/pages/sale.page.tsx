import ProductGridContent from '@/pages/components/ProductGridContent';
import {
  BUSINESS_NAME,
  DEFAULT_LOCALE,
  LOCALE_TO_OG_LOCALE,
} from '@/pages/lib/constants';
import { generateHreflangLinks, getCanonicalUrl } from '@/pages/lib/seo';
import { PageSeoData } from '@/pages/lib/types';
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const locale = context.locale ?? DEFAULT_LOCALE;
  const messages = (await import(`../i18n/${locale}.json`)).default;

  const title = messages.salePageTitle.replace('{businessName}', BUSINESS_NAME);
  const description = messages.salePageDescription.replace(
    '{businessName}',
    BUSINESS_NAME,
  );
  const seoData: PageSeoData = {
    title,
    description,
    canonicalUrl: getCanonicalUrl(locale, 'sale'),
    hreflangLinks: generateHreflangLinks('sale'),
    ogTitle: title,
    ogDescription: description,
    ogLocale:
      LOCALE_TO_OG_LOCALE[locale as keyof typeof LOCALE_TO_OG_LOCALE] ||
      'ru_RU',
    // Filtered and searched variants stay out of the index, like /product's.
    noIndex: Object.keys(context.query).length > 0,
  };

  return { props: { messages, seoData } };
};

export default function Sale() {
  return <ProductGridContent saleOnly />;
}
