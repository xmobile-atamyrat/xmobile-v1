import BASE_URL from '@/lib/ApiEndpoints';
import dbClient from '@/lib/dbClient';
import { GetServerSideProps } from 'next';
import { localeOptions } from '@/pages/lib/constants';

function generateSiteMap(
  products: { id: string; slug: string | null; updatedAt: Date }[],
  categories: { id: string; slug: string | null; updatedAt: Date }[],
) {
  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <!-- Static Pages -->
     ${localeOptions
       .map((locale) => {
         return `
     <url>
       <loc>${BASE_URL}/${locale}</loc>
       <changefreq>daily</changefreq>
       <priority>1.0</priority>
     </url>
     <url>
       <loc>${BASE_URL}/${locale}/category</loc>
       <changefreq>daily</changefreq>
       <priority>0.8</priority>
     </url>`;
       })
       .join('')}

     <!-- Categories -->
     ${categories
       .filter(({ slug }) => slug != null)
       .map(({ slug, updatedAt }) => {
         return localeOptions
           .map((locale) => {
             return `
        <url>
            <loc>${BASE_URL}/${locale}/category/${slug}</loc>
            <lastmod>${updatedAt.toISOString()}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.7</priority>
        </url>`;
           })
           .join('');
       })
       .join('')}

     <!-- Category Product Landing Pages -->
     ${categories
       .map(({ slug, updatedAt }) => {
         return localeOptions
           .map((locale) => {
             return `
       <url>
           <loc>${BASE_URL}/${locale}/product-category/${slug}</loc>
           <lastmod>${updatedAt.toISOString()}</lastmod>
           <changefreq>daily</changefreq>
           <priority>0.8</priority>
       </url>`;
           })
           .join('');
       })
       .join('')}

     <!-- Products -->
     ${products
       .filter(({ slug }) => slug != null)
       .map(({ slug, updatedAt }) => {
         return localeOptions
           .map((locale) => {
             return `
        <url>
            <loc>${BASE_URL}/${locale}/product/${slug}</loc>
            <lastmod>${updatedAt.toISOString()}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.9</priority>
        </url>`;
           })
           .join('');
       })
       .join('')}
 
   </urlset>
 `;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const products = await dbClient.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      updatedAt: true,
    },
  });

  const categories = await dbClient.category.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      updatedAt: true,
    },
  });

  const sitemap = generateSiteMap(products, categories);

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=86400, stale-while-revalidate=59',
  );
  // send the XML to the browser
  res.write(sitemap);
  res.end();

  return {
    props: {},
  };
};

export default function SiteMap(): null {
  // required by Next.js but never rendered (response handled in getServerSideProps).
  return null;
}
