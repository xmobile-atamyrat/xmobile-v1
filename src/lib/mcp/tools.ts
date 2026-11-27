import fs from 'fs';

import { logAdminActivity } from '@/lib/adminActivity';
import { categoryLabel } from '@/lib/categoryActivity';
import dbClient from '@/lib/dbClient';
import { downloadImage, ImageDownloadError } from '@/lib/mcp/imageDownload';
import type { McpPrincipal } from '@/lib/mcp/oauthStore';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import { buildProductUpdateActivity } from '@/lib/productActivity';
import {
  createCompressedImgUrl,
  deleteProductImageFiles,
  deleteUnusedProductImageFiles,
  ProductImageError,
  RemovedImageFiles,
  sniffImageFormat,
  storeProductImage,
} from '@/lib/productImages';
import { productSearchWhere } from '@/lib/productSearchWhere';
import { revalidateInBackground } from '@/lib/revalidate';
import { productRevalidationPaths } from '@/lib/revalidateTargets';
import {
  getAbsoluteProductMediaUrl,
  getBasename,
  isRemoteImageUrl,
} from '@/pages/lib/mediaUrls';
import type { Product } from '@prisma/client';
import type { NextApiResponse } from 'next';
import { z } from 'zod';

export type ToolContext = {
  principal: McpPrincipal;
  origin: string;
  res: NextApiResponse;
};

type Content =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export type ToolResult = {
  content: Content[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** A problem the AI should read and act on, as opposed to a server fault. */
export class ToolError extends Error {}

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  meta?: Record<string, unknown>;
  /**
   * Takes an image from the conversation, which only ChatGPT can hand over
   * (`openai/fileParams`). Other apps don't see these tools.
   */
  needsFiles?: true;
  parse: (args: unknown) => unknown;
  run: (ctx: ToolContext, args: never) => Promise<ToolResult>;
};

// ---------------------------------------------------------------------------
// Shared pieces

const productIdSchema = z.string().uuid();
const imageKeySchema = z.string().min(1).max(2000);
/** What ChatGPT puts in a parameter listed in `openai/fileParams`. */
const fileParamSchema = z.object({
  download_url: z.string().max(4000),
  file_id: z.string().max(500),
  mime_type: z.string().max(200).optional(),
  file_name: z.string().max(500).optional(),
});

const productIdJson = {
  type: 'string',
  description: 'The product id from search_products.',
};
const imageKeyJson = {
  type: 'string',
  description: 'The image key from get_product_images.',
};
const fileParamJson = {
  type: 'object',
  description:
    'An image from this conversation: one the user attached or one you generated.',
  properties: {
    download_url: { type: 'string' },
    file_id: { type: 'string' },
    mime_type: { type: 'string' },
    file_name: { type: 'string' },
  },
  required: ['download_url', 'file_id'],
  additionalProperties: false,
};

/**
 * How the tools refer to an image. The stored value is a path on the server's
 * disk, which the AI has no business seeing, so a file is named by its file
 * name. A pasted external link is named by the link itself.
 */
export function imageKey(storedPath: string): string {
  return isRemoteImageUrl(storedPath) ? storedPath : getBasename(storedPath);
}

const productSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  categoryId: true,
  brandId: true,
  tags: true,
  videoUrls: true,
  imgUrls: true,
  price: true,
  outOfStockAt: true,
} as const;

type ProductRow = Pick<Product, keyof typeof productSelect>;

async function activeProduct(productId: string): Promise<ProductRow> {
  const product = await dbClient.product.findFirst({
    where: { id: productId, ...whereActiveProduct },
    select: productSelect,
  });
  if (product == null) {
    throw new ToolError(
      'No product with this id. Use search_products to find it.',
    );
  }
  return product;
}

function describeImages(origin: string, imgUrls: string[]) {
  return imgUrls.map((stored, index) => ({
    position: index + 1,
    key: imageKey(stored),
    isMain: index === 0,
    url: getAbsoluteProductMediaUrl(origin, 'good', stored) ?? stored,
  }));
}

