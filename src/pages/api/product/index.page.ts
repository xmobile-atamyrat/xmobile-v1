import dbClient from '@/lib/dbClient';
import { syncBrandProductCount } from '@/lib/brandProductCount';
import {
  initialOutOfStockFields,
  outOfStockCascade,
  setProductOutOfStock,
  syncProductOutOfStockFromPrices,
} from '@/lib/outOfStock';
import { recordPricesUpdated } from '@/lib/priceActivity';
import { inStockFirst } from '@/lib/prismaActiveScope';
import {
  lockRecommendedList,
  RecommendedChange,
  RecommendedListFullError,
  recommendedListIsFull,
  setProductRecommended,
} from '@/lib/recommendedProducts';
import {
  hasPriceLinkConflict,
  PRICE_TAKEN_MESSAGE,
  PriceLinkConflictError,
  reconcileProductPriceLinks,
  ownedPriceIds,
} from '@/lib/productPriceLinks';
import {
  recordProductCreated,
  recordProductDeleted,
  recordProductUpdated,
} from '@/lib/productActivity';
import {
  applyImageOrder,
  fileToken,
  parseImageOrder,
} from '@/lib/productImageOrder';
import { revalidateInBackground } from '@/lib/revalidate';
import {
  categoryListingPaths,
  productRevalidationPaths,
} from '@/lib/revalidateTargets';
import { getPrice } from '@/pages/api/prices/index.page';
import {
  buildProductWhere,
  ProductFilterQuery,
  ProductWhereOptions,
} from '@/pages/api/product/productWhere';
import addCors from '@/pages/api/utils/addCors';
import {
  hasStaffBearer,
  requireStaffBearerAuth,
} from '@/pages/api/utils/staffAuth';
import {
  IMG_COMPRESSION_MAX_QUALITY,
  IMG_COMPRESSION_MIN_QUALITY,
  IMG_COMPRESSION_OPTIONS,
  PRODUCTS_PER_PAGE,
  RECOMMENDED_FULL_MESSAGE,
  SORT_OPTIONS,
  localeOptions,
} from '@/pages/lib/constants';
import { isRemoteImageUrl } from '@/pages/lib/mediaUrls';
import { ExtendedProduct, ResponseApi, SortOption } from '@/pages/lib/types';
import {
  cachedPriceFrom,
  displayPriceOf,
  displayPriceOrNull,
} from '@/pages/lib/priceDisplay';
import { parseVariantTag } from '@/pages/product/utils';
import {
  sanitizeProductLocale,
  sanitizeProductsLocale,
  slugify,
} from '@/pages/lib/utils';
import { Prisma, Product } from '@prisma/client';
import fs from 'fs';
import multiparty from 'multiparty';
import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: false,
  },
};

const filepath = 'src/pages/api/product/index.page.ts';
const productsPerPage = PRODUCTS_PER_PAGE;

// Derives the colors filter column from variant tags (referenced colorIds).
export function deriveVariantColumns(tags: string[]): { colors: string[] } {
  const colors = new Set<string>();
  tags.forEach((tag) => {
    const { colorId } = parseVariantTag(tag);
    if (colorId) colors.add(colorId);
  });
  return { colors: [...colors] };
}

async function brandFieldError(
  brandId: string | undefined,
): Promise<'brandRequired' | 'brandNotFound' | null> {
  if (!brandId) return 'brandRequired';
  const brand = await dbClient.brand.findUnique({
    where: { id: brandId },
    select: { id: true },
  });
  return brand ? null : 'brandNotFound';
}

type PriceLinkChange = Awaited<
  ReturnType<typeof reconcileProductPriceLinks>
>[number];

interface CreateProductReturnType {
  success: boolean;
  message?: string;
  status: number;
  data?: Product;
  /**
   * Edit only. The category the product sat in before the edit — moving a
   * product between categories changes the listing page it left as well as the
   * one it joined, and only the form parser still has the pre-update row.
   */
  previousCategoryId?: string | null;
  /** Edit only. The row as it was before the edit, for the activity log. */
  previous?: Product;
  /** Prices whose owner the save moved, for the activity log. */
  priceLinkChanges?: PriceLinkChange[];
  /** Edit only. How the save moved the product on the recommended list. */
  recommendedChange?: RecommendedChange | null;
}

