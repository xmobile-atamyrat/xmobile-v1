import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

function multipartBody(
  fields: Record<string, string>,
  boundary: string,
): string {
  const chunks: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
    );
  }
  chunks.push(`--${boundary}--`);
  return chunks.join('\r\n');
}

async function invokeBannerApi(options: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const bannerHandler = (await import('@/pages/api/promo-banner.page')).default;
  const { req: mockReq, res } = createMocks({
    method: options.method,
    url: '/api/promo-banner',
    query: options.query ?? {},
    headers: options.headers ?? {},
  });

  let req: NextApiRequest;
  if (options.body != null) {
    const buf = Buffer.from(options.body, 'utf8');
    const bodyStream = Readable.from(buf);
    req = Object.assign(bodyStream, {
      url: '/api/promo-banner',
      method: options.method,
      headers: { ...mockReq.headers } as NextApiRequest['headers'],
      query: mockReq.query,
    }) as unknown as NextApiRequest;
  } else {
    req = mockReq as unknown as NextApiRequest;
  }

  await bannerHandler(req, res as unknown as NextApiResponse);
  const status = res._getStatusCode();
  const raw = res._getData() as string;
  const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  return { status, json };
}

async function invokeCategoryDelete(
  categoryId: string,
  headers?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const categoryHandler = (await import('@/pages/api/category.page')).default;
  const { req, res } = createMocks({
    method: 'DELETE',
    url: '/api/category',
    query: { categoryId },
    headers: headers ?? {},
  });
  await categoryHandler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  const status = res._getStatusCode();
  const json = JSON.parse((res._getData() as string) || '{}');
  return { status, json };
}

async function invokeProductDelete(
  productId: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const productHandler = (await import('@/pages/api/product/index.page'))
    .default;
  const { req, res } = createMocks({
    method: 'DELETE',
    url: '/api/product',
    query: { productId },
  });
  await productHandler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  const status = res._getStatusCode();
  const json = JSON.parse((res._getData() as string) || '{}');
  return { status, json };
}