function keyIndex(product: ProductRow, key: string): number {
  const matches = product.imgUrls
    .map((stored, index) => (imageKey(stored) === key ? index : -1))
    .filter((index) => index !== -1);
  if (matches.length === 0) {
    throw new ToolError(
      'This product has no image with that key. Call get_product_images for the current keys.',
    );
  }
  if (matches.length > 1) {
    throw new ToolError(
      'Two images on this product share that key; change it in the xmobile admin instead.',
    );
  }
  return matches[0];
}

/**
 * Writes a new image list, but only if the list is still the one that was
 * read: two saves racing must not silently drop an image one of them added.
 * Throws only when nothing was written, so a caller may delete a new file on
 * a throw; the logging after the write is best-effort and can't fail it.
 */
async function saveImages(
  ctx: ToolContext,
  before: ProductRow,
  imgUrls: string[],
  summary: Record<string, string | number>,
): Promise<void> {
  const { count } = await dbClient.product.updateMany({
    where: {
      id: before.id,
      ...whereActiveProduct,
      // Only the image list matters here: a price or stock update to the same
      // product (the dollar-rate and out-of-stock jobs) must not refuse this.
      imgUrls: { equals: before.imgUrls },
    },
    data: { imgUrls },
  });
  if (count !== 1) {
    throw new ToolError(
      "The product's images changed while this was running. Call get_product_images and try again.",
    );
  }
  try {
    const activity = buildProductUpdateActivity(
      before,
      { ...before, imgUrls },
      { category: { from: null, to: null }, brand: { from: null, to: null } },
    );
    if (activity != null) {
      logAdminActivity({
        userId: ctx.principal.userId,
        entity: 'PRODUCT',
        action: activity.action,
        entityId: before.id,
        meta: { ...activity.meta, via: 'mcp', ...summary },
      });
    }
    revalidateInBackground(ctx.res, () =>
      productRevalidationPaths([before.id]),
    );
  } catch (error) {
    console.error(
      '[mcp] images saved, but logging or revalidation failed',
      error,
    );
  }
}

/**
 * What became of a removed image's files (see
 * `deleteUnusedProductImageFiles`). Deleting them matters: otherwise a photo
 * taken off for being wrong stays public at its /media URL, and every replace
 * leaves three files behind.
 */
const REMOVED_FILE_NOTE: Record<RemovedImageFiles, string> = {
  deleted:
    'Its files were deleted from the server, so its old link no longer works.',
  'in use': 'Its file was kept, because another product still uses it.',
  external: 'It was an external link, so there was no file on the server.',
  failed:
    'Its files could not be deleted from the server, so its old link may still work; the error was logged for the xmobile team.',
};

/**
 * The small (600px) copy of a stored image as a preview, read from disk: no
 * request leaves the server. That copy keeps the original's bytes when the
 * original was already under its size target, so it isn't always a JPEG and
 * the type is read from the bytes.
 */
async function preview(stored: string): Promise<Content | null> {
  const file = createCompressedImgUrl(stored, 'bad');
  if (file == null) return null;
  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[mcp] could not read a preview', error);
    }
    return null;
  }
  const format = sniffImageFormat(bytes);
  if (format == null) return null;
  return {
    type: 'image',
    data: bytes.toString('base64'),
    mimeType: `image/${format}`,
  };
}

async function fetchAndStore(
  download: z.infer<typeof fileParamSchema>,
): Promise<string> {
  let buffer: Buffer;
  try {
    buffer = await downloadImage(download.download_url);
  } catch (error) {
    if (error instanceof ImageDownloadError) {
      if (error.refusedHost != null) {
        // Reaches Slack in production: either ChatGPT moved its file storage,
        // and the allowlist needs the new host, or someone is probing.
        console.error('[mcp] refused an image link on host', error.refusedHost);
      }
      throw new ToolError(error.message);
    }
    throw error;
  }
  try {
    return await storeProductImage(buffer);
  } catch (error) {
    if (error instanceof ProductImageError) throw new ToolError(error.message);
    throw error;
  }
}

/**
 * Downloads and stores `image`, then saves the product's images as `change`
 * makes them from the list read after the slow download, so the order is
 * current. Up to the save nothing points at the new file, so it is deleted
 * again if anything before it fails.
 */
