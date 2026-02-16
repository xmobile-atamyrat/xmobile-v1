import dbClient from '@/lib/dbClient';
import { X_MOBILE_DOMAIN } from '@/pages/lib/constants';
import { GetServerSideProps } from 'next';

const EXTERNAL_DATA_URL = `https://${X_MOBILE_DOMAIN}`;

function generateSiteMap(
  products: { id: string; updatedAt: Date }[],
  categories: { id: string; updatedAt: Date }[],
) {
  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <!-- Static Pages -->
     <url>
       <loc>${EXTERNAL_DATA_URL}</loc>
       <changefreq>daily</changefreq>
       <priority>1.0</priority>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/category</loc>
       <changefreq>daily</changefreq>
       <priority>0.8</priority>
     </url>

     <!-- Dynamic Categories -->
     ${categories
       .map(({ id, updatedAt }) => {
         return `
       <url>
           <loc>${EXTERNAL_DATA_URL}/category/${id}</loc>
           <lastmod>${updatedAt.toISOString()}</lastmod>
           <changefreq>daily</changefreq>
           <priority>0.8</priority>
       </url>
     `;
       })
       .join('')}

     <!-- Dynamic Products -->
     ${products
       .map(({ id, updatedAt }) => {
         return `
       <url>
           <loc>${EXTERNAL_DATA_URL}/product/${id}</loc>
           <lastmod>${updatedAt.toISOString()}</lastmod>
           <changefreq>weekly</changefreq>
           <priority>0.9</priority>
       </url>
     `;
       })
       .join('')}
   </urlset>
 `;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const products = await dbClient.product.findMany({
    select: {
      id: true,
      updatedAt: true,
    },
  });

  const categories = await dbClient.category.findMany({
    select: {
      id: true,
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

export default function SiteMap() {
  // required by Next.js but never rendered (response handled in getServerSideProps).
}
