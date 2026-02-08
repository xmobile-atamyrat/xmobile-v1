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

export const BUSINESS_NAME = 'Xmobile';

export const META_DESC_MAX_LENGTH = 160; // Google standard: ~160 chars
export const TITLE_MAX_LENGTH = 60; // Google standard: ~60 chars

export const PRODUCT_META_DESC_TEMPLATES = {
  ru: 'Купите {product} в Туркменистане по цене {price}. Официальная гарантия, бесплатная доставка. X-mobile.',

  tk: '{product} Türkmenistanda {price} bahadan satyn alyň. Resmi kepillik, mugt eltip bermek. X-mobile.',

  en: 'Buy {product} in Turkmenistan for {price}. Official warranty, free delivery. X-mobile.',

  ch: '{product} Türkmenistanda {price} bahadan satyn alyňlar. Ofisialny garantiýa, besplatno dostawka. X-mobile.',

  tr: '{product} ürününü Türkmenistan’da {price} fiyatla satın alın. Resmi garanti, ücretsiz teslimat. X-mobile.',
} as const;

export const CATEGORY_META_DESC_TEMPLATES = {
  ru: 'Купить {category} в Туркменистане. Большой выбор моделей, официальная гарантия и бесплатная доставка. X-mobile.',

  tk: '{category} Türkmenistanda satyn alyň. Uly saýlaw, resmi kepillik we mugt eltip bermek. X-mobile.',

  en: 'Buy {category} in Turkmenistan. Wide selection, official warranty and free delivery. X-mobile.',

  ch: '{category} Türkmenistanda satyn alyňlar. Wybor köp, ofisialny garantiýa i besplatno dostawka. X-mobile.',

  tr: '{category} ürünlerini Türkmenistan’da satın alın. Geniş ürün yelpazesi, resmi garanti ve ücretsiz teslimat. X-mobile.',
} as const;

export const SEO_LOCATION_SUFFIXES = {
  ru: 'в Туркменистане',
  tk: 'Türkmenistanda',
  ch: 'Türkmenistanda',
  tr: "Türkmenistan'da",
  en: 'in Turkmenistan',
} as const;

export const SEO_SEARCH_TEMPLATES = {
  ru: 'Результаты поиска для "{keyword}"',
  tk: '"{keyword}" üçin gözleg netijeleri',
  ch: '"{keyword}" üçin gözleg netijeleri',
  tr: '"{keyword}" için arama sonuçları',
  en: 'Search results for "{keyword}"',
} as const;

export const SEO_CATEGORY_INDEX = {
  ru: {
    title: 'Категории | X-Mobile',
    description: 'Все категории товаров на X-Mobile.',
  },
  tk: {
    title: 'Kategoriýalar | X-Mobile',
    description: 'Ähli haryt kategoriýalary X-Mobile-da.',
  },
  ch: {
    title: 'Kategoriýalar | X-Mobile',
    description: 'Ähli haryt kategoriýalary X-Mobile-da.',
  },
  en: {
    title: 'Categories | X-Mobile',
    description: 'All product categories at X-Mobile.',
  },
  tr: {
    title: 'Kategoriler | X-Mobile',
    description: "X-Mobile'daki tüm ürün kategorileri.",
  },
} as const;