async function storeAndSave<T>(
  ctx: ToolContext,
  productId: string,
  image: z.infer<typeof fileParamSchema>,
  change: (
    product: ProductRow,
    stored: string,
  ) => {
    next: string[];
    summary: Record<string, string | number>;
    extra: T;
  },
): Promise<{ product: ProductRow; next: string[]; stored: string; extra: T }> {
  const stored = await fetchAndStore(image);
  try {
    const product = await activeProduct(productId);
    const { next, summary, extra } = change(product, stored);
    await saveImages(ctx, product, next, summary);
    return { product, next, stored, extra };
  } catch (error) {
    deleteProductImageFiles(stored);
    throw error;
  }
}

/**
 * A result with `structured` as `structuredContent` and, as the MCP spec
 * asks, also as JSON text after `message`: a client on a protocol version
 * before structured content (2025-03-26 and older), or one that only shows
 * the model text, still gets the ids the other tools need.
 */
function jsonResult(
  message: string,
  structured: Record<string, unknown>,
): ToolResult {
  return {
    content: [
      { type: 'text', text: message },
      { type: 'text', text: JSON.stringify(structured) },
    ],
    structuredContent: structured,
  };
}

function imagesResult(
  origin: string,
  product: ProductRow,
  imgUrls: string[],
  message: string,
): ToolResult {
  return jsonResult(message, {
    productId: product.id,
    productName: categoryLabel(product.name),
    images: describeImages(origin, imgUrls),
  });
}

function clampPosition(position: number | undefined, length: number): number {
  if (position == null) return length;
  return Math.min(Math.max(position - 1, 0), length);
}

// ---------------------------------------------------------------------------
// Tools

const searchArgs = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional(),
});

const getImagesArgs = z.object({ productId: productIdSchema });

const addArgs = z.object({
  productId: productIdSchema,
  image: fileParamSchema,
  position: z.number().int().min(1).optional(),
});

const reorderArgs = z.object({
  productId: productIdSchema,
  imageKeys: z.array(imageKeySchema).min(1).max(100),
});

const removeArgs = z.object({
  productId: productIdSchema,
  imageKey: imageKeySchema,
});

const replaceArgs = z.object({
  productId: productIdSchema,
  imageKey: imageKeySchema,
  image: fileParamSchema,
});

const MAX_THUMBNAILS = 8;

