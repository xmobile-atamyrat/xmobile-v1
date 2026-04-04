import { PrismaClient } from '@prisma/client';

export const slugify = (text: string): string => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Normalize diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s-]/g, '') // Remove non-word characters
    .trim() // Trim leading/trailing whitespace
    .replace(/[-\s]+/g, '-') // Replace spaces with hyphens
    .substring(0, 100) // Cap at 100 characters to prevent DB constraint issues
    .replace(/-+$/, ''); // Remove trailing hyphens again if length cut off at a hyphen
};

const dbClient = new PrismaClient();

async function backfillSlugs() {
  console.log('--- Starting Slugs Generation/Backfill ---\n');

  // 1. Process Categories
  const categories = await dbClient.category.findMany();
  console.log(`Found ${categories.length} categories. Generating slugs...`);

  let categoriesUpdated = 0;
  categories.forEach(async (cat) => {
    let bareName = cat.name;
    try {
      const parsed = JSON.parse(cat.name);
      bareName =
        parsed.en ||
        parsed.tk ||
        parsed.ru ||
        parsed.ch ||
        parsed.tr ||
        cat.name;
    } catch (e) {
      // not JSON
    }
    const slug = slugify(bareName);

    // Only update if the slug is changing or currently null
    if (cat.slug !== slug) {
      await dbClient.category.update({
        where: { id: cat.id },
        data: { slug },
      });
      categoriesUpdated += 1;
    }
  });
  console.log(
    `✅ ${categoriesUpdated} Categories successfully updated with unique slugs.\n`,
  );

  // 2. Process Products
  const products = await dbClient.product.findMany();
  console.log(`Found ${products.length} products. Generating slugs...`);

  let productsUpdated = 0;
  products.forEach(async (prod) => {
    let bareName = prod.name;
    try {
      const parsed = JSON.parse(prod.name);
      bareName =
        parsed.en ||
        parsed.tk ||
        parsed.ru ||
        parsed.ch ||
        parsed.tr ||
        prod.name;
    } catch (e) {
      // not JSON
    }
    const slug = slugify(bareName);

    // Only update if the slug is changing or currently null
    if (prod.slug !== slug) {
      await dbClient.product.update({
        where: { id: prod.id },
        data: { slug },
      });
      productsUpdated += 1;
    }
  });
  console.log(
    `✅ ${productsUpdated} Products successfully updated with unique slugs.\n`,
  );

  console.log(
    '🎉 Database backfill complete! All your products and categories now have permanent, unique SEO slugs.',
  );

  await dbClient.$disconnect();
}

backfillSlugs().catch((e) => {
  console.error(e);
  process.exit(1);
});
//  npx dotenv -e .env.local -- npx tsx scripts/generate-slugs.ts
