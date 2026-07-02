import dbClient from '@/lib/dbClient';
import {
  BannerImgUrls,
  getActiveBanners,
  getAllBanners,
} from '@/lib/promoBanners';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import { localeOptions } from '@/pages/lib/constants';
import { isRemoteImageUrl } from '@/pages/lib/mediaUrls';
import { ResponseApi } from '@/pages/lib/types';
import { PromoBanner } from '@prisma/client';
import fs from 'fs';
import multiparty from 'multiparty';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

const filepath = 'src/pages/api/promo-banner.page.ts';

/** All accepted image field keys: `default` plus one per supported locale. */
const IMAGE_KEYS = ['default', ...localeOptions];

type Fields = Record<string, string[] | undefined>;
type Files = Record<string, { path: string }[] | undefined>;

function firstField(fields: Fields, key: string): string | undefined {
  const v = fields[key];
  if (v == null || v.length === 0) return undefined;
  return v[0];
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
}

function parseDate(value: string | undefined): Date | null {
  if (value == null || value.trim() === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function unlinkIfLocal(storedPath: string | undefined | null) {
  if (!storedPath || isRemoteImageUrl(storedPath)) return;
  try {
    if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
  } catch (error) {
    console.error(filepath, error);
  }
}

/** Build the per-key image map from uploaded files / pasted URLs. */
function collectImgUrls(fields: Fields, files: Files): Record<string, string> {
  const imgUrls: Record<string, string> = {};
  IMAGE_KEYS.forEach((key) => {
    const fieldName = `imageUrl_${key}`;
    const uploaded = files[fieldName]?.[0]?.path;
    const pasted = firstField(fields, fieldName);
    if (uploaded) imgUrls[key] = uploaded;
    else if (pasted) imgUrls[key] = pasted;
  });
  return imgUrls;
}

/**
 * Validate redirect target. Returns the two relation columns
 * (`redirectCategoryId`/`redirectProductId`, both null when no redirect) or an error.
 */
interface RedirectResult {
  error?: string;
  redirectCategoryId: string | null;
  redirectProductId: string | null;
}

async function resolveRedirectInput(fields: Fields): Promise<RedirectResult> {
  const typeRaw = firstField(fields, 'redirectType');
  const redirectId = firstField(fields, 'redirectId') || null;
  const none: Omit<RedirectResult, 'error'> = {
    redirectCategoryId: null,
    redirectProductId: null,
  };

  if (!typeRaw || typeRaw === 'NONE') {
    return none;
  }
  if (typeRaw !== 'CATEGORY' && typeRaw !== 'PRODUCT') {
    return { error: 'invalidRedirectType', ...none };
  }
  if (!redirectId) {
    return { error: 'redirectTargetRequired', ...none };
  }

  const exists =
    typeRaw === 'CATEGORY'
      ? await dbClient.category.findFirst({
          where: { id: redirectId, deletedAt: null },
          select: { id: true },
        })
      : await dbClient.product.findFirst({
          where: { id: redirectId, deletedAt: null },
          select: { id: true },
        });
  if (!exists) {
    return { error: 'redirectTargetNotFound', ...none };
  }
  return typeRaw === 'CATEGORY'
    ? { redirectCategoryId: redirectId, redirectProductId: null }
    : { redirectCategoryId: null, redirectProductId: redirectId };
}

/**
 * Display order must be unique among active banners (inactive ones don't affect
 * the carousel order, so duplicates there are allowed). Returns true on conflict.
 */
async function hasActiveOrderConflict(
  sortOrder: number,
  excludeId?: string,
): Promise<boolean> {
  const conflict = await dbClient.promoBanner.findFirst({
    where: {
      deletedAt: null,
      isActive: true,
      sortOrder,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return conflict != null;
}

async function handlePostBanner(req: NextApiRequest): Promise<{
  success: boolean;
  status: number;
  message?: string;
  data?: PromoBanner;
}> {
  const form = new multiparty.Form({
    uploadDir: process.env.BANNER_IMAGES_DIR,
  });

  return new Promise((resolve) => {
    form.parse(req, async (err, fields: Fields, files: Files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
        return;
      }
      try {
        const imgUrls = collectImgUrls(fields, files);
        if (!imgUrls.default) {
          resolve({
            success: false,
            message: 'defaultBannerImageRequired',
            status: 400,
          });
          return;
        }

        const redirect = await resolveRedirectInput(fields);
        if (redirect.error) {
          resolve({ success: false, message: redirect.error, status: 400 });
          return;
        }

        const isActive = parseBool(firstField(fields, 'isActive'), true);
        const sortOrder = parseInt(firstField(fields, 'sortOrder') ?? '', 10);

        if (Number.isNaN(sortOrder) || sortOrder < 1) {
          resolve({
            success: false,
            message: 'bannerOrderInvalid',
            status: 400,
          });
          return;
        }

        if (isActive && (await hasActiveOrderConflict(sortOrder))) {
          resolve({
            success: false,
            message: 'bannerOrderConflict',
            status: 400,
          });
          return;
        }

        const banner = await dbClient.promoBanner.create({
          data: {
            imgUrls: imgUrls as BannerImgUrls,
            redirectCategoryId: redirect.redirectCategoryId,
            redirectProductId: redirect.redirectProductId,
            isActive,
            sortOrder,
            startsAt: parseDate(firstField(fields, 'startsAt')),
            endsAt: parseDate(firstField(fields, 'endsAt')),
          },
        });
        resolve({ success: true, data: banner, status: 201 });
      } catch (error) {
        console.error(filepath, error);
        resolve({
          success: false,
          message: "Couldn't create banner",
          status: 500,
        });
      }
    });
  });
}

async function handleEditBanner(
  req: NextApiRequest,
  bannerId: string,
): Promise<{
  success: boolean;
  status: number;
  message?: string;
  data?: PromoBanner;
}> {
  const form = new multiparty.Form({
    uploadDir: process.env.BANNER_IMAGES_DIR,
  });

  return new Promise((resolve) => {
    form.parse(req, async (err, fields: Fields, files: Files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
        return;
      }
      try {
        const existing = await dbClient.promoBanner.findFirst({
          where: { id: bannerId, deletedAt: null },
        });
        if (!existing) {
          resolve({ success: false, message: 'Banner not found', status: 404 });
          return;
        }

        const currentImgUrls = {
          ...(existing.imgUrls as unknown as Record<string, string>),
        };
        const incoming = collectImgUrls(fields, files);
        // Replace any provided images (unlink old local files first).
        Object.entries(incoming).forEach(([key, value]) => {
          unlinkIfLocal(currentImgUrls[key]);
          currentImgUrls[key] = value;
        });
        // Clear per-locale overrides the admin removed (never the default).
        const cleared: string[] = JSON.parse(
          firstField(fields, 'clearedImages') ?? '[]',
        );
        cleared.forEach((key) => {
          if (key === 'default') return;
          unlinkIfLocal(currentImgUrls[key]);
          delete currentImgUrls[key];
        });

        if (!currentImgUrls.default) {
          resolve({
            success: false,
            message: 'defaultBannerImageRequired',
            status: 400,
          });
          return;
        }

        const redirect = await resolveRedirectInput(fields);
        if (redirect.error) {
          resolve({ success: false, message: redirect.error, status: 400 });
          return;
        }

        const isActive = parseBool(
          firstField(fields, 'isActive'),
          existing.isActive,
        );
        const sortOrder = parseInt(
          firstField(fields, 'sortOrder') ?? String(existing.sortOrder),
          10,
        );

        if (Number.isNaN(sortOrder) || sortOrder < 1) {
          resolve({
            success: false,
            message: 'bannerOrderInvalid',
            status: 400,
          });
          return;
        }

        if (isActive && (await hasActiveOrderConflict(sortOrder, bannerId))) {
          resolve({
            success: false,
            message: 'bannerOrderConflict',
            status: 400,
          });
          return;
        }

        const banner = await dbClient.promoBanner.update({
          where: { id: bannerId },
          data: {
            imgUrls: currentImgUrls as BannerImgUrls,
            redirectCategoryId: redirect.redirectCategoryId,
            redirectProductId: redirect.redirectProductId,
            isActive,
            sortOrder,
            startsAt: parseDate(firstField(fields, 'startsAt')),
            endsAt: parseDate(firstField(fields, 'endsAt')),
          },
        });
        resolve({ success: true, data: banner, status: 200 });
      } catch (error) {
        console.error(filepath, error);
        resolve({
          success: false,
          message: "Couldn't edit banner",
          status: 500,
        });
      }
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method, query } = req;

  if (method === 'GET') {
    try {
      if (query.all === 'true') {
        if (!(await requireStaffBearerAuth(req, res))) return undefined;
        const data = await getAllBanners();
        return res.status(200).json({ success: true, data });
      }
      const data = await getActiveBanners();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't get banners" });
    }
  }

  if (method === 'POST') {
    if (!(await requireStaffBearerAuth(req, res))) return undefined;
    const { status, success, data, message } = await handlePostBanner(req);
    const retData: ResponseApi = { success };
    if (message) retData.message = message;
    if (data) retData.data = data;
    return res.status(status).json(retData);
  }

  if (method === 'PUT') {
    if (!(await requireStaffBearerAuth(req, res))) return undefined;
    const bannerId = query.id as string | undefined;
    if (!bannerId) {
      return res
        .status(400)
        .json({ success: false, message: 'Banner ID not provided' });
    }
    const { status, success, data, message } = await handleEditBanner(
      req,
      bannerId,
    );
    const retData: ResponseApi = { success };
    if (message) retData.message = message;
    if (data) retData.data = data;
    return res.status(status).json(retData);
  }

  if (method === 'DELETE') {
    if (!(await requireStaffBearerAuth(req, res))) return undefined;
    const bannerId = query.id as string | undefined;
    if (!bannerId) {
      return res
        .status(400)
        .json({ success: false, message: 'Banner ID not provided' });
    }
    try {
      const existing = await dbClient.promoBanner.findFirst({
        where: { id: bannerId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: 'Banner not found' });
      }
      await dbClient.promoBanner.update({
        where: { id: bannerId },
        data: { deletedAt: new Date() },
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't delete banner" });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
