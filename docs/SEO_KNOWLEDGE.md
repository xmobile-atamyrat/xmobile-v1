# SEO Knowledge Base

This document explains the SEO concepts used in the codebase.

## Translation-Based SEO System

All SEO-related strings (titles, descriptions, templates) are stored in the translation files (`src/i18n/*.json`) to support multiple locales (en, ru, tk, ch, tr). This enables dynamic SEO content that adapts to user language.

**Key files:**
- `src/i18n/en.json`, `ru.json`, `tk.json`, `ch.json`, `tr.json` - SEO string storage
- `src/pages/lib/seo.ts` - SEO generation functions
- `src/pages/lib/constants.ts` - `BUSINESS_NAME` constant

### Business Name Placeholder

SEO templates use `{businessName}` as a placeholder that gets replaced with the constant `BUSINESS_NAME` (currently "X-mobile"). This allows translators to control the text while keeping the business name centralized.

**Example:**
```json
"homeIndexTitle": "{businessName} | Buy Smartphones & Electronics in Turkmenistan"
```
becomes: `"Xmobile | Buy Smartphones & Electronics in Turkmenistan"`

## Homepage SEO
**Implemented in**: `src/pages/index.page.tsx` → `getServerSideProps`

**Translation keys:**
- `homeIndexTitle` - Homepage title
- `homeIndexDescription` - Homepage meta description

**Example (en.json):**
```json
"homeIndexTitle": "{businessName} | Buy Smartphones & Electronics in Turkmenistan",
"homeIndexDescription": "Buy smartphones, gadgets, and electronics at {businessName}. Best prices in Turkmenistan, official warranty, and fast nationwide delivery."
```

## Product Pages

### Product Titles
**Implemented in**: `generateProductTitle`

**Format:** `{ProductName} | {Brand} - X-mobile`
**Note:** Brands may not appear in all products, as they are not currently added to all products (as of Feb 18,26). 

### Product Meta Descriptions
**Implemented in**: `generateProductMetaDescription`

Meta descriptions are generated dynamically using localized templates from translation files. Templates include placeholders for product name, price, and business name.

**Translation key:** `productDetailsMetaDescription`

**Example (en.json):**
```json
"productDetailsMetaDescription": "Buy {product} in Turkmenistan for {price}. Official warranty, fast delivery across Turkmenistan. Order online today at {businessName}."
```

**Placeholders:**
- `{product}` - Product name
- `{price}` - Product price with "TMT" currency
- `{businessName}` - Replaced with "X-mobile"

## Product Index Page (Listing)
**Route:** `/product`

**Translation key:** `productIndexDescription`

**Example (en.json):**
```json
"productIndexDescription": "Buy smartphones, gadgets, and electronics in Turkmenistan at the best prices. Official warranty, fast delivery across the country, and top global brands."
```

## Category Pages

### Category Titles
**Implemented in**: `generateCategoryTitle`

**Format:** `{Child} | {Parent} | ... | {Root} {seoLocationSuffix} - X-mobile`

**Translation key:** `seoLocationSuffix` (e.g., "in Turkmenistan")

### Category Meta Descriptions
**Implemented in**: `generateCategoryMetaDescription`

**Translation key:** `categoryDetailsMetaDescription`

**Example (en.json):**
```json
"categoryDetailsMetaDescription": "Buy {category} in Turkmenistan at the best prices. Wide selection, official warranty, and fast delivery across Turkmenistan at {businessName}."
```

### Category Index Page
**Route:** `/category`

**Translation keys:**
- `categoryIndexTitle` - Category listing page title
- `categoryIndexDescription` - Category listing page description

**Example (en.json):**
```json
"categoryIndexTitle": "Shop by Category | {businessName} Turkmenistan",
"categoryIndexDescription": "Explore all product categories at {businessName}. Smartphones, gadgets, and electronics with official warranty and fast delivery across Turkmenistan."
```

## Canonical URLs
**Implemented in**: `getCanonicalUrl`

Canonical URLs tell Google which URL is the "official" version of a page, preventing duplicate content issues when the same page is accessible via multiple URLs (e.g., with tracking parameters, different domains, etc.)

## Hreflang Tags
**Implemented in**: `generateHreflangLinks`

Hreflang tags tell Google about alternate language versions of the same page. This prevents duplicate content issues and helps Google show the right language version to users based on their search language.

**IMPORTANT**: The same hreflang list should appear on **ALL** language versions of a page. This creates a bidirectional relationship between translations.

[Learn more about Hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)

## Structured Data (JSON-LD)
**Implemented in**: `generateProductJsonLd` and `generateBreadcrumbJsonLd`

### Product Schema
Enables Google Shopping rich results by providing structured data about the product (eg. name, image,  brand, price, currency).

### Breadcrumb Schema
Creates breadcrumb trails that appear in Google search results.

**Note**: This is different from the UI `SimpleBreadcrumbs` component. UI breadcrumbs are for users; JSON-LD is for search engines.

### Organization Schema
**Implemented in**: `generateOrganizationSchema` and `generateLocalBusinessSchema` (in `src/pages/lib/seo.ts`)

**Purpose**: Establishes brand identity and connects physical store locations to the website for Google Maps and Knowledge Panel.

**Key Features:**
*   **Centralized Config**: Store locations are managed in the `STORES` array in `seo.ts`. new branches can be added easily.
*   **Dynamic Schema**: `generateLocalBusinessSchema` automatically creates schema for all configured stores.
*   **Decisions**:
    *   **Naming**: Uses "Xmobile" consistently. Store names in config are used directly in schema.
    *   **IDs**: Unique `@id` generated from store URL + name (e.g., `#store-xmobile-turkmenabat`) to serve as a global identifier.
    *   **Price Range**: Set to `$$` (Standard) to reflect market positioning.
    *   **Opening Hours**: Structured `opens`/`closes` times for better machine readability.

**Location:** Rendered only on the Homepage (`index.page.tsx`) to avoid site-wide redundancy.

## Robots.txt
**File**: `public/robots.txt`

This file gives instructions to web robots (search engine crawlers) about which pages on your site to crawl.
- **Allowed**: `User-agent: *` (All bots are allowed)
- **Disallowed**: user profiles, carts, orders, chat, APIs, and search results to preserve crawl budget and security.
- **Sitemap Reference**: Points crawlers to the `sitemap.xml` location.

## Sitemap.xml
**Implemented in**: `src/pages/sitemap.xml.page.ts`

**Note:** The `.page.ts` extension is required due to the `pageExtensions` configuration in `next.config.mjs` which only recognizes `.page.tsx` and `.page.ts` files as routes.

An XML map of all the pages on the site intended for search engine indexing.

### Design Decisions & Technical Debt
- **On-the-fly Generation vs Static File**:
  - *Decision*: The sitemap is generated dynamically using `getServerSideProps` to ensure it always reflects the latest product catalog
  - *Trade-off*: This adds load to the database on every request.
  - *Mitigation*: A `Cache-Control` header (1 day) is used to CDN/browser cache the result

- **Fetching All Products**:
  - *Debt*: The current implementation `dbClient.product.findMany()` fetches ALL products at once.
  - *Risk*: As the catalog grows (e.g., >10k items), this will hit memory limits and crash the server.
  - *Future Fix*: Implement cursor-based pagination streams or switch to a static file generation script (ISR) if the catalog becomes too large.

### Implementation Details
- **Contents**:
    - Static pages (homepage, category index)
    - All Category pages (Priority: 0.8, Daily updates)
    - All Product pages (Priority: 0.9, Weekly updates)
