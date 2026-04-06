Object.defineProperty(exports, '__esModule', { value: true });
// eslint-disable-next-line no-void
exports.slugify = void 0;
const client = require('@prisma/client');

const slugify = (text) => {
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
exports.slugify = slugify;
const dbClient = new client.PrismaClient();
async function checkDuplicates() {
  console.log('--- Starting Slugs Duplicate Analysis ---\n');
  // 1. Check Categories
  const categories = await dbClient.category.findMany();
  console.log(`Found ${categories.length} categories.`);
  const catSlugs = new Map();
  categories.forEach((cat) => {
    // Parse Name JSON since Categories use localized JSON strings often based on utils.ts Logic
    // utils.ts parseName does it, but we can just parse the english/turkmen one
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
    const slug = (0, exports.slugify)(bareName);
    if (!catSlugs.has(slug)) catSlugs.set(slug, []);
    catSlugs.get(slug).push({ id: cat.id, originalDbName: cat.name, bareName });
  });
  let hasCatDuplicates = false;
  catSlugs.forEach((items, slug) => {
    if (items.length > 1) {
      hasCatDuplicates = true;
      console.log(`❌ Duplicate Category Slug detected: "${slug}"`);
      items.forEach((item) =>
        console.log(`   - ID: ${item.id} | Name: ${item.bareName}`),
      );
      console.log('---');
    }
  });
  if (!hasCatDuplicates) console.log('✅ No category duplicate slugs found!\n');
  // 2. Check Products
  const products = await dbClient.product.findMany();
  console.log(`Found ${products.length} products.`);
  const prodSlugs = new Map();
  products.forEach((prod) => {
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
    const slug = (0, exports.slugify)(bareName);
    if (!prodSlugs.has(slug)) prodSlugs.set(slug, []);
    prodSlugs
      .get(slug)
      .push({ id: prod.id, originalDbName: prod.name, bareName });
  });
  let hasProdDuplicates = false;
  prodSlugs.forEach((items, slug) => {
    if (items.length > 1) {
      hasProdDuplicates = true;
      console.log(`❌ Duplicate Product Slug detected: "${slug}"`);
      items.forEach((item) =>
        console.log(`   - ID: ${item.id} | Name: ${item.bareName}`),
      );
      console.log('---');
    }
  });
  if (!hasProdDuplicates) console.log('✅ No product duplicate slugs found!\n');
  if (hasCatDuplicates || hasProdDuplicates) {
    console.log(
      '\n⚠️ ACTION REQUIRED: Please rename the duplicate items in your admin dashboard so their slugs become unique.',
    );
    console.log(
      'Once you confirm they are unique, we will proceed with the schema migration.',
    );
  } else {
    console.log(
      '\n✅ READY TO PROCEED: All auto-generated slugs are completely unique!',
    );
  }
  await dbClient.$disconnect();
}
checkDuplicates().catch((e) => {
  console.error(e);
  process.exit(1);
});
