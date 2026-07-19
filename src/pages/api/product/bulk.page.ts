import { syncBrandProductCount } from '@/lib/brandProductCount';
import dbClient from '@/lib/dbClient';
import {
  whereActiveCategory,
  whereActiveProduct,
} from '@/lib/prismaActiveScope';
import { deriveVariantColumns } from '@/pages/api/product/index.page';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import { squareBracketRegex } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { parsePrice, parseVariantTag } from '@/pages/product/utils';
import { Prisma, Product } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

const filepath = 'src/pages/api/product/bulk.page.ts';

// ---------- shared types (imported by the bulk-edit frontend) ----------

// One row of the "Variants" sheet on export.
export interface BulkVariant {
  productId: string;
  productName: string; // EN name, informational
  spec: string;
  priceUsd: string;
  priceTmt: string;
  color: string; // Color.name, '' = colorless
}

// One row of the "Products" sheet on export.
export interface BulkProductExportRow {
  id: string;
  slug: string; // informational, ignored on import
  nameEn: string;
  nameTk: string;
  nameRu: string;
  nameCh: string;
  nameTr: string;
  categorySlug: string;
  brand: string;
  priceUsd: string;
  priceTmt: string;
  isOutOfStock: boolean;
  videoUrls: string; // joined with ' | '
}

const cellSchema = z.string().optional();

const importProductRowSchema = z.object({
  row: z.number().int(), // real sheet row number, for error reporting
  id: z.string().min(1),
  nameEn: cellSchema,
  nameTk: cellSchema,
  nameRu: cellSchema,
  nameCh: cellSchema,
  nameTr: cellSchema,
  categorySlug: cellSchema,
  brand: cellSchema,
  priceUsd: cellSchema,
  priceTmt: cellSchema,
  outOfStock: cellSchema,
  videoUrls: cellSchema,
});

const importVariantRowSchema = z.object({
  row: z.number().int(),
  productId: z.string().min(1),
  spec: cellSchema,
  priceUsd: cellSchema,
  priceTmt: cellSchema,
  color: cellSchema,
});

const bulkImportBodySchema = z.object({
  products: z.array(importProductRowSchema),
  variants: z.array(importVariantRowSchema),
  hasVariantsSheet: z.boolean(),
});

export type ImportProductRow = z.infer<typeof importProductRowSchema>;
export type ImportVariantRow = z.infer<typeof importVariantRowSchema>;
export type BulkImportBody = z.infer<typeof bulkImportBodySchema>;

export interface BulkRowError {
  sheet: 'Products' | 'Variants';
  row: number;
  message: string;
}

export interface BulkImportResult {
  updatedCount: number;
  errors: BulkRowError[];
}

// ---------- planning (pure, unit-tested) ----------

export interface PlanRefs {
  categoryIdBySlug: Map<string, string>; // keyed lowercase
  brandIdByLowerName: Map<string, string>;
  colorIdByLowerName: Map<string, string>;
  rate: number | null; // DollarRate TMT rate; null = missing
}

export interface PlannedPrice {
  name: string; // name for a newly created Prices row
  usd: string;
  tmt: string;
}

export interface PlannedVariant {
  spec: string;
  colorId?: string;
  priceId?: string; // existing Prices row (update in place); absent = create if price given
  price?: PlannedPrice; // absent = leave the referenced price untouched
}

export interface ProductUpdatePlan {
  errors: BulkRowError[];
  data?: {
    name?: string;
    categoryId?: string;
    brandId?: string;
    isOutOfStock?: boolean;
    videoUrls?: string[];
    cachedPrice?: number;
  };
  basePrice?: { priceId?: string } & PlannedPrice;
  tags?: PlannedVariant[]; // undefined = don't touch tags (no Variants sheet)
}

const NAME_FIELDS = [
  ['nameEn', 'en'],
  ['nameTk', 'tk'],
  ['nameRu', 'ru'],
  ['nameCh', 'ch'],
  ['nameTr', 'tr'],
] as const;