// changes url from images/products/img -> images/compressed/products/img
export function createCompressedImgUrl(
  imgUrl: string,
  type: 'bad' | 'good',
): string | null {
  // A pasted external URL has no file on disk, so no compressed copy either.
  if (isRemoteImageUrl(imgUrl)) return null;

  // Windows uses '\' in path format, replace it with '/'
  const normalizedUrl = imgUrl.replace(/\\/g, '/');
  const imgName = path.basename(imgUrl);

  if (!normalizedUrl.includes('products/')) {
    console.error(
      filepath,
      "incorrect imgUrl, products folder doesn't exist in image path: ",
      imgUrl,
    );
  }

  return `${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/${imgName}`;
}

/** Removes a product image and its compressed copies from disk. */
export function deleteProductImageFiles(imgUrl: string) {
  if (isRemoteImageUrl(imgUrl)) return;
  [
    imgUrl,
    createCompressedImgUrl(imgUrl, 'bad'),
    createCompressedImgUrl(imgUrl, 'good'),
  ].forEach((file) => {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  });
}

export async function createCompressedImg(
  imgUrl: string,
  type: 'bad' | 'good',
): Promise<Buffer> | null {
  if (imgUrl != null && fs.existsSync(imgUrl)) {
    try {
      if (
        !fs.existsSync(`${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/`)
      ) {
        fs.mkdirSync(`${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/`, {
          recursive: true,
        });
      }
      const img = fs.readFileSync(imgUrl);
      let compressedImg: Buffer = img;

      const targetUrl = createCompressedImgUrl(imgUrl, type);
      const targetSize = IMG_COMPRESSION_OPTIONS[type].size;
      const targetWidth =
        IMG_COMPRESSION_OPTIONS[type].width === 0
          ? null
          : IMG_COMPRESSION_OPTIONS[type].width;
      let quality = IMG_COMPRESSION_MAX_QUALITY;

      while (
        compressedImg.length > targetSize &&
        quality > IMG_COMPRESSION_MIN_QUALITY
      ) {
        compressedImg = await sharp(img)
          .resize({ width: targetWidth })
          // JPEG has no alpha; without this, transparent pixels turn black.
          .flatten({ background: '#ffffff' })
          .jpeg({ quality, progressive: true })
          .toBuffer();
        quality -= 10;
      }
      fs.writeFileSync(targetUrl, new Uint8Array(compressedImg));

      return compressedImg;
    } catch (error) {
      console.error(filepath, 'function createCompressedImg:', error);
      return null;
    }
  } else {
    console.error(filepath, `image not found: ${imgUrl}`);
    return null;
  }
}

// Kept images, then pasted URLs, then uploads, rearranged by the admin's
// `imageOrder`. Uploads arrive as `imageUrl<N>` fields; the client refers to
// them as `file:<N>` since it can't know where they land on disk.
function orderedImgUrls(
  keptImgUrls: string[],
  fields: Record<string, string[]>,
  files: Record<string, { path: string }[]>,
): string[] {
  const pastedUrls: string[] = fields.imageUrls
    ? JSON.parse(fields.imageUrls[0])
    : [];
  return applyImageOrder(
    [
      ...[...keptImgUrls, ...pastedUrls].map((imgPath) => ({
        token: imgPath,
        path: imgPath,
      })),
      ...Object.keys(files).map((key) => ({
        token: fileToken(Number(key.slice('imageUrl'.length))),
        path: files[key][0].path,
      })),
    ],
    parseImageOrder(fields.imageOrder?.[0]),
  );
}

