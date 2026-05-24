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
- **Product**: Includes `name`, `image`, `description`, `sku`, `brand`, and `offers` (price/currency).
- **Breadcrumb**: Defines the page hierarchy for search engine breadcrumb trails.
- **Organization & LocalBusiness**: Establishes brand identity and links physical stores to the website via unique `@id` identifiers (e.g., `https://xmobile.tm/#store-turkmenabat`).

### Robots & Sitemap
- **Robots.txt**: Restricts crawlers from private or low-value pages (cart, profile).
- **Sitemap.xml**: Dynamically generated map of all indexable pages (products, categories).

## 2. Implementation Details

### Centralized Logic (`src/pages/lib/seo.ts`)
All SEO logic is centralized in pure functions for testing and reusability:
- `generateProductTitle` / `generateProductMetaDescription`: Template-based generators.
- `generateCanonicalUrl`: Handles locale-specific URLs.
- `generateHreflangLinks`: Generates alternate links for all supported languages.
- **Schema Generators**: `generateProductJsonLd`, `generateOrganizationSchema`, `generateLocalBusinessSchema`.
### Store Configuration

Store locations are defined in the `STORES` constant in `src/pages/lib/seo.ts`.
This array drives the `LocalBusiness` schema generation. To add a new store, simply add an object to this array.
### Sitemap Configuration
- **Homepage**: `priority: 1.0`, `changefreq: daily`.
- **Category Pages (/category/)**: `priority: 0.7`, `changefreq: weekly`.
- **Product Listing Pages (/product-category/)**: `priority: 0.8`, `changefreq: daily`.
- **Product Pages (/product/)**: `priority: 0.9`, `changefreq: daily`.

### Indexing Strategy: Product Listing Pages (PLP)
- **Primary Category Pages**: `/category/[slug]` (subcategories grid).
- **Product Listing Pages**: `/product-category/[categorySlug]` (product grid for a specific category).
- **Implementation**: Both use dedicated slug-based routes and Static Site Generation (`getStaticProps`).

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
