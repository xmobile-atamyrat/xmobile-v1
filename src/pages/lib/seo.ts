import BASE_URL from '@/lib/ApiEndpoints';
import {
  BUSINESS_NAME,
  localeOptions,
  META_DESC_MAX_LENGTH,
  PAGE_TITLE_MAX_LENGTH,
} from '@/pages/lib/constants';
import {
  BreadcrumbJsonLdItem,
  BreadcrumbListJsonLd,
  ExtendedCategory,
  HreflangLink,
  ProductJsonLdData,
} from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';

/**
 * Build canonical URL for a page.
 *
 * @param locale - Current locale (ru, tk, en, ch, tr)
 * @param path - Page path without leading slash, e.g., "product/123"
 * @returns Full canonical URL, e.g., "https://xmobile.com.tm/ru/product/123"
 *
 * @see {@link ../../../docs/SEO_KNOWLEDGE.md} for details on Canonical URLs.
 */
export function getCanonicalUrl(locale: string, path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${BASE_URL}/${locale}/${cleanPath}`;
}

/**
 * Generate hreflang links for all supported locales.
 *
 * @param path - Page path without locale, e.g., "product/123"
 * @param defaultLocale - Default locale for x-default fallback (usually 'ru')
 * @returns Array of hreflang link objects for all locales + x-default
 *
 * @see {@link ../../../docs/SEO_KNOWLEDGE.md} for details on Hreflang tags.
 */
export function generateHreflangLinks(
  path: string,
  defaultLocale: string = 'ru',
): HreflangLink[] {
  const links: HreflangLink[] = [];

  // Generate link for each supported locale
  localeOptions.forEach((locale) => {
    links.push({
      locale,
      url: getCanonicalUrl(locale, path),
    });
  });

  // Add x-default (fallback for unknown locales/regions),
  // shown when Google can't determine user's language preference
  links.push({
    locale: 'x-default',
    url: getCanonicalUrl(defaultLocale, path),
  });

  return links;
}

/**
 * Generate SEO-optimized product page title.
 * Format: "{Product} | {Brand} - {BusinessName}"
 *
 * @param productName - Localized product name
 * @param brandName - Localized brand name (optional)
 * @returns SEO title, truncated if too long
 *
 * @see {@link ../../../docs/SEO_KNOWLEDGE.md} for details on Product Titles.
 */
export function generateProductTitle(
  productName: string,
  brandName?: string,
): string {
  let brandSuffix = '';
  if (brandName) {
    brandSuffix = ` | ${brandName}`;
  }
  const title = `${productName}${brandSuffix} - ${BUSINESS_NAME}`;

  if (title.length > PAGE_TITLE_MAX_LENGTH) {
    const availableLength =
      PAGE_TITLE_MAX_LENGTH - brandSuffix.length - BUSINESS_NAME.length - 3; // 3 = " - " + "..."
    const truncated = productName.slice(0, availableLength);
    return `${truncated}...${brandSuffix} - ${BUSINESS_NAME}`;
  }

  return title;
}

/**
 * Generate meta description for product page.
 * Includes product name, price, and localized promotional text.
 *
 * @param template - Localized template string (e.g., "Buy {product} for {price}...")
 * @param productName - Localized product name
 * @param price - Optional product price (without currency)
 * @returns Meta description, truncated to 160 chars
 *
 * @see {@link ../../../docs/SEO_KNOWLEDGE.md} for details on Meta Descriptions.
 */
export function generateProductMetaDescription(
  template: string,
  productName: string,
  price?: string,
): string {
  const priceText = price ? `${price} TMT` : '';

  let description = template
    .replace('{product}', productName)
    .replace('{price}', priceText)
    .replace('{businessName}', BUSINESS_NAME);

  // Truncate if too long
  if (description.length > META_DESC_MAX_LENGTH) {
    description = `${description.slice(0, META_DESC_MAX_LENGTH - 3)}...`;
  }

  return description;
}

/**
 * Generate SEO-optimized category page title.
 * Format: "{Category} {ParentCategory} in Turkmenistan - {BusinessName}"
 *
 * @param categoryPath - Full path from root to current category
 * @param locationSuffix - Localized location string (e.g. "in Turkmenistan")
 * @param locale - Current locale (for parsing names)
 * @returns SEO title
 */
export function generateCategoryTitle(
  categoryPath: ExtendedCategory[],
  locationSuffix: string,
  locale: string,
): string {
  if (!categoryPath || categoryPath.length === 0) {
    return `${BUSINESS_NAME}`;
  }

  // Format: Child | Parent | Root
  // categoryPath is [Root, Parent, Child] -> Reverse it
  const names = [...categoryPath]
    .reverse()
    .map((cat) => parseName(cat.name, locale));

  const mainPart = names.join(' | ');

  return `${mainPart} ${locationSuffix} - ${BUSINESS_NAME}`;
}

/**
 * Generate meta description for category page.
 *
 * @param template - Localized template string
 * @param categoryName - Localized category name
 * @returns Meta description
 */
export function generateCategoryMetaDescription(
  template: string,
  categoryName: string,
): string {
  return template
    .replace('{category}', categoryName)
    .replace('{businessName}', BUSINESS_NAME);
}

/**
 * Generate title for search results page.
 *
 * @param template - Localized template string (e.g. "Search results for '{keyword}'")
 * @param keyword - User's search term
 * @returns SEO title
 */
export function generateSearchTitle(template: string, keyword: string): string {
  return `${template.replace('{keyword}', keyword)} - ${BUSINESS_NAME}`;
}

/**
 * Generate Product schema JSON-LD for structured data.
 * This enables Google Shopping rich results.
 *
 * @param params - Product data for schema
 * @returns JSON-LD Product schema object
 *
 * @see {@link ../../../docs/SEO_KNOWLEDGE.md} for details on Structured Data.
 */
export function generateProductJsonLd(params: {
  productName: string;
  productUrl: string;
  price?: string;
  imageUrls: string[];
  brandName?: string;
  description?: string;
}): ProductJsonLdData {
  const {
    productName,
    productUrl,
    price,
    imageUrls,
    brandName, // todo: brandName reserved for future use when all products have brands
    description,
  } = params;

  const schema: ProductJsonLdData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    image: imageUrls,
    offers: {
      '@type': 'Offer',
      price: price || '0',
      priceCurrency: 'TMT',
      url: productUrl,
    },
  };

  if (brandName) {
    schema.brand = {
      '@type': 'Brand',
      name: brandName,
    };
  }

  if (description) {
    schema.description = description;
  }

  return schema;
}

// Store Configuration
interface Store {
  id: string; // Unique identifier for elements
  name: string; // The official name on Google Maps (e.g., 'Xmobile 3nji kwartal')
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string | undefined;
  addressCountry: string;
  latitude: number;
  longitude: number;
  telephone: string;
  opens: string;
  closes: string;
}

const STORES: Store[] = [
  {
    id: 'xmobile-main',
    name: 'Xmobile', // Main store
    streetAddress: 'S.A. Nyyazov St',
    addressLocality: 'Turkmenabat',
    addressRegion: 'Lebap',
    postalCode: '746100',
    addressCountry: 'TM',
    latitude: 39.063248043914534,
    longitude: 63.57906739895904,
    telephone: '+993-61-00-49-33',
    opens: '08:00',
    closes: '20:00',
  },
  // Example for future store:
  // {
  //   id: 'xmobile-3rd-quarter',
  //   name: 'Xmobile 3rd Quarter',
  //   streetAddress: 'Gok Bazar',
  //   addressLocality: 'Turkmenabat',
  //   addressRegion: 'Lebap',
  //   postalCode: undefined,
  //   addressCountry: 'TM',
  //   latitude: 0,
  //   longitude: 0,
  //   telephone: '+993-XX-XX-XX-XX',
  //   opens: '09:00',
  //   closes: '21:00',
  // },
];

/**
 * Generate Organization Schema (JSON-LD)
 * Defines the brand identity, social profiles, and connection to the website.
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BUSINESS_NAME, // Xmobile
    url: BASE_URL,
    logo: `${BASE_URL}/logo/xmobile-processed-logo.png`,
    sameAs: [
      'https://www.instagram.com/xmobiletm/',
      'https://www.tiktok.com/@xmobiletm',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+993-61-00-49-33',
      contactType: 'customer service',
      areaServed: 'TM',
      availableLanguage: ['Turkmen', 'Russian', 'English'],
    },
  };
}

/**
 * Generate LocalBusiness Schema (JSON-LD)
 * Defines physical store locations for Google Maps integration.
 * Supports multiple locations dynamically.
 */
export function generateLocalBusinessSchema() {
  return STORES.map((store) => ({
    '@context': 'https://schema.org',
    '@type': 'MobilePhoneStore',
    name: store.name,
    image: `${BASE_URL}/logo/xmobile-processed-logo.png`,
    '@id': `${BASE_URL}/#store-${store.id}`,
    url: BASE_URL,
    telephone: store.telephone,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.streetAddress,
      addressLocality: store.addressLocality,
      addressRegion: store.addressRegion,
      postalCode: store.postalCode,
      addressCountry: store.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: store.latitude,
      longitude: store.longitude,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: store.opens,
      closes: store.closes,
    },
  }));
}

/**
 * Generate BreadcrumbList JSON-LD schema from category path.
 *
 * @param categoryPath - Array of categories from root to current
 * @param currentProductName - Optional product name (if on product page)
 * @param locale - Current locale for category names
 * @returns BreadcrumbList JSON-LD schema
 *
 * @see {@link ../../../docs/SEO_KNOWLEDGE.md} for details on Breadcrumb Schema.
 */
export function generateBreadcrumbJsonLd(
  categoryPath: ExtendedCategory[],
  currentProductName: string | undefined,
  locale: string,
): BreadcrumbListJsonLd {
  const items: BreadcrumbJsonLdItem[] = [];

  // Start with Home
  items.push({
    '@type': 'ListItem',
    position: 1,
    name: 'Home',
    item: `${BASE_URL}/${locale}`,
  });

  categoryPath.forEach((category, index) => {
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name: parseName(category.name, locale),
      item: `${BASE_URL}/${locale}/category/${category.id}`,
    });
  });

  if (currentProductName) {
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: currentProductName,
      // no 'item' property for last breadcrumb (current page)
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}