async function createProduct(
  req: NextApiRequest,
): Promise<CreateProductReturnType> {
  const form = new multiparty.Form({
    uploadDir: process.env.PRODUCT_IMAGES_DIR,
    maxFilesSize: 1024 * 1024 * 10, // 10MB max size
  });
  const promise: Promise<CreateProductReturnType> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
        return;
      }

      const fileKeys = Object.keys(files);
      fileKeys.forEach(async (key) => {
        const imgUrl = files[key][0].path;

        await createCompressedImg(imgUrl, 'bad');
        await createCompressedImg(imgUrl, 'good');
      });

      const categoryOk = await dbClient.category.findFirst({
        where: { id: fields.categoryId[0], deletedAt: null },
      });
      if (!categoryOk) {
        resolve({
          success: false,
          message: 'Category not found',
          status: 404,
        });
        return;
      }

      const brandError = await brandFieldError(fields.brandId?.[0]);
      if (brandError) {
        resolve({ success: false, message: brandError, status: 400 });
        return;
      }

      const parsedName = JSON.parse(fields.name?.[0] ?? '{}');
      const productEnglishName = parsedName?.en;

      if (!productEnglishName || productEnglishName.trim() === '') {
        resolve({
          success: false,
          message: 'englishNameRequired',
          status: 400,
        });
        return;
      }

      const productSlug = slugify(productEnglishName);
      if (!productSlug) {
        resolve({
          success: false,
          message: 'invalidSlugError',
          status: 400,
        });
        return;
      }

      if (productSlug.length > 80) {
        resolve({
          success: false,
          message: 'slugTooLongError',
          status: 400,
        });
        return;
      }

      const existingProduct = await dbClient.product.findUnique({
        where: { slug: productSlug },
      });
      if (existingProduct) {
        resolve({
          success: false,
          message: 'duplicateProductError',
          status: 400,
        });
        return;
      }

      // The form always posts `price`, empty when no base price was picked.
      const basePrice = fields.price?.[0] || null;
      const basePriceRow = await getPrice(basePrice);
      const cachedPrice = cachedPriceFrom(basePriceRow);
      const productTags: string[] = fields.tags
        ? JSON.parse(fields.tags[0])
        : [];
      const variantColumns = deriveVariantColumns(productTags);

      const linkedPriceIds = ownedPriceIds(basePrice, productTags);
      if (await hasPriceLinkConflict(dbClient, null, [], linkedPriceIds)) {
        resolve({ success: false, message: PRICE_TAKEN_MESSAGE, status: 409 });
        return;
      }

      const wantsRecommended = fields.isRecommended?.[0] === 'true';
      if (wantsRecommended && (await recommendedListIsFull(dbClient))) {
        resolve({
          success: false,
          message: RECOMMENDED_FULL_MESSAGE,
          status: 400,
        });
        return;
      }

      let product: Product;
      let priceLinkChanges: PriceLinkChange[];
      try {
        [product, priceLinkChanges] = await dbClient.$transaction(
          async (tx) => {
            if (wantsRecommended) await lockRecommendedList(tx);
            let created = await tx.product.create({
              data: {
                name: fields.name[0],
                slug: productSlug,
                categoryId: fields.categoryId[0],
                brandId: fields.brandId[0],
                description: fields.description?.[0],
                tags: productTags,
                colors: {
                  connect: variantColumns.colors.map((id) => ({ id })),
                },
                videoUrls: fields.videoUrls
                  ? JSON.parse(fields.videoUrls[0])
                  : [],
                imgUrls: orderedImgUrls([], fields, files),
                price: basePrice,
                cachedPrice,
                // A product can be created already sold out. The timestamp
                // travels with the flag so the retention job, which ignores
                // rows without one, can see it from day one.
                ...initialOutOfStockFields(fields.isOutOfStock?.[0] === 'true'),
              },
            });
            if (wantsRecommended) {
              await setProductRecommended(tx, created.id, true);
              created = await tx.product.findUniqueOrThrow({
                where: { id: created.id },
              });
            }
            return [
              created,
              await reconcileProductPriceLinks(
                tx,
                created.id,
                [],
                linkedPriceIds,
              ),
            ];
          },
        );
      } catch (error) {
        if (error instanceof RecommendedListFullError) {
          resolve({
            success: false,
            message: RECOMMENDED_FULL_MESSAGE,
            status: 400,
          });
          return;
        }
        if (!(error instanceof PriceLinkConflictError)) throw error;
        resolve({ success: false, message: PRICE_TAKEN_MESSAGE, status: 409 });
        return;
      }

      // The claimed prices start out with their own stock state. A product
      // created sold out pushes its state down onto them; otherwise its state
      // is derived from them, as for any other change of ownership.
      if (priceLinkChanges.length > 0) {
        if (product.outOfStockAt != null) {
          await setProductOutOfStock(product.id, true);
        } else {
          await syncProductOutOfStockFromPrices(product.id);
        }
        product = await dbClient.product.findUniqueOrThrow({
          where: { id: product.id },
        });
      }

      if (product.brandId) {
        await syncBrandProductCount(product.brandId);
      }
      resolve({ success: true, data: product, status: 200, priceLinkChanges });
    });
  });
  const res = await promise;
  return res;
}

