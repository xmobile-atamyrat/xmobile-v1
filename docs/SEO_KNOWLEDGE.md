# SEO Knowledge and Implementation

This document serves as the single source of truth for SEO implementation in the X-Mobile project.

## 1. Core SEO Concepts & Components

### Meta Tags
Standard meta tags that appear in the `<head>` of every page.
*   **Title**: Unique title for each page. Important for click-through rates.
*   **Description**: Summary of page content. Crucial for search result snippets.
*   **Canonical URL**: Points to the "master" copy of a page to prevent duplicate content issues.
*   **Hreflang Tags**: Tells Google about localized versions of a page (ru, tk, en, etc.).

### Structured Data (JSON-LD)
Structured data is code that helps search engines understand the content of the page. It powers Rich Results (e.g., stars, price, stock status in search results).

#### Product Schema
*   **Purpose**: Display rich product info (Price, Availability, Image) in Google Shopping/Search.
*   **Properties**: `name`, `image`, `description`, `sku`, `brand`, `offers` (price, currency).

#### Breadcrumb Schema
*   **Purpose**: Shows the page's position in the site hierarchy in search results (e.g., `Home > Phones > Samsung`).
*   **Properties**: `itemListElement` (list of breadcrumbs).

#### Organization & LocalBusiness Schema
*   **Purpose**: Establishes your brand identity and connects physical stores to the website.
    *   **Google Knowledge Panel**: Shows your logo, social profiles, and contact info in search.
    *   **Google Maps**: Officially links your website to your physical store location.
*   **Properties**: `name`, `url`, `logo`, `contactPoint`, `address`, `geo`, `openingHours`.
*   **Global Identifier**: We assign a unique `@id` to each store (e.g. main branch `https://xmobile.tm/#store-turkmenabat`). This acts as a global "passport number" for that specific entity, allowing other data (like a product offer) to explicitly reference *that* store location unambiguously across the entire web.

### Robots.txt & Sitemap
*   **Robots.txt**: Instructions for crawlers on what *not* to visit (like cart, profile pages).
*   **Sitemap.xml**: A map of all indexable pages (products, categories) to help Google discover content.

## 2. Implementation Details

### File Structure & Logic
All SEO logic is centralized in [`src/pages/lib/seo.ts`](file:///src/pages/lib/seo.ts).

*   `generateProductTitle`: Creates titles like "{Product} | {Brand} - Xmobile".
*   `generateMetaDescription`: Creates descriptions from templates.
*   `generateCanonicalUrl`: Handles locale-specific URLs.
*   `generateHreflangLinks`: Generates alternate links for all supported languages.
*   **Schema Generators**:
    *   `generateProductJsonLd`: Returns Product schema object.
    *   `generateOrganizationSchema`: Returns Organization schema.
    *   `generateLocalBusinessSchema`: Returns LocalBusiness schema for all stores.

### Store Configuration
Store locations are defined in the `STORES` constant in `src/pages/lib/seo.ts`.
This array drives the `LocalBusiness` schema generation. To add a new store, simply add an object to this array.

### Sitemap Configuration
- **Contents & Configuration**:
    - **Homepage**: `priority: 1.0`, `changefreq: daily` (Top priority).
    - **Category Pages (category/[id])**: `priority: 0.7`, `changefreq: weekly` (Medium priority).
    - **Category Product Lists (product/index)**: `priority: 0.8`, `changefreq: daily` (High priority).
    - **Product Pages (product/[id])**: `priority: 0.9`, `changefreq: daily` (Product details).

### Future Improvement Recommendation
- **UUID vs Slugs**: Currently URLs use UUIDs (e.g., `category/123e4...`).
- **Recommendation**: Switch to keyword-based slugs (e.g., `category/smartphones`) in the future. Semantic URLs significantly improve click-through rates and keyword relevance signals.

### Indexing Strategy: Product Listing Pages (PLP)
- **Primary Category Pages**: `/category/[id]` (e.g., `/category/phones`) shows the *subcategories* grid.
- **Product Listing Pages**: `/product?categoryId=[id]` is currently the **Landing Page** for viewing products within a specific category.
- **Decision**: We allow indexing of `product?categoryId=[id]` because the content (title, metadata, product list) changes significantly for each category.
- **Constraint**:
  - We **ONLY** support indexing the `categoryId` parameter.
  - All other parameters (e.g., `sortBy`, `brands`) are ignored for indexing purposes or should self-canonicalize to the clean `categoryId` URL to prevent duplicate content.
- **Technical Debt**:
  - Relying on query parameters for landing pages is suboptimal.
  - **Future Plan**: Migrate to a clean URL structure like `/category/[id]/products` to improve SEO signals and URL readability.


### Data Flow
1.  **Page Load (`getServerSideProps`)**:
    *   Fetch data (Product, Category, etc.).
    *   Call generator functions in `seo.ts`.
    *   Populate `seoData` object.
2.  **Rendering (`_app.page.tsx`)**:
    *   Read `pageProps.seoData`.
    *   Render `<Head>` meta tags.
    *   Render JSON-LD scripts securely using `dangerouslySetInnerHTML`.

## 3. Design Decisions & Standards

### Naming Conventions
*   **Business Name**: "X-Mobile" (defined in `BUSINESS_NAME` constant). used consistently across all meta tags and schemas.
*   **Store Names**: Kept simple (e.g., "Turkmenabat") in config, used directly in schema as the official name.

### Data Structures & Schemas
*   **Product JSON-LD (`ProductJsonLdData`)**: Structured data used for Google Shopping and rich results in search. It is hidden structured data (not visible to users) that tells Google about product details like price, brand, images, etc.
*   **Breadcrumbs JSON-LD (`BreadcrumbJsonLdItem`, `BreadcrumbListJsonLd`)**: Generates breadcrumb trails that appear in Google search results (independent of UI breadcrumbs). The `item` field (URL) is *optional* because the last breadcrumb (the current page) should NOT have a URL according to the Schema.org spec (e.g., Home -> Phones -> iPhone 15, where iPhone 15 has no URL attached).
*   **Hreflang (`HreflangLink`)**: Tells Google about alternate language versions of the same page. If we have `/ru/product/123` and `/en/product/123`, hreflang links tell Google they're translations, not duplicate content.

### Open Graph
*   **og:type**: category pages and index use `website` to signify they are general collection pages, not specific entities, whereas product pages will use `product` as their og:type.

### Localization Strategy
All SEO-related strings (titles, descriptions, templates) are stored in the translation files (`src/i18n/*.json`) to support multiple locales (en, ru, tk, ch, tr).
*   **URLs**: All URLs include the locale (e.g., `/ru/product/123`).
*   **Canonical**: Points to itself (the current locale version).
*   **x-default**: Points to the 'ru' version as the default fallback.
*   **Schema**: Currently uses main local names (Turkmen) for store addresses to keep schema simple and verifiable by Google Maps.

### Why Centralized in `seo.ts`?
*   **Maintainability**: Single file to update for any SEO logic change.
*   **Reusability**: Functions can be used in API responses or other contexts if needed.
*   **Testing**: Pure functions are easier to unit test than React components.

### Sitemap Strategy
*   **Dynamic Generation**: sitemap.xml is generated on the fly via `getServerSideProps` to ensure it's always up to date.
*   **Caching**: We use a 1-day `Cache-Control` header to prevent database overload.
*   **Future Proofing/Notes**: If product count exceeds 10k, we need to switch to a static file generation script.
