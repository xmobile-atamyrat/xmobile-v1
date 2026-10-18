import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import os from 'os';
import path from 'path';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const requireStaffBearerAuth = vi.fn();

vi.mock('@/lib/dbClient', () => ({
  default: {
    product: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    category: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  },
}));
vi.mock('@/pages/api/product/index.page', () => ({
  createCompressedImg: vi.fn(),
  createCompressedImgUrl: vi.fn(),
}));
vi.mock('@/pages/api/utils/staffAuth', () => ({
  requireStaffBearerAuth: (...args: unknown[]) =>
    requireStaffBearerAuth(...args),
}));

describe('/api/localImage', () => {
  let root: string;
  let productsDir: string;
  let secretFile: string;
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-image-'));
    productsDir = path.join(root, 'products');
    fs.mkdirSync(productsDir);
    secretFile = path.join(root, 'secret.env');
    fs.writeFileSync(secretFile, 'TOKEN=shh');
    vi.stubEnv('PRODUCT_IMAGES_DIR', productsDir);
    handler = (await import('@/pages/api/localImage.page')).default;
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    fs.rmSync(root, { recursive: true, force: true });
  });

  beforeEach(() => {
    requireStaffBearerAuth.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  async function call(method: 'GET' | 'DELETE', imgUrl: string) {
    const { req, res } = createMocks({
      method,
      url: '/api/localImage',
      query: { imgUrl },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return res;
  }

  it('serves an image inside an image folder', async () => {
    const img = path.join(productsDir, 'a.jpg');
    fs.writeFileSync(img, 'jpeg-bytes');

    const res = await call('GET', img);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().toString()).toBe('jpeg-bytes');
  });

  it('does not serve a file outside the image folders', async () => {
    expect((await call('GET', secretFile))._getStatusCode()).toBe(404);
    expect(
      (
        await call('GET', path.join(productsDir, '..', 'secret.env'))
      )._getStatusCode(),
    ).toBe(404);
  });

  it('requires staff auth to delete', async () => {
    const img = path.join(productsDir, 'b.jpg');
    fs.writeFileSync(img, 'x');
    requireStaffBearerAuth.mockImplementation(async (_req, res) => {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return false;
    });

    const res = await call('DELETE', img);
    expect(res._getStatusCode()).toBe(401);
    expect(fs.existsSync(img)).toBe(true);
  });

  it('lets staff delete an image but not a file outside the image folders', async () => {
    requireStaffBearerAuth.mockResolvedValue(true);
    const img = path.join(productsDir, 'c.jpg');
    fs.writeFileSync(img, 'x');

    expect((await call('DELETE', secretFile))._getStatusCode()).toBe(404);
    expect(fs.existsSync(secretFile)).toBe(true);

    expect((await call('DELETE', img))._getStatusCode()).toBe(200);
    expect(fs.existsSync(img)).toBe(false);
  });
});
