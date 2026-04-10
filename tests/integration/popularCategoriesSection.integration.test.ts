import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from 'vitest';

import {
  POPULAR_CATEGORIES_SECTION_MAX,
  buildPopularCategoriesSectionModel,
} from '@/pages/lib/popularCategoriesLayout';
import { ExtendedCategory } from '@/pages/lib/types';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import type { IntegrationCatalog } from './shared/integration-types';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

async function getCategoryTree(): Promise<ExtendedCategory[]> {
  const category = (await import('@/pages/api/category.page')).default;
  const { req, res } = createMocks({
    method: 'GET',
    url: '/api/category',
    query: {},
  });
  await category(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  expect(res._getStatusCode()).toBe(200);
  const json = JSON.parse(res._getData() as string) as {
    success: boolean;
    data: ExtendedCategory[];
  };
  expect(json.success).toBe(true);
  return json.data;
}

describe('Popular categories layout + GET /api/category (integration)', () => {
  let prisma: PrismaClient;
  const rootsToCleanup: string[] = [];

  function trackRoot(id: string) {
    rootsToCleanup.push(id);
  }

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
  }, 180_000);

  afterEach(async () => {
    while (rootsToCleanup.length > 0) {
      const id = rootsToCleanup.pop();
      if (id) {
        await prisma.category.delete({ where: { id } }).catch(() => {});
      }
    }
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('builds a model from live API tree with a popular root and the seeded root', async () => {
    const pop = await prisma.category.create({
      data: {
        name: '{"en":"Popular root"}',
        popular: true,
        sortOrder: 99,
        slug: 'popular-root-seeded',
      },
    });
    trackRoot(pop.id);

    const tree = await getCategoryTree();
    const model = buildPopularCategoriesSectionModel(tree);

    expect(model.shouldRender).toBe(true);
    expect(model.fullWidthItems.some((c) => c.id === pop.id)).toBe(true);
    expect(model.fullWidthItems.every((c) => c.popular === true)).toBe(true);
    expect(model.showFullWidthMore).toBe(true);
  });

  it('includes seeded catalog root in the tree and yields a renderable section model', async () => {
    const catalog = inject('integrationCatalog') as IntegrationCatalog;
    const tree = await getCategoryTree();
    const ids = tree.map((c) => c.id);
    expect(ids).toContain(catalog.categoryId);
    const model = buildPopularCategoriesSectionModel(tree);
    expect(model.shouldRender).toBe(true);
  });

  it('shows full-width items for all popular roots without capping locally', async () => {
    for (let i = 0; i < POPULAR_CATEGORIES_SECTION_MAX; i += 1) {
      const r = await prisma.category.create({
        data: {
          name: `{"en":"pop ${i}"}`,
          popular: true,
          sortOrder: i,
          slug: `pop-${i}-seeded`,
        },
      });
      trackRoot(r.id);
    }
    const tree = await getCategoryTree();
    const model = buildPopularCategoriesSectionModel(tree);

    // Check lengths match our generated popular count
    const popularCount = tree.filter(
      (cat) => cat.popular && !cat.predecessorId && !cat.deletedAt,
    ).length;

    expect(model.fullWidthItems).toHaveLength(popularCount);
    expect(model.showFullWidthMore).toBe(true);
  });
});