async function getProduct(
  productId?: string,
  productSlug?: string,
): Promise<ExtendedProduct | null> {
  if (!productId && !productSlug) return null;
  const product = await dbClient.product.findFirst({
    where: {
      ...(productSlug ? { slug: productSlug } : { id: productId }),
      deletedAt: null,
    },
    include: { brand: true },
  });

  // product.price = [id]{value}
  const productPrice = await getPrice(product?.price as string);
  if (product) {
    // `?? undefined` keeps the dangling-reference shape: a missing price has
    // always interpolated as "{undefined}", and the PDP keys off that text.
    product.price = `${product?.price}{${
      displayPriceOrNull(productPrice) ?? undefined
    }}`;
  }

  return product;
}

async function handleGetProduct(
  query: ProductFilterQuery & {
    productId?: string;
    productSlug?: string;
    page?: string;
    sortBy?: SortOption;
    count?: string;
    facets?: string;
    locale?: string | string[];
    limit?: string;
  },
  whereOptions: ProductWhereOptions = {},
): Promise<{ resp: ResponseApi; status: number }> {
  const { productId, productSlug, page, sortBy, count, facets, locale, limit } =
    query;
  // count=true returns the total number of matches for the filter set
  // (reusing the same where-building) instead of a page of products.
  const wantCount = count === 'true';
  // facets=categories returns the per-category breakdown of the same match set
  // — one groupBy instead of a count request per category. Callers wanting a
  // usable facet list omit categoryIds, so every category in the result set is
  // still represented once one of them is selected.
  const wantCategoryFacets = facets === 'categories';
  // Opt-in response localization: without a valid `locale`, responses keep the
  // raw multi-locale JSON blobs (admin edit flows depend on receiving them).
  const activeLocale =
    typeof locale === 'string' && localeOptions.includes(locale)
      ? locale
      : undefined;
  const parsedPage = parseInt(page || '1', 10);
  // Home sections ask for only the cards they show rather than a full page.
  const parsedLimit = parseInt(limit || '', 10);
  const pageSize =
    parsedLimit >= 1 && parsedLimit <= productsPerPage
      ? parsedLimit
      : productsPerPage;
  const skip = (parsedPage - 1) * pageSize;

  if (
    productId != null &&
    (typeof productId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(productId))
  ) {
    return {
      resp: { success: false, message: 'Invalid product ID format' },
      status: 400,
    };
  }
  if (productSlug != null && typeof productSlug !== 'string') {
    return {
      resp: { success: false, message: 'Invalid product slug format' },
      status: 400,
    };
  }

  if (productId != null || productSlug != null) {
    const product = await getProduct(
      productId as string,
      productSlug as string,
    );

    if (product == null) {
      console.warn(
        filepath,
        'Product not found',
        `Method: GET`,
        `productId: ${productId}`,
      );
      return {
        resp: { success: false, message: "Couldn't find the product" },
        status: 404,
      };
    }

    return {
      resp: {
        success: true,
        data: activeLocale
          ? sanitizeProductLocale(product, activeLocale)
          : product,
      },
      status: 200,
    };
  }

  const where = await buildProductWhere(query, whereOptions);
  if (where == null) {
    return {
      resp: { success: true, data: wantCount ? 0 : [] },
      status: 200,
    };
  }

  if (wantCount) {
    const total = await dbClient.product.count({ where });
    return { resp: { success: true, data: total }, status: 200 };
  }

  if (wantCategoryFacets) {
    const grouped = await dbClient.product.groupBy({
      by: ['categoryId'],
      where,
      // `true` rather than `{ _all: true }` so the row carries a plain number.
      _count: true,
    });
    // Leaf-level counts; the caller rolls them up to whichever level it shows
    // (the category tree is already in CategoryContext client-side).
    return {
      resp: {
        success: true,
        data: grouped.map((row) => ({
          categoryId: row.categoryId,
          // _count is Prisma's own groupBy result shape, not our naming.
          // eslint-disable-next-line no-underscore-dangle
          count: row._count,
        })),
      },
      status: 200,
    };
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    inStockFirst,
    { createdAt: 'desc' },
  ]; // default
  if (sortBy) {
    switch (sortBy) {
      case SORT_OPTIONS.PRICE_ASC:
        orderBy = [inStockFirst, { cachedPrice: 'asc' }];
        break;
      case SORT_OPTIONS.PRICE_DESC:
        orderBy = [inStockFirst, { cachedPrice: 'desc' }];
        break;
      case SORT_OPTIONS.A_Z:
        orderBy = [inStockFirst, { name: 'asc' }];
        break;
      case SORT_OPTIONS.NEWEST:
        orderBy = [inStockFirst, { createdAt: 'desc' }];
        break;
      // The admin-picked order first, then everything else newest first, so
      // the "view all" listing continues past the picks instead of ending.
      case SORT_OPTIONS.RECOMMENDED:
        orderBy = [
          inStockFirst,
          { recommendedOrder: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ];
        break;
      default:
        break;
    }
  }

  const products = await dbClient.product.findMany({
    where,
    orderBy,
    skip,
    take: pageSize,
    include: { brand: true },
  });

  const productsWithDisplayPrice = await Promise.all(
    products.map(async (product) => {
      const productPrice = await getPrice(product.price as string);
      if (productPrice) {
        product.price = `${product.price}{${displayPriceOf(productPrice)}}`;
      }
      return product;
    }),
  );

  return {
    resp: {
      success: true,
      data: activeLocale
        ? sanitizeProductsLocale(productsWithDisplayPrice, activeLocale)
        : productsWithDisplayPrice,
    },
    status: 200,
  };
}

async function handleEditProduct(
  req: NextApiRequest,
): Promise<CreateProductReturnType> {
  const { productId } = req.query;
  const form = new multiparty.Form({
    uploadDir: process.env.PRODUCT_IMAGES_DIR,
    maxFilesSize: 1024 * 1024 * 10, // 10MB max size
  });
  const promise: Promise<CreateProductReturnType> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
      }

      const data: Partial<Product> = { imgUrls: [] };
      let colorsUpdate: Prisma.ProductUpdateInput['colors'];
      if (fields.categoryId?.[0]) {
        data.categoryId = fields.categoryId[0];
      }
      if (fields.name?.length > 0) {
        data.name = fields.name[0];
      }
      if (fields.description?.length > 0) {
        data.description = fields.description[0];
      }
      if (fields.price?.length > 0) {
        // Empty clears the base price; the form always posts the field.
        data.price = fields.price[0] || null;
        const basePriceRow = await getPrice(data.price);
        data.cachedPrice = cachedPriceFrom(basePriceRow);
      }
      if (fields.brandId?.length > 0) {
        const brandError = await brandFieldError(fields.brandId[0]);
        if (brandError) {
          resolve({ success: false, message: brandError, status: 400 });
          return;
        }
        data.brandId = fields.brandId[0];
      }
      if (fields.tags?.length > 0) {
        const editTags: string[] = JSON.parse(fields.tags[0]);
        data.tags = editTags;
        colorsUpdate = {
          set: deriveVariantColumns(editTags).colors.map((id) => ({ id })),
        };
      }
      if (fields.videoUrls?.length > 0) {
        data.videoUrls = JSON.parse(fields.videoUrls[0]);
      }
      // Not folded into `data`: out-of-stock has to cascade to the product's
      // connected prices and stamp `outOfStockAt` only on a real transition,
      // both of which setProductOutOfStock owns. Applied after the main update,
      // and only when the flag really moved — the form posts this field on
      // every save, so its presence says nothing about the admin's intent.
      let requestedOutOfStock: boolean | undefined;
      if (fields.isOutOfStock?.length > 0) {
        requestedOutOfStock = fields.isOutOfStock[0] === 'true';
      }
      // Optional, unlike the stock flag: the form only posts it when the admin
      // flipped the switch, so a stale prefill can't undo a change made on the
      // recommended screen in the meantime.
      let requestedRecommended: boolean | undefined;
      if (fields.isRecommended?.length > 0) {
        requestedRecommended = fields.isRecommended[0] === 'true';
      }

      const currProduct = await dbClient.product.findFirst({
        where: {
          id: productId as string,
          deletedAt: null,
        },
      });
      if (currProduct == null) {
        console.error(
          filepath,
          'Product not found',
          `Method: PUT`,
          `productId: ${productId}`,
        );
        resolve({ success: false, message: 'Product not found', status: 404 });
        return;
      }

      const outOfStockUpdate = outOfStockCascade(
        requestedOutOfStock,
        currProduct.outOfStockAt != null,
      );

      // Checked before the image files below are deleted; the transaction
      // re-checks under the list lock.
      if (
        requestedRecommended === true &&
        currProduct.recommendedOrder == null &&
        (await recommendedListIsFull(dbClient))
      ) {
        resolve({
          success: false,
          message: RECOMMENDED_FULL_MESSAGE,
          status: 400,
        });
        return;
      }

      // Ownership is only reconciled when the save carries the references it
      // follows. The products overview posts category/brand/stock alone, and
      // must not release prices on a product whose references it never saw.
      const priceLinksTouched = data.price !== undefined || data.tags != null;
      const previousPriceIds = ownedPriceIds(
        currProduct.price,
        currProduct.tags,
      );
      const nextPriceIds = ownedPriceIds(
        data.price !== undefined ? data.price : currProduct.price,
        data.tags ?? currProduct.tags,
      );
      // Checked before the image files below are deleted, which no rollback
      // can bring back.
      if (
        priceLinksTouched &&
        (await hasPriceLinkConflict(
          dbClient,
          currProduct.id,
          previousPriceIds,
          nextPriceIds,
        ))
      ) {
        resolve({ success: false, message: PRICE_TAKEN_MESSAGE, status: 409 });
        return;
      }

      const deleteImageUrls = fields.deleteImageUrls
        ? JSON.parse(fields.deleteImageUrls[0])
        : [];
      currProduct?.imgUrls.forEach((imgUrl: string) => {
        if (deleteImageUrls.includes(imgUrl)) {
          deleteProductImageFiles(imgUrl);
        } else {
          data.imgUrls!.push(imgUrl);
        }
      });

      const fileKeys = Object.keys(files);
      fileKeys.forEach(async (key) => {
        const imgUrl = files[key][0].path;
        await createCompressedImg(imgUrl, 'bad');
        await createCompressedImg(imgUrl, 'good');
      });

      data.imgUrls = orderedImgUrls(data.imgUrls!, fields, files);

      if (data.categoryId) {
        const catOk = await dbClient.category.findFirst({
          where: { id: data.categoryId, deletedAt: null },
        });
        if (!catOk) {
          resolve({
            success: false,
            message: 'Category not found',
            status: 404,
          });
          return;
        }
      }

      let product: Product;
      let priceLinkChanges: PriceLinkChange[];
      let recommendedChange: RecommendedChange | null;
      try {
        [product, priceLinkChanges, recommendedChange] =
          await dbClient.$transaction(async (tx) => {
            if (requestedRecommended != null) await lockRecommendedList(tx);
            let updated = await tx.product.update({
              where: {
                id: productId as string,
              },
              data: { ...data, ...(colorsUpdate && { colors: colorsUpdate }) },
            });
            const movedOnList =
              requestedRecommended == null
                ? null
                : await setProductRecommended(
                    tx,
                    updated.id,
                    requestedRecommended,
                  );
            if (movedOnList != null) {
              updated = await tx.product.findUniqueOrThrow({
                where: { id: updated.id },
              });
            }
            return [
              updated,
              priceLinksTouched
                ? await reconcileProductPriceLinks(
                    tx,
                    updated.id,
                    previousPriceIds,
                    nextPriceIds,
                  )
                : [],
              movedOnList,
            ];
          });
      } catch (error) {
        if (error instanceof RecommendedListFullError) {
          resolve({
            success: false,
            message: RECOMMENDED_FULL_MESSAGE,
            status: 400,
          });
          return;
        }
        if (!(error instanceof PriceLinkConflictError)) throw error;
        resolve({ success: false, message: PRICE_TAKEN_MESSAGE, status: 409 });
        return;
      }

      // Runs after the reconcile, so a cascade reaches exactly the prices the
      // product owns once this save lands. Without one, a change of ownership
      // re-derives the product the same way PUT /api/prices does.
      if (outOfStockUpdate != null) {
        await setProductOutOfStock(product.id, outOfStockUpdate);
      } else if (priceLinkChanges.length > 0) {
        await syncProductOutOfStockFromPrices(product.id);
      }
      if (outOfStockUpdate != null || priceLinkChanges.length > 0) {
        // Re-read so the response carries the flag and timestamp the cascade
        // settled on rather than the pre-cascade row.
        product = await dbClient.product.findUniqueOrThrow({
          where: { id: product.id },
        });
      }

      if (currProduct.brandId) {
        await syncBrandProductCount(currProduct.brandId);
      }
      if (product.brandId && product.brandId !== currProduct.brandId) {
        await syncBrandProductCount(product.brandId);
      }

      resolve({
        success: true,
        data: product,
        status: 200,
        previousCategoryId: currProduct.categoryId,
        previous: currProduct,
        priceLinkChanges,
        recommendedChange,
      });
    });
  });
  const res = await promise;
  return res;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method, query } = req;
  if (method === 'POST') {
    const actor = await requireStaffBearerAuth(req, res);
    if (!actor) return undefined;
    try {
      const { priceLinkChanges, ...retData } = await createProduct(req);
      if (retData.success && retData.data != null) {
        // Captured outside the thunk: the `!= null` narrowing above doesn't
        // survive into a deferred callback.
        const created = retData.data;
        recordProductCreated(actor.userId, created).catch(() => undefined);
        recordPricesUpdated(actor.userId, priceLinkChanges ?? []).catch(
          () => undefined,
        );
        revalidateInBackground(res, () =>
          productRevalidationPaths([created.id]),
        );
      }
      return res.status(retData.status).json(retData);
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't create a new product" });
    }
  } else if (method === 'GET') {
    try {
      // Only requests that send a token pay for the staff lookup.
      const includeImageless = await hasStaffBearer(req);
      const { resp, status } = await handleGetProduct(query, {
        includeImageless,
      });
      return res.status(status).json(resp);
    } catch (error) {
      console.error(filepath, error);
      return {
        resp: { success: false, message: "Couldn't find the product/s" },
        status: 500,
      };
    }
  } else if (method === 'DELETE') {
    const actor = await requireStaffBearerAuth(req, res);
    if (!actor) return undefined;
    try {
      const { productId } = query;
      if (productId == null) {
        console.error(filepath, 'No product id provided', `Method: ${method}`);
        return res
          .status(404)
          .json({ success: false, message: 'No product id provided' });
      }

      const existing = await dbClient.product.findFirst({
        where: { id: productId as string, deletedAt: null },
        select: { id: true, brandId: true, name: true },
      });

      if (!existing) {
        console.error(
          filepath,
          'Product not found',
          `Method: ${method}`,
          `productId: ${productId}`,
        );
        return res
          .status(404)
          .json({ success: false, message: "Couldn't find the product" });
      }

      const activeBanner = await dbClient.promoBanner.findFirst({
        where: {
          deletedAt: null,
          isActive: true,
          redirectProductId: existing.id,
        },
        select: { id: true },
      });
      if (activeBanner) {
        return res
          .status(409)
          .json({ success: false, message: 'productHasActiveBanner' });
      }

      const now = new Date();
      await dbClient.$transaction([
        dbClient.product.update({
          where: { id: existing.id },
          data: { deletedAt: now, recommendedOrder: null },
        }),
        dbClient.cartItem.deleteMany({ where: { productId: existing.id } }),
      ]);

      recordProductDeleted(actor.userId, existing);

      if (existing.brandId) {
        await syncBrandProductCount(existing.brandId);
      }

      // The lookup is unscoped by `deletedAt`, so the now soft-deleted row still
      // resolves — which is what rebuilds its cached page into a 404.
      revalidateInBackground(res, () =>
        productRevalidationPaths([existing.id]),
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't delete the product" });
    }
  } else if (method === 'PUT') {
    const actor = await requireStaffBearerAuth(req, res);
    if (!actor) return undefined;
    const { productId } = query;
    if (productId == null) {
      console.error(filepath, 'No product id provided', `Method: ${method}`);
      return res
        .status(404)
        .json({ success: false, message: 'No product id provided' });
    }

    try {
      const { priceLinkChanges, recommendedChange, ...retData } =
        await handleEditProduct(req);
      if (retData.success && retData.data != null) {
        if (retData.previous != null) {
          recordProductUpdated(
            actor.userId,
            retData.previous,
            retData.data,
            recommendedChange ?? undefined,
          ).catch(() => undefined);
        }
        recordPricesUpdated(actor.userId, priceLinkChanges ?? []).catch(
          () => undefined,
        );
        // Both categories: the listing the product left loses a card, the one
        // it joined gains one. `previousCategoryId` is deduped away when the
        // product didn't move.
        const edited = retData.data;
        revalidateInBackground(res, async () => [
          ...(await productRevalidationPaths([edited.id])),
          ...(await categoryListingPaths([retData.previousCategoryId])),
        ]);
      }
      return res.status(retData.status).json(retData);
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't update the product" });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
