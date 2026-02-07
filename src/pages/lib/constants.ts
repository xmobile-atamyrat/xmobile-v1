// eslint-disable-next-line import/prefer-default-export

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';
export const AUTH_REFRESH_COOKIE_NAME = 'REFRESH_TOKEN';

export const REFRESH_TOKEN_EXPIRY = '7d';
export const ACCESS_TOKEN_EXPIRY = '8h';
export const REFRESH_TOKEN_EXPIRY_COOKIE = 60 * 60 * 24 * 7; // 7 days

export const PRODUCT_IMAGE_WIDTH = 1024; // px

export const appBarHeight = 64;

export const mobileAppBarHeight = 56;

export const localeOptions = ['en', 'tk', 'ru', 'ch', 'tr'];

export const drawerPaddingTopOffset = 2;

export const MAIN_BG_COLOR = '#FFF';

export const DEFAULT_MUI_COLOR = '#1976d2';

export const LOGO_COLOR = '#1976d2';
export const LOGO_COLOR_LIGHT = '#1d72c2';
export const LOGO_COLOR_ORANGE = '#ff6f00';
/**
 * #221765 -> original
 * #4B4090
 * #6459A6
 * #7F74BD
 * #A89EE0 -> lightest
 */

export const PRODUCT_IMAGE_WIDTH_RESP = {
  width: {
    xs: '75%',
    sm: '50%',
    md: '75%',
  },
};

/*
To store images in:
  * BAD quality -> reduce quality, and resize width for higher compression
  * GOOD quality -> reduce quality
*/

// These options should be kept consistent with compress-images.mjs file
export const IMG_COMPRESSION_MIN_QUALITY = 20; // %
export const IMG_COMPRESSION_MAX_QUALITY = 90; // %
export const IMG_COMPRESSION_OPTIONS = {
  bad: {
    width: 600, // px
    size: 50 * 1024, // KB
  },
  good: {
    size: 150 * 1024, // KB
    width: 0, // no change in width
  },
};

export const squareBracketRegex = /\[([^\]]+)\]/;
export const curlyBracketRegex = /\{([^}]+)\}/;

export const POLL_DOLLAR_RATE_INTERVAL = 600_000; // 10 minutes
export const POLL_PRODUCT_INTERVAL = 600_000; // 10 minutes

export const HIGHEST_LEVEL_CATEGORY_ID = 'no_parent_category';

export const defaultProductDescEn =
  '[Release date]\n[Display]\n[Processor]\n[Camera]\n[Battery]\n[OS]';
export const defaultProductDescTk =
  '[Çykan wagty]\n[Ekran]\n[Prosessor]\n[Kamera]\n[Batareýka]\n[OS]';
export const defaultProductDescTr =
  '[Yayın tarihi]\n[Ekran]\n[İşlemci]\n[Kamera]\n[Pil]\n[OS]';
export const defaultProductDescCh =
  '[Çykan wagty]\n[Ekran]\n[Prosessor]\n[Kamera]\n[Batareýka]\n[OS]';
export const defaultProductDescRu =
  '[Дата выхода]\n[Дисплей]\n[Процессор]\n[Камера]\n[Батарея]\n[OS]';

export const POST_SOVIET_COUNTRIES = [
  'AM',
  'AZ',
  'BY',
  'EE',
  'GE',
  'KZ',
  'KG',
  'LV',
  'LT',
  'MD',
  'RU',
  'TJ',
  'TM',
  'UA',
  'UZ',
];

export const DUMMY_KR_IP = '59.6.230.229';
export const DUMMY_TM_IP = '95.85.96.1';
export const DUMMY_DUBAI_IP = '94.200.200.200';
export const DUMMY_TR_IP = '88.240.128.0';

export const X_MOBILE_DOMAIN = 'xmobile.com.tm';

export const ALL_PRODUCTS_CATEGORY_CARD = 'ALL_PRODUCTS_CATEGORY_CARD';

export const SORT_OPTIONS = {
  PRICE_ASC: 'price_asc',
  PRICE_DESC: 'price_desc',
  NEWEST: 'newest',
  A_Z: 'a_z',
} as const;

export const FILTER_MAX_PRICE = 100000;

// SEO CONSTANTS

// Mapping: Next.js locale -> Open Graph locale (e.g., ru -> ru_RU)
export const LOCALE_TO_OG_LOCALE = {
  ru: 'ru_RU',
  tk: 'tk_TM',
  en: 'en_US',
  ch: 'tk_TM',
  tr: 'tr_TR',
};

export const BUSINESS_NAME = 'X-mobile';

export const META_DESC_MAX_LENGTH = 160; // Google standard: ~160 chars
export const TITLE_MAX_LENGTH = 60; // Google standard: ~60 chars

// Dynamic meta description templates by locale
export const META_DESC_TEMPLATES = {
  ru: 'Купить {product} {price} в Туркменабате. В кредит 6/12 мес. Официальная гарантия, бесплатная доставка. В наличии на X-mobile.',
  tk: '{product} {price} Türkmenabatda satyn almak. 6/12 aý garaşaryna. Resmi kepillik, mugt eltip bermek. X-mobile-da bar.',
  en: 'Buy {product} {price} in Turkmenabat. Credit 6/12 months. Official warranty, free delivery. Available at X-mobile.',
  ch: '{product} {price} Türkmenabatda satyn almak. 6/12 aý garaşaryna. Resmi kepillik, mugt eltip bermek. X-mobile-da bar.',
  tr: "{product} {price} Türkmenabat'ta satın alın. 6/12 ay taksit. Resmi garanti, ücretsiz teslimat. X-mobile'de mevcut.",
} as const;
