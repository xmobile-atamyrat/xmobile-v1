import BASE_URL from '@/lib/ApiEndpoints';
import {
  BUSINESS_NAME,
  localeOptions,
  META_DESC_MAX_LENGTH,
  TITLE_MAX_LENGTH,
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

  if (title.length > TITLE_MAX_LENGTH) {
    const availableLength =
      TITLE_MAX_LENGTH - brandSuffix.length - BUSINESS_NAME.length - 3; // 3 = " - " + "..."
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
  currentProductName: string | undefined, // todo: might remove
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

  // Add each category in path
  categoryPath.forEach((category, index) => {
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name: parseName(category.name, locale),
      item: `${BASE_URL}/${locale}/category/${category.id}`,
    });
  });

  // Add product if present (last item has no URL per Schema.org spec)
  if (currentProductName) {
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: currentProductName,
      // No 'item' property for last breadcrumb (current page)
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}
