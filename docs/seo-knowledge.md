# SEO Knowledge and Implementation

This document outlines the SEO architecture and implementation for the Xmobile project.

## 1. Core SEO Components

### Meta Tags
All pages render standard `<head>` meta tags:
- **Title**: Unique, localized titles optimized for click-through rates.
- **Description**: Summary snippets for search results.
- **Canonical URL**: Defines the primary version of a page to prevent duplicate content.
- **Hreflang Tags**: Informs crawlers about localized versions (ru, tk, en, etc.).

### Structured Data (JSON-LD)
JSON-LD powers rich results in search engines:
- **Product**: Includes `name`, `image`, and `offers` (price/currency), with optional `brand` and `description` when available.
- **Breadcrumb**: Defines the page hierarchy for search engine breadcrumb trails.
- **Organization & LocalBusiness**: Establishes brand identity and links physical stores to the website via unique `@id` identifiers (e.g., `https://xmobile.tm/#store-turkmenabat`).

### Robots & Sitemap
- **Robots.txt**: Restricts crawlers from private or low-value pages (cart, profile).
- **Sitemap.xml**: Dynamically generated map of all indexable pages (products, categories).

## 2. Implementation Details

### Centralized Logic (`src/pages/lib/seo.ts`)
All SEO logic is centralized in pure functions for testing and reusability:
- `generateProductTitle` / `generateProductMetaDescription`: Template-based generators.
- `getCanonicalUrl`: Handles locale-specific canonical URLs.
- `generateHreflangLinks`: Generates alternate links for indexable/canonical locales plus `x-default`.
- **Schema Generators**: `generateProductJsonLd`, `generateOrganizationSchema`, `generateLocalBusinessSchema`.
### Store Configuration

Store locations are defined in the `STORES` constant in `src/pages/lib/seo.ts`.
This array drives the `LocalBusiness` schema generation. To add a new store, simply add an object to this array.
### Sitemap Configuration (`src/pages/sitemap.xml.page.ts`)
- **Homepage**: `priority: 1.0`, `changefreq: daily`.
- **Product Listing Pages (/product-category/)**: `priority: 0.8`, `changefreq: daily`.
- **Product Pages (/product/)**: `priority: 0.9`, `changefreq: daily`.
- **Note**: `/category/[slug]` pages are not indexed and ignored in sitemap generation

### Indexing Strategy: Product Listing Pages (PLP)
- **Category Navigation Pages**: `/category/[slug]` renders category/subcategory navigation, but these pages are marked `noindex`.
- **Leaf Category Handling**: When a category is a leaf node, `/category/[slug]` redirects to `/product-category/[categorySlug]`.
- **Indexable Product Listing Pages**: `/product-category/[categorySlug]` is the crawler-facing product grid route intended for indexing.
- **Implementation**: Both use dedicated slug-based routes and SSG, but only `/product-category/[categorySlug]` is indexable.
- **Note**: `/category/` pages are not indexed since they only help users select child categories and provide no meaningful content.

### Data Flow
1. **Page Load**: `getStaticProps` or `getServerSideProps` fetches data and populates an `seoData` object via `seo.ts` generators.
2. **Rendering**: `_app.page.tsx` reads `seoData` and renders `<Head>` tags and JSON-LD scripts.

## 3. Design Standards

### Localization
SEO strings are stored in `src/i18n/*.json`.
- **URLs**: Include locale prefix (e.g., `/ru/product/slug`).
- **Consolidation**: The `ch` locale canonicalizes to `tk` to prevent duplicate content.
- **x-default**: Defaults to the `ru` version.

### Sitemap Strategy
- **Generation**: Generated dynamically in `sitemap.xml.page.ts`.
- **Caching**: 1-day `Cache-Control` header prevents database strain.
- **Scaling**: If products exceed 10k, migration to static file generation is required.