const definitions: ToolDefinition[] = [
  {
    name: 'search_products',
    title: 'Search products',
    description:
      'Find xmobile products by name, brand or category. Returns ids for the other tools. Includes products that are out of stock or have no images yet.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to search for.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'At most this many results (default 10).',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    meta: {
      'openai/toolInvocation/invoking': 'Searching products…',
      'openai/toolInvocation/invoked': 'Found products',
    },
    parse: (args) => searchArgs.parse(args),
    run: async (ctx, { query, limit }: z.infer<typeof searchArgs>) => {
      const products = await dbClient.product.findMany({
        where: { ...whereActiveProduct, AND: productSearchWhere(query) },
        orderBy: { updatedAt: 'desc' },
        take: limit ?? 10,
        select: {
          id: true,
          slug: true,
          name: true,
          imgUrls: true,
          outOfStockAt: true,
          brand: { select: { name: true } },
          categories: { select: { name: true } },
        },
      });
      const results = products.map((product) => ({
        productId: product.id,
        name: categoryLabel(product.name),
        brand: product.brand?.name ?? null,
        category: categoryLabel(product.categories?.name),
        imageCount: product.imgUrls.length,
        outOfStock: product.outOfStockAt != null,
        pageUrl: `${ctx.origin}/product/${encodeURIComponent(product.slug)}`,
      }));
      return jsonResult(
        results.length === 0
          ? 'No products matched.'
          : `${results.length} product(s) found.`,
        { results },
      );
    },
  },
  {
    name: 'get_product_images',
    title: 'Get product images',
    description:
      "List a product's images in display order (position 1 is the main image), with small previews so you can match their style. Each image has a key used by the other tools.",
    inputSchema: {
      type: 'object',
      properties: { productId: productIdJson },
      required: ['productId'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    meta: {
      'openai/toolInvocation/invoking': 'Loading images…',
      'openai/toolInvocation/invoked': 'Loaded images',
    },
    parse: (args) => getImagesArgs.parse(args),
    run: async (ctx, { productId }: z.infer<typeof getImagesArgs>) => {
      const product = await activeProduct(productId);
      const result = imagesResult(
        ctx.origin,
        product,
        product.imgUrls,
        product.imgUrls.length === 0
          ? 'This product has no images yet.'
          : `${product.imgUrls.length} image(s), in display order. Previews follow.`,
      );
      const previews = await Promise.all(
        product.imgUrls.slice(0, MAX_THUMBNAILS).map(preview),
      );
      previews.forEach((item) => {
        if (item != null) result.content.push(item);
      });
      return result;
    },
  },
  {
    name: 'add_product_image',
    needsFiles: true,
    title: 'Add product image',
    description:
      'Add an image from this conversation (attached by the user or generated by you) to a product on the live site. Position 1 makes it the main image; by default it goes last. JPEG, PNG or WebP, up to 10 MB.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: productIdJson,
        image: fileParamJson,
        position: {
          type: 'integer',
          minimum: 1,
          description: '1-based position. Omit to add at the end.',
        },
      },
      required: ['productId', 'image'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    meta: {
      'openai/fileParams': ['image'],
      'openai/toolInvocation/invoking': 'Uploading the image to xmobile…',
      'openai/toolInvocation/invoked': 'Image added',
    },
    parse: (args) => addArgs.parse(args),
    run: async (
      ctx,
      { productId, image, position }: z.infer<typeof addArgs>,
    ) => {
      // Checked before the download so a wrong id costs no transfer.
      await activeProduct(productId);
      const { product, next, stored } = await storeAndSave(
        ctx,
        productId,
        image,
        (current, added) => {
          const list = [...current.imgUrls];
          list.splice(clampPosition(position, list.length), 0, added);
          return {
            next: list,
            summary: { addedImage: imageKey(added) },
            extra: null,
          };
        },
      );
      return imagesResult(
        ctx.origin,
        product,
        next,
        `Added as image ${next.indexOf(stored) + 1} of ${next.length}. The product page refreshes within a minute.`,
      );
    },
  },
  {
    name: 'reorder_product_images',
    title: 'Reorder product images',
    description:
      "Set the display order of a product's images. Pass every current image key exactly once, in the new order; the first becomes the main image.",
    inputSchema: {
      type: 'object',
      properties: {
        productId: productIdJson,
        imageKeys: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description:
            'All image keys from get_product_images, in the new order.',
        },
      },
      required: ['productId', 'imageKeys'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    meta: {
      'openai/toolInvocation/invoking': 'Reordering images…',
      'openai/toolInvocation/invoked': 'Images reordered',
    },
    parse: (args) => reorderArgs.parse(args),
    run: async (ctx, { productId, imageKeys }: z.infer<typeof reorderArgs>) => {
      const product = await activeProduct(productId);
      const current = product.imgUrls.map(imageKey);
      // A permutation of the current set, nothing more: this tool can never
      // add, drop or duplicate an image, whatever it is sent.
      const sameSet =
        imageKeys.length === current.length &&
        new Set(imageKeys).size === imageKeys.length &&
        new Set(current).size === current.length &&
        imageKeys.every((key) => current.includes(key));
      if (!sameSet) {
        throw new ToolError(
          'imageKeys must list every current image key exactly once. Call get_product_images for the current keys.',
        );
      }
      const next = imageKeys.map(
        (key) => product.imgUrls[current.indexOf(key)],
      );
      if (next.every((stored, index) => stored === product.imgUrls[index])) {
        return imagesResult(
          ctx.origin,
          product,
          next,
          'The order was already like this.',
        );
      }
      await saveImages(ctx, product, next, {});
      return imagesResult(ctx.origin, product, next, 'Images reordered.');
    },
  },
  {
    name: 'remove_product_image',
    title: 'Remove product image',
    description:
      "Take an image off a product and delete its file from the server, unless another product uses it too. This can't be undone. A product's last image can't be removed; add the new one first.",
    inputSchema: {
      type: 'object',
      properties: { productId: productIdJson, imageKey: imageKeyJson },
      required: ['productId', 'imageKey'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    meta: {
      'openai/toolInvocation/invoking': 'Removing the image…',
      'openai/toolInvocation/invoked': 'Image removed',
    },
    parse: (args) => removeArgs.parse(args),
    run: async (
      ctx,
      { productId, imageKey: key }: z.infer<typeof removeArgs>,
    ) => {
      const product = await activeProduct(productId);
      const index = keyIndex(product, key);
      if (product.imgUrls.length === 1) {
        throw new ToolError(
          "This is the product's only image, and a product without images is hidden from the shop. Add the new image first, or use replace_product_image.",
        );
      }
      const removed = product.imgUrls[index];
      const next = product.imgUrls.filter((_, i) => i !== index);
      await saveImages(ctx, product, next, { removedImage: key });
      const file = await deleteUnusedProductImageFiles(removed);
      return imagesResult(
        ctx.origin,
        product,
        next,
        `Image removed from the product. ${REMOVED_FILE_NOTE[file]}`,
      );
    },
  },
  {
    name: 'replace_product_image',
    needsFiles: true,
    title: 'Replace product image',
    description:
      "Swap one product image for an image from this conversation, keeping its position. The old image's file is deleted from the server, unless another product uses it too.",
    inputSchema: {
      type: 'object',
      properties: {
        productId: productIdJson,
        imageKey: imageKeyJson,
        image: fileParamJson,
      },
      required: ['productId', 'imageKey', 'image'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    meta: {
      'openai/fileParams': ['image'],
      'openai/toolInvocation/invoking': 'Replacing the image…',
      'openai/toolInvocation/invoked': 'Image replaced',
    },
    parse: (args) => replaceArgs.parse(args),
    run: async (
      ctx,
      { productId, imageKey: key, image }: z.infer<typeof replaceArgs>,
    ) => {
      keyIndex(await activeProduct(productId), key);
      const {
        product,
        next,
        extra: { index, old },
      } = await storeAndSave(ctx, productId, image, (current, added) => {
        const at = keyIndex(current, key);
        const list = [...current.imgUrls];
        list[at] = added;
        return {
          next: list,
          summary: { removedImage: key, addedImage: imageKey(added) },
          extra: { index: at, old: current.imgUrls[at] },
        };
      });
      const file = await deleteUnusedProductImageFiles(old);
      return imagesResult(
        ctx.origin,
        product,
        next,
        `Image ${index + 1} replaced. ${REMOVED_FILE_NOTE[file]}`,
      );
    },
  },
];

const byName = new Map(definitions.map((tool) => [tool.name, tool]));

const offered = (tool: ToolDefinition, canSendFiles: boolean) =>
  canSendFiles || tool.needsFiles !== true;

/** The `tools/list` payload, for a client that can or can't send files. */
export function listTools(canSendFiles: boolean) {
  return definitions
    .filter((tool) => offered(tool, canSendFiles))
    .map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      ...(tool.meta != null ? { _meta: tool.meta } : {}),
    }));
}

export function hasTool(name: string, canSendFiles: boolean): boolean {
  const tool = byName.get(name);
  return tool != null && offered(tool, canSendFiles);
}

/**
 * Runs one tool. Bad arguments and refusals come back as a tool error the AI
 * can read and correct (MCP's `isError`), not as a protocol failure.
 */
export async function callTool(
  ctx: ToolContext,
  name: string,
  args: unknown,
): Promise<ToolResult> {
  const tool = byName.get(name);
  if (tool == null) throw new Error(`Unknown tool ${name}`);
  const parsed = (() => {
    try {
      return { ok: true as const, value: tool.parse(args ?? {}) };
    } catch (error) {
      const issues =
        error instanceof z.ZodError
          ? error.issues
              .map(
                (issue) =>
                  `${issue.path.join('.') || 'arguments'}: ${issue.message}`,
              )
              .join('; ')
          : 'invalid arguments';
      return { ok: false as const, message: `Invalid arguments: ${issues}` };
    }
  })();
  if (!parsed.ok) {
    return { content: [{ type: 'text', text: parsed.message }], isError: true };
  }
  try {
    return await tool.run(ctx, parsed.value as never);
  } catch (error) {
    if (error instanceof ToolError) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true,
      };
    }
    console.error('[mcp] tool failed:', name, error);
    return {
      content: [
        {
          type: 'text',
          text: 'The xmobile server hit an error. Nothing was changed.',
        },
      ],
      isError: true,
    };
  }
}
