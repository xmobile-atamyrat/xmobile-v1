import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';
import {
  getCategoryMediaUrl,
  productThumbnailUrl,
} from '@/pages/lib/mediaUrls';

import type { EventName } from '../events';
import { sumDailyBy } from './sql';
import {
  DIM,
  eventsWhere,
  insertDaily,
  STORED,
  type DailyRollup,
  type StoredMetric,
} from './stored';
import type { TopNData, TopNRow } from './types';
import type { WidgetGroup } from './widget';

/**
 * Catalog interest: product views, category views and cart adds, grouped on
 * `AnalyticsEvent.entityId`. Widgets: top_products, top_categories,
 * top_cart_adds. `cart_adds` counts cart_add events, not quantities.
 */

const entityRollup = (
  metric: StoredMetric,
  event: EventName,
  dimension: string,
): DailyRollup => ({
  metrics: [metric],
  reads: ['events'],
  build: (day) => [
    insertDaily(
      day,
      metric,
      Prisma.sql`
        SELECT ${dimension} AS dimension, "entityId" AS dimension_value,
               count(*)::bigint AS value
        FROM "AnalyticsEvent"
        WHERE ${eventsWhere(day, day, [event])} AND "entityId" IS NOT NULL
        GROUP BY "entityId"`,
    ),
  ],
});

export const productsRollups: DailyRollup[] = [
  entityRollup(STORED.productViews, 'product_view', DIM.product),
  entityRollup(STORED.categoryViews, 'category_view', DIM.category),
  entityRollup(STORED.cartAdds, 'cart_add', DIM.product),
];

/**
 * A product/category `name` (JSON of locale → name) in `locale`, falling back
 * like `parseName` in src/pages/lib/utils.ts (not imported: that module pulls
 * in MUI and React). A plain non-JSON string is returned as is.
 */
export function localizedName(name: string, locale: string): string {
  try {
    const parsed: unknown = JSON.parse(name);
    if (parsed === null || typeof parsed !== 'object') return name;
    const byLocale = parsed as Record<string, unknown>;
    const pick = [locale, 'tk', 'ch', 'ru', 'en']
      .map((key) => byLocale[key])
      .find((value) => typeof value === 'string' && value !== '');
    return typeof pick === 'string' ? pick : '';
  } catch {
    return name;
  }
}

/** Adds product names (soft-deleted ones too), thumbnails and links. */
export async function enrichProducts(
  rows: { key: string; value: number }[],
  locale: string,
): Promise<TopNRow[]> {
  if (rows.length === 0) return [];
  const products = await dbClient.product.findMany({
    where: { id: { in: rows.map((r) => r.key) } },
    select: {
      id: true,
      slug: true,
      name: true,
      imgUrls: true,
      deletedAt: true,
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return rows.map(({ key, value }) => {
    const product = byId.get(key);
    if (!product) return { key, label: key, value };
    const imageUrl = productThumbnailUrl(product.imgUrls[0]);
    return {
      key,
      label: localizedName(product.name, locale) || key,
      value,
      ...(imageUrl ? { imageUrl } : {}),
      // A deleted product's page is gone; keep its name but don't link it.
      ...(product.deletedAt ? {} : { href: `/product/${product.slug}` }),
    };
  });
}

/**
 * Adds category names (soft-deleted ones too), images and links: categories
 * with live subcategories link to their subcategory grid (`/category/…`),
 * leaf categories to their product listing (`/product-category/…`).
 */
export async function enrichCategories(
  rows: { key: string; value: number }[],
  locale: string,
): Promise<TopNRow[]> {
  if (rows.length === 0) return [];
  const categories = await dbClient.category.findMany({
    where: { id: { in: rows.map((r) => r.key) } },
    select: {
      id: true,
      slug: true,
      name: true,
      imgUrl: true,
      deletedAt: true,
      _count: {
        select: { successorCategories: { where: { deletedAt: null } } },
      },
    },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  return rows.map(({ key, value }) => {
    const category = byId.get(key);
    if (!category) return { key, label: key, value };
    const imageUrl = getCategoryMediaUrl(category.imgUrl);
    // _count is Prisma's own relation-count shape, not our naming.
    // eslint-disable-next-line no-underscore-dangle
    const hasChildren = category._count.successorCategories > 0;
    const base = hasChildren ? 'category' : 'product-category';
    return {
      key,
      label: localizedName(category.name, locale) || key,
      value,
      ...(imageUrl ? { imageUrl } : {}),
      ...(category.deletedAt ? {} : { href: `/${base}/${category.slug}` }),
    };
  });
}

const topEntities =
  (
    metric: StoredMetric,
    dimension: string,
    enrich: typeof enrichProducts,
  ): NonNullable<WidgetGroup['top_products']> =>
  async ({ from, to, limit, locale }): Promise<TopNData> => ({
    kind: 'topN',
    rows: await enrich(
      await sumDailyBy(metric, dimension, from, to, limit),
      locale,
    ),
  });

export const productsWidgets = {
  top_products: topEntities(STORED.productViews, DIM.product, enrichProducts),
  top_categories: topEntities(
    STORED.categoryViews,
    DIM.category,
    enrichCategories,
  ),
  top_cart_adds: topEntities(STORED.cartAdds, DIM.product, enrichProducts),
} satisfies WidgetGroup;