describe('promo banner API + delete guard (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let freeToken: string;
  let uploadDir: string;
  let categoryId: string;
  let sortCounter = 100;

  function nextSortOrder(): number {
    sortCounter += 1;
    return sortCounter;
  }

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banner-int-'));
    vi.stubEnv('BANNER_IMAGES_DIR', uploadDir);

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    adminToken = admin.accessToken;
    const free = await signupTestUser('banner-free');
    freeToken = free.accessToken;
    categoryId = catalog.categoryId;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it('POST returns 401 without Authorization', async () => {
    const boundary = 'banner401post';
    const body = multipartBody(
      { imageUrl_default: 'https://cdn.example.com/a.jpg' },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('POST returns 401 for a non-staff token', async () => {
    const boundary = 'banner401free';
    const body = multipartBody(
      { imageUrl_default: 'https://cdn.example.com/a.jpg' },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${freeToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('GET ?all=true returns 401 without Authorization', async () => {
    const { status, json } = await invokeBannerApi({
      method: 'GET',
      query: { all: 'true' },
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('GET ?all=true returns 401 for a non-staff token', async () => {
    const { status, json } = await invokeBannerApi({
      method: 'GET',
      query: { all: 'true' },
      headers: { authorization: `Bearer ${freeToken}` },
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('DELETE returns 401 without Authorization', async () => {
    const { status, json } = await invokeBannerApi({
      method: 'DELETE',
      query: { id: randomUUID() },
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  // ── POST validation ──────────────────────────────────────────────────────

  it('POST returns 400 when the default image is missing', async () => {
    const boundary = 'bannernoimg';
    const body = multipartBody(
      { sortOrder: String(nextSortOrder()) },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.message).toBe('defaultBannerImageRequired');
  });

  it('POST returns 400 for an invalid sortOrder', async () => {
    const boundary = 'bannerbadorder';
    const body = multipartBody(
      {
        imageUrl_default: 'https://cdn.example.com/a.jpg',
        sortOrder: '0',
      },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.message).toBe('bannerOrderInvalid');
  });

  it('POST returns 400 for an invalid redirectType', async () => {
    const boundary = 'bannerbadredirect';
    const body = multipartBody(
      {
        imageUrl_default: 'https://cdn.example.com/a.jpg',
        sortOrder: String(nextSortOrder()),
        redirectType: 'BRAND',
      },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.message).toBe('invalidRedirectType');
  });

  it('POST returns 400 when a redirect target id is missing', async () => {
    const boundary = 'bannerredirectnoId';
    const body = multipartBody(
      {
        imageUrl_default: 'https://cdn.example.com/a.jpg',
        sortOrder: String(nextSortOrder()),
        redirectType: 'CATEGORY',
      },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.message).toBe('redirectTargetRequired');
  });

  it('POST returns 400 when the redirect target does not exist', async () => {
    const boundary = 'bannerredirectmissing';
    const body = multipartBody(
      {
        imageUrl_default: 'https://cdn.example.com/a.jpg',
        sortOrder: String(nextSortOrder()),
        redirectType: 'CATEGORY',
        redirectId: randomUUID(),
      },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.message).toBe('redirectTargetNotFound');
  });

  it('POST creates a banner redirecting to an existing category', async () => {
    const boundary = 'bannercreateok';
    const sortOrder = nextSortOrder();
    const body = multipartBody(
      {
        imageUrl_default: 'https://cdn.example.com/a.jpg',
        sortOrder: String(sortOrder),
        redirectType: 'CATEGORY',
        redirectId: categoryId,
      },
      boundary,
    );
    const { status, json } = await invokeBannerApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(201);
    expect(json.success).toBe(true);
    const data = json.data as {
      id: string;
      isActive: boolean;
      sortOrder: number;
      redirectCategoryId: string | null;
    };
    expect(data.isActive).toBe(true);
    expect(data.sortOrder).toBe(sortOrder);
    expect(data.redirectCategoryId).toBe(categoryId);
    await prisma.promoBanner.delete({ where: { id: data.id } });
  });

  it('POST returns 400 when sortOrder conflicts with an existing active banner', async () => {
    const sortOrder = nextSortOrder();
    const first = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/first.jpg' },
        isActive: true,
        sortOrder,
      },
    });
    try {
      const boundary = 'bannerorderconflict';
      const body = multipartBody(
        {
          imageUrl_default: 'https://cdn.example.com/second.jpg',
          sortOrder: String(sortOrder),
        },
        boundary,
      );
      const { status, json } = await invokeBannerApi({
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      expect(status).toBe(400);
      expect(json.message).toBe('bannerOrderConflict');
    } finally {
      await prisma.promoBanner.delete({ where: { id: first.id } });
    }
  });

  it('POST allows duplicate sortOrder among inactive banners', async () => {
    const sortOrder = nextSortOrder();
    const first = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/first.jpg' },
        isActive: false,
        sortOrder,
      },
    });
    try {
      const boundary = 'bannerinactiveok';
      const body = multipartBody(
        {
          imageUrl_default: 'https://cdn.example.com/second.jpg',
          sortOrder: String(sortOrder),
          isActive: 'false',
        },
        boundary,
      );
      const { status, json } = await invokeBannerApi({
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      expect(status).toBe(201);
      const data = json.data as { id: string };
      await prisma.promoBanner.delete({ where: { id: data.id } });
    } finally {
      await prisma.promoBanner.delete({ where: { id: first.id } });
    }
  });

  // ── GET (storefront + admin listing) ────────────────────────────────────

  it('GET (public) returns only in-window active banners; GET ?all=true (admin) returns everything', async () => {
    const now = Date.now();
    const active = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/active.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
      },
    });
    const inactive = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/inactive.jpg' },
        isActive: false,
        sortOrder: nextSortOrder(),
      },
    });
    const notYetStarted = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/future.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
        startsAt: new Date(now + 24 * 60 * 60 * 1000),
      },
    });
    const alreadyEnded = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/past.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
        endsAt: new Date(now - 24 * 60 * 60 * 1000),
      },
    });

    try {
      const publicResult = await invokeBannerApi({ method: 'GET' });
      expect(publicResult.status).toBe(200);
      const publicIds = (publicResult.json.data as { id: string }[]).map(
        (b) => b.id,
      );
      expect(publicIds).toContain(active.id);
      expect(publicIds).not.toContain(inactive.id);
      expect(publicIds).not.toContain(notYetStarted.id);
      expect(publicIds).not.toContain(alreadyEnded.id);

      const adminResult = await invokeBannerApi({
        method: 'GET',
        query: { all: 'true' },
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminResult.status).toBe(200);
      const adminIds = (adminResult.json.data as { id: string }[]).map(
        (b) => b.id,
      );
      expect(adminIds).toEqual(
        expect.arrayContaining([
          active.id,
          inactive.id,
          notYetStarted.id,
          alreadyEnded.id,
        ]),
      );
    } finally {
      await prisma.promoBanner.deleteMany({
        where: {
          id: {
            in: [active.id, inactive.id, notYetStarted.id, alreadyEnded.id],
          },
        },
      });
    }
  });

  // ── PUT ──────────────────────────────────────────────────────────────────

  it('PUT returns 404 for an unknown banner id', async () => {
    const boundary = 'bannerputmissing';
    const body = multipartBody({ sortOrder: '1' }, boundary);
    const { status, json } = await invokeBannerApi({
      method: 'PUT',
      query: { id: randomUUID() },
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(404);
    expect(json.success).toBe(false);
  });

  it('PUT updates sortOrder, isActive and the default image of an existing banner', async () => {
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/old.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
      },
    });
    try {
      const newSortOrder = nextSortOrder();
      const boundary = 'bannerputok';
      const body = multipartBody(
        {
          imageUrl_default: 'https://cdn.example.com/new.jpg',
          sortOrder: String(newSortOrder),
          isActive: 'false',
        },
        boundary,
      );
      const { status, json } = await invokeBannerApi({
        method: 'PUT',
        query: { id: banner.id },
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
      const updated = await prisma.promoBanner.findUnique({
        where: { id: banner.id },
      });
      expect(updated?.isActive).toBe(false);
      expect(updated?.sortOrder).toBe(newSortOrder);
      expect((updated?.imgUrls as { default: string }).default).toBe(
        'https://cdn.example.com/new.jpg',
      );
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
    }
  });

  it('PUT allows keeping a banner at its own sortOrder (self-exclusion from the conflict check)', async () => {
    const sortOrder = nextSortOrder();
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/self.jpg' },
        isActive: true,
        sortOrder,
      },
    });
    try {
      const boundary = 'bannerputself';
      const body = multipartBody({ sortOrder: String(sortOrder) }, boundary);
      const { status, json } = await invokeBannerApi({
        method: 'PUT',
        query: { id: banner.id },
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
    }
  });

  it('PUT returns 400 when sortOrder conflicts with another active banner', async () => {
    const sortOrderA = nextSortOrder();
    const sortOrderB = nextSortOrder();
    const bannerA = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/a.jpg' },
        isActive: true,
        sortOrder: sortOrderA,
      },
    });
    const bannerB = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/b.jpg' },
        isActive: true,
        sortOrder: sortOrderB,
      },
    });
    try {
      const boundary = 'bannerputconflict';
      const body = multipartBody({ sortOrder: String(sortOrderA) }, boundary);
      const { status, json } = await invokeBannerApi({
        method: 'PUT',
        query: { id: bannerB.id },
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      expect(status).toBe(400);
      expect(json.message).toBe('bannerOrderConflict');
    } finally {
      await prisma.promoBanner.deleteMany({
        where: { id: { in: [bannerA.id, bannerB.id] } },
      });
    }
  });

  // ── DELETE ───────────────────────────────────────────────────────────────

  it('DELETE returns 404 for an unknown banner id', async () => {
    const { status, json } = await invokeBannerApi({
      method: 'DELETE',
      query: { id: randomUUID() },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(status).toBe(404);
    expect(json.success).toBe(false);
  });

  it('DELETE soft-deletes a banner and removes it from admin/public listings', async () => {
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/todelete.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
      },
    });
    try {
      const { status, json } = await invokeBannerApi({
        method: 'DELETE',
        query: { id: banner.id },
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);

      const row = await prisma.promoBanner.findUnique({
        where: { id: banner.id },
      });
      expect(row?.deletedAt).not.toBeNull();

      const adminResult = await invokeBannerApi({
        method: 'GET',
        query: { all: 'true' },
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const adminIds = (adminResult.json.data as { id: string }[]).map(
        (b) => b.id,
      );
      expect(adminIds).not.toContain(banner.id);
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
    }
  });

  // ── Delete guard: product/category deletion vs. active banners ─────────
  // This is the behavior added alongside the banner feature: deleting a
  // product/category that an active banner points to must be blocked so the
  // banner isn't silently left dangling.

  it('blocks product deletion while an active banner redirects to it, and unblocks once deactivated', async () => {
    const product = await prisma.product.create({
      data: {
        slug: `banner-guard-product-${Date.now()}`,
        name: '{"en":"Banner guard product"}',
        categoryId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
      },
    });
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/product-guard.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
        redirectProductId: product.id,
      },
    });
    try {
      const blocked = await invokeProductDelete(product.id);
      expect(blocked.status).toBe(409);
      expect(blocked.json.message).toBe('productHasActiveBanner');

      const stillActive = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(stillActive?.deletedAt).toBeNull();

      await prisma.promoBanner.update({
        where: { id: banner.id },
        data: { isActive: false },
      });

      const allowed = await invokeProductDelete(product.id);
      expect(allowed.status).toBe(200);
      expect(allowed.json.success).toBe(true);
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
  });

  it('blocks category deletion while an active banner redirects directly at it', async () => {
    const category = await prisma.category.create({
      data: {
        name: '{"en":"Banner guard category"}',
        slug: `banner-guard-category-${Date.now()}`,
      },
    });
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/category-guard.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
        redirectCategoryId: category.id,
      },
    });
    try {
      const { status, json } = await invokeCategoryDelete(category.id, {
        authorization: `Bearer ${adminToken}`,
      });
      expect(status).toBe(409);
      expect(json.message).toBe('categoryHasActiveBanner');
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
      await prisma.category.delete({ where: { id: category.id } });
    }
  });

  it('blocks category deletion while an active banner redirects to a descendant subcategory', async () => {
    const parent = await prisma.category.create({
      data: {
        name: '{"en":"Banner guard parent"}',
        slug: `banner-guard-parent-${Date.now()}`,
      },
    });
    const child = await prisma.category.create({
      data: {
        name: '{"en":"Banner guard child"}',
        slug: `banner-guard-child-${Date.now()}`,
        predecessorId: parent.id,
      },
    });
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/subcategory-guard.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
        redirectCategoryId: child.id,
      },
    });
    try {
      const { status, json } = await invokeCategoryDelete(parent.id, {
        authorization: `Bearer ${adminToken}`,
      });
      expect(status).toBe(409);
      expect(json.message).toBe('categoryHasActiveBanner');
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
      // Deleting the parent cascades onto the child via predecessorId.
      await prisma.category.delete({ where: { id: parent.id } });
    }
  });

  it('blocks category deletion while an active banner redirects to a product within its subtree', async () => {
    const category = await prisma.category.create({
      data: {
        name: '{"en":"Banner guard product-parent"}',
        slug: `banner-guard-product-parent-${Date.now()}`,
      },
    });
    const product = await prisma.product.create({
      data: {
        slug: `banner-guard-subtree-product-${Date.now()}`,
        name: '{"en":"Banner guard subtree product"}',
        categoryId: category.id,
        imgUrls: [],
        tags: [],
        videoUrls: [],
      },
    });
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: {
          default: 'https://cdn.example.com/subtree-product-guard.jpg',
        },
        isActive: true,
        sortOrder: nextSortOrder(),
        redirectProductId: product.id,
      },
    });
    try {
      const { status, json } = await invokeCategoryDelete(category.id, {
        authorization: `Bearer ${adminToken}`,
      });
      expect(status).toBe(409);
      expect(json.message).toBe('categoryHasActiveBanner');
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
      // Deleting the category cascades onto its product.
      await prisma.category.delete({ where: { id: category.id } });
    }
  });

  it('allows category deletion when the only matching banner is already soft-deleted', async () => {
    const category = await prisma.category.create({
      data: {
        name: '{"en":"Banner guard stale"}',
        slug: `banner-guard-stale-${Date.now()}`,
      },
    });
    const banner = await prisma.promoBanner.create({
      data: {
        imgUrls: { default: 'https://cdn.example.com/stale-guard.jpg' },
        isActive: true,
        sortOrder: nextSortOrder(),
        redirectCategoryId: category.id,
        deletedAt: new Date(),
      },
    });
    try {
      const { status, json } = await invokeCategoryDelete(category.id, {
        authorization: `Bearer ${adminToken}`,
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
    } finally {
      await prisma.promoBanner.delete({ where: { id: banner.id } });
      // Category was already (soft-)deleted by the call above; hard-delete to clean up.
      await prisma.category.delete({ where: { id: category.id } });
    }
  });
});