const TRUTHY_CELLS = ['true', '1', 'yes'];
const FALSY_CELLS = ['false', '0', 'no'];

function cellText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function parseBoolCell(raw: string): boolean | undefined {
  const lower = raw.toLowerCase();
  if (TRUTHY_CELLS.includes(lower)) return true;
  if (FALSY_CELLS.includes(lower)) return false;
  return undefined;
}

function parsePriceCell(raw: string): number | undefined {
  const value = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

// USD/TMT cell pair -> final stored strings, using the update-prices page math.
// null = both cells empty (leave unchanged).
function resolvePriceCells(
  usdCell: string,
  tmtCell: string,
  rate: number | null,
): { usd: string; tmt: string } | { error: string } | null {
  if (usdCell === '' && tmtCell === '') return null;
  const usd = usdCell === '' ? undefined : parsePriceCell(usdCell);
  const tmt = tmtCell === '' ? undefined : parsePriceCell(tmtCell);
  if (usdCell !== '' && usd == null)
    return { error: `invalid USD price "${usdCell}"` };
  if (tmtCell !== '' && tmt == null)
    return { error: `invalid TMT price "${tmtCell}"` };
  if (usd != null && tmt != null) {
    return {
      usd: String(parsePrice(String(usd))),
      tmt: String(parsePrice(String(tmt))),
    };
  }
  if (rate == null || rate <= 0) {
    return {
      error: 'dollar rate not found, cannot convert between USD and TMT',
    };
  }
  if (usd != null) {
    return {
      usd: String(parsePrice(String(usd))),
      tmt: String(Math.ceil(usd * rate)),
    };
  }
  return {
    usd: String(parsePrice(String((tmt as number) / rate))),
    tmt: String(parsePrice(String(tmt))),
  };
}

export interface CurrentProductState {
  name: string;
  price: string | null;
  tags: string[];
  brandId: string | null;
}

// Pure planner: validates one product row (+ its variant rows) and returns either
// row errors (whole product rejected) or the DB operations to apply. No DB access.
export function planProductUpdate(
  productRow: ImportProductRow,
  variantRows: ImportVariantRow[] | undefined,
  currentProduct: CurrentProductState,
  refs: PlanRefs,
): ProductUpdatePlan {
  const errors: BulkRowError[] = [];
  const productError = (message: string) =>
    errors.push({ sheet: 'Products', row: productRow.row, message });

  const data: NonNullable<ProductUpdatePlan['data']> = {};

  // locale name blob merge; empty cells leave that locale unchanged
  let currentName: Record<string, string> = {};
  try {
    const parsed = JSON.parse(currentProduct.name);
    if (parsed != null && typeof parsed === 'object') currentName = parsed;
  } catch {
    // legacy non-JSON name; treated as an empty locale blob
  }
  const mergedName = { ...currentName };
  let nameChanged = false;
  NAME_FIELDS.forEach(([field, locale]) => {
    const value = cellText(productRow[field]);
    if (value !== '' && value !== mergedName[locale]) {
      mergedName[locale] = value;
      nameChanged = true;
    }
  });
  if (nameChanged) data.name = JSON.stringify(mergedName);
  const englishName = cellText(mergedName.en);

  const categorySlug = cellText(productRow.categorySlug);
  if (categorySlug !== '') {
    const categoryId = refs.categoryIdBySlug.get(categorySlug.toLowerCase());
    if (categoryId == null)
      productError(`unknown category slug "${categorySlug}"`);
    else data.categoryId = categoryId;
  }

  const brandName = cellText(productRow.brand);
  if (brandName !== '') {
    const brandId = refs.brandIdByLowerName.get(brandName.toLowerCase());
    if (brandId == null) productError(`unknown brand "${brandName}"`);
    else data.brandId = brandId;
  }

  const outOfStock = cellText(productRow.outOfStock);
  if (outOfStock !== '') {
    const parsed = parseBoolCell(outOfStock);
    if (parsed == null)
      productError(`invalid Out of Stock value "${outOfStock}"`);
    else data.isOutOfStock = parsed;
  }

  const videoUrls = cellText(productRow.videoUrls);
  if (videoUrls !== '') {
    data.videoUrls = videoUrls
      .split('|')
      .map((url) => url.trim())
      .filter((url) => url !== '');
  }

  let basePrice: ProductUpdatePlan['basePrice'];
  const baseResolved = resolvePriceCells(
    cellText(productRow.priceUsd),
    cellText(productRow.priceTmt),
    refs.rate,
  );
  if (baseResolved != null) {
    if ('error' in baseResolved) {
      productError(baseResolved.error);
    } else {
      // [id] format or raw id; no ref at all -> create a Prices row on apply
      const existingPriceId =
        currentProduct.price?.match(squareBracketRegex)?.[1] ??
        (currentProduct.price || undefined);
      basePrice = {
        priceId: existingPriceId,
        name: englishName,
        ...baseResolved,
      };
      data.cachedPrice = parseFloat(baseResolved.usd);
    }
  }

  let tags: PlannedVariant[] | undefined;
  if (variantRows != null) {
    const existingBySpec = new Map(
      currentProduct.tags.map((tag) => {
        const parsed = parseVariantTag(tag);
        return [parsed.specText, parsed] as const;
      }),
    );

    tags = [];
    const seenSpecs = new Set<string>();
    variantRows.forEach((variantRow) => {
      const rowError = (message: string) =>
        errors.push({ sheet: 'Variants', row: variantRow.row, message });

      const spec = cellText(variantRow.spec).replace(/\s+/g, ' ');
      if (spec === '') {
        rowError('empty variant spec');
        return;
      }
      if (seenSpecs.has(spec)) {
        rowError(`duplicate variant spec "${spec}"`);
        return;
      }
      seenSpecs.add(spec);

      let colorId: string | undefined;
      const colorName = cellText(variantRow.color);
      if (colorName !== '') {
        colorId = refs.colorIdByLowerName.get(colorName.toLowerCase());
        if (colorId == null) {
          rowError(`unknown color "${colorName}"`);
          return;
        }
      }

      const resolved = resolvePriceCells(
        cellText(variantRow.priceUsd),
        cellText(variantRow.priceTmt),
        refs.rate,
      );
      let price: PlannedPrice | undefined;
      if (resolved != null) {
        if ('error' in resolved) {
          rowError(resolved.error);
          return;
        }
        price = { name: `${englishName} ${spec}`.trim(), ...resolved };
      }

      tags!.push({
        spec,
        colorId,
        priceId: existingBySpec.get(spec)?.priceId,
        price,
      });
    });
  }

  if (errors.length > 0) return { errors };
  return { errors, data, basePrice, tags };
}

// ---------- GET export ----------

async function handleExport(res: NextApiResponse<ResponseApi>) {
  const [products, prices, colors, rateRow] = await Promise.all([
    dbClient.product.findMany({
      where: whereActiveProduct,
      include: { brand: true, categories: { select: { slug: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    dbClient.prices.findMany(),
    dbClient.color.findMany(),
    dbClient.dollarRate.findFirst({ where: { currency: 'TMT' } }),
  ]);
  const pricesById = new Map(prices.map((price) => [price.id, price]));
  const colorsById = new Map(colors.map((color) => [color.id, color]));

  const productRows: BulkProductExportRow[] = [];
  const variantRows: BulkVariant[] = [];
  products.forEach((product) => {
    let name: Record<string, string> = {};
    try {
      const parsed = JSON.parse(product.name);
      if (parsed != null && typeof parsed === 'object') name = parsed;
    } catch {
      // legacy non-JSON name
    }
    const basePriceId =
      product.price?.match(squareBracketRegex)?.[1] ?? product.price;
    const basePrice = basePriceId ? pricesById.get(basePriceId) : undefined;

    productRows.push({
      id: product.id,
      slug: product.slug,
      nameEn: name.en ?? '',
      nameTk: name.tk ?? '',
      nameRu: name.ru ?? '',
      nameCh: name.ch ?? '',
      nameTr: name.tr ?? '',
      categorySlug: product.categories?.slug ?? '',
      brand: product.brand?.name ?? '',
      priceUsd: basePrice?.price ?? '',
      priceTmt: basePrice?.priceInTmt ?? '',
      isOutOfStock: product.isOutOfStock,
      videoUrls: product.videoUrls.join(' | '),
    });

    product.tags.forEach((tag) => {
      const { specText, priceId, colorId } = parseVariantTag(tag);
      const variantPrice = priceId ? pricesById.get(priceId) : undefined;
      variantRows.push({
        productId: product.id,
        productName: name.en ?? '',
        spec: specText,
        priceUsd: variantPrice?.price ?? '',
        priceTmt: variantPrice?.priceInTmt ?? '',
        color: colorId ? colorsById.get(colorId)?.name ?? '' : '',
      });
    });
  });

  return res.status(200).json({
    success: true,
    data: {
      products: productRows,
      variants: variantRows,
      rate: rateRow?.rate ?? null,
    },
  });
}

// ---------- POST import ----------

async function syncCachedPrice(priceId: string, usd: number) {
  // Fan out to every product referencing this Prices row (raw id or [id] format).
  await dbClient.product.updateMany({
    where: {
      deletedAt: null,
      OR: [{ price: priceId }, { price: { contains: `[${priceId}]` } }],
    },
    data: { cachedPrice: usd },
  });
}

async function applyProductPlan(
  target: Product,
  plan: ProductUpdatePlan,
  brandsToSync: Set<string>,
) {
  const data: Prisma.ProductUncheckedUpdateInput = { ...plan.data };
  const updatedPrices: { id: string; usd: number }[] = [];

  if (plan.basePrice != null) {
    const { priceId, name, usd, tmt } = plan.basePrice;
    if (priceId != null) {
      await dbClient.prices.update({
        where: { id: priceId },
        data: { price: usd, priceInTmt: tmt },
      });
      updatedPrices.push({ id: priceId, usd: parseFloat(usd) });
    } else {
      const created = await dbClient.prices.create({
        data: { name, price: usd, priceInTmt: tmt },
      });
      data.price = `[${created.id}]`;
    }
  }

  if (plan.tags != null) {
    const builtTags: string[] = [];
    for (let i = 0; i < plan.tags.length; i += 1) {
      const variant = plan.tags[i];
      let { priceId } = variant;
      if (variant.price != null) {
        if (priceId != null) {
          // eslint-disable-next-line no-await-in-loop
          await dbClient.prices.update({
            where: { id: priceId },
            data: { price: variant.price.usd, priceInTmt: variant.price.tmt },
          });
          updatedPrices.push({
            id: priceId,
            usd: parseFloat(variant.price.usd),
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          const created = await dbClient.prices.create({
            data: {
              name: variant.price.name,
              price: variant.price.usd,
              priceInTmt: variant.price.tmt,
            },
          });
          priceId = created.id;
        }
      }
      builtTags.push(
        `${variant.spec}${priceId ? ` [${priceId}]` : ''}${
          variant.colorId ? `{${variant.colorId}}` : ''
        }`,
      );
    }
    data.tags = builtTags;
    data.colors = {
      set: deriveVariantColumns(builtTags).colors.map((id) => ({ id })),
    };
  }

  const updated = await dbClient.product.update({
    where: { id: target.id },
    data,
  });

  for (let i = 0; i < updatedPrices.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await syncCachedPrice(updatedPrices[i].id, updatedPrices[i].usd);
  }

  if (updated.brandId !== target.brandId) {
    if (target.brandId) brandsToSync.add(target.brandId);
    if (updated.brandId) brandsToSync.add(updated.brandId);
  }
}

async function handleImport(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  const parsedBody = bulkImportBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid request body' });
  }
  const {
    products: productRows,
    variants: allVariantRows,
    hasVariantsSheet,
  } = parsedBody.data;

  const ids = productRows.map((row) => row.id);
  const [categories, brands, colors, rateRow, targets] = await Promise.all([
    dbClient.category.findMany({
      where: whereActiveCategory,
      select: { id: true, slug: true },
    }),
    dbClient.brand.findMany({ select: { id: true, name: true } }),
    dbClient.color.findMany({ select: { id: true, name: true } }),
    dbClient.dollarRate.findFirst({ where: { currency: 'TMT' } }),
    dbClient.product.findMany({
      where: { ...whereActiveProduct, id: { in: ids } },
    }),
  ]);

  const refs: PlanRefs = {
    categoryIdBySlug: new Map(
      categories.map((category) => [category.slug.toLowerCase(), category.id]),
    ),
    brandIdByLowerName: new Map(
      brands.map((brand) => [brand.name.toLowerCase(), brand.id]),
    ),
    colorIdByLowerName: new Map(
      colors.map((color) => [color.name.toLowerCase(), color.id]),
    ),
    rate: rateRow?.rate ?? null,
  };
  const targetById = new Map(targets.map((product) => [product.id, product]));

  const idCounts = new Map<string, number>();
  ids.forEach((id) => idCounts.set(id, (idCounts.get(id) ?? 0) + 1));

  const variantsByProduct = new Map<string, ImportVariantRow[]>();
  const errors: BulkRowError[] = [];
  const productSheetIds = new Set(ids);
  allVariantRows.forEach((row) => {
    if (!productSheetIds.has(row.productId)) {
      errors.push({
        sheet: 'Variants',
        row: row.row,
        message: `product ID "${row.productId}" not found in Products sheet`,
      });
      return;
    }
    const list = variantsByProduct.get(row.productId) ?? [];
    list.push(row);
    variantsByProduct.set(row.productId, list);
  });

  let updatedCount = 0;
  const brandsToSync = new Set<string>();

  for (let i = 0; i < productRows.length; i += 1) {
    const productRow = productRows[i];
    const target = targetById.get(productRow.id);
    if ((idCounts.get(productRow.id) ?? 0) > 1) {
      errors.push({
        sheet: 'Products',
        row: productRow.row,
        message: `duplicate product ID "${productRow.id}"`,
      });
    } else if (target == null) {
      errors.push({
        sheet: 'Products',
        row: productRow.row,
        message: `unknown or deleted product ID "${productRow.id}"`,
      });
    } else {
      const plan = planProductUpdate(
        productRow,
        hasVariantsSheet
          ? variantsByProduct.get(productRow.id) ?? []
          : undefined,
        target,
        refs,
      );
      if (plan.errors.length > 0) {
        errors.push(...plan.errors);
      } else {
        try {
          // eslint-disable-next-line no-await-in-loop
          await applyProductPlan(target, plan, brandsToSync);
          updatedCount += 1;
        } catch (error) {
          console.error(filepath, error);
          errors.push({
            sheet: 'Products',
            row: productRow.row,
            message: 'failed to apply update',
          });
        }
      }
    }
  }

  await Promise.all(
    [...brandsToSync].map((brandId) => syncBrandProductCount(brandId)),
  );

  const result: BulkImportResult = { updatedCount, errors };
  return res.status(200).json({ success: true, data: result });
}

// ---------- handler ----------

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  if (!(await requireStaffBearerAuth(req, res))) return;

  const { method } = req;
  try {
    if (method === 'GET') {
      await handleExport(res);
      return;
    }
    if (method === 'POST') {
      await handleImport(req, res);
      return;
    }
  } catch (error) {
    console.error(filepath, error);
    res.status(500).json({ success: false, message: 'Bulk operation failed' });
    return;
  }

  console.error(`${filepath}: Method not allowed`);
  res.status(405).json({ success: false, message: 'Method not allowed' });
}
