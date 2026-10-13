export type ActivityEntity =
  | 'PRODUCT'
  | 'PRICE'
  | 'CURRENCY_RATE'
  | 'CATEGORY'
  | 'ORDER'
  | 'BANNER'
  | 'BRAND'
  | 'COLOR';

export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';

export const ACTIVITY_ENTITIES: ActivityEntity[] = [
  'PRODUCT',
  'PRICE',
  'CURRENCY_RATE',
  'CATEGORY',
  'ORDER',
  'BANNER',
  'BRAND',
  'COLOR',
];

export const ACTIVITY_ACTIONS: ActivityAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'REORDER',
];

export const ACTIVITY_ENTITY_LABEL_KEYS: Record<ActivityEntity, string> = {
  PRODUCT: 'activityEntityProduct',
  PRICE: 'activityEntityPrice',
  CURRENCY_RATE: 'activityEntityRate',
  CATEGORY: 'activityEntityCategory',
  ORDER: 'activityEntityOrder',
  BANNER: 'activityEntityBanner',
  BRAND: 'activityEntityBrand',
  COLOR: 'activityEntityColor',
};

export const ACTIVITY_ACTION_LABEL_KEYS: Record<ActivityAction, string> = {
  CREATE: 'activityActionCreate',
  UPDATE: 'activityActionUpdate',
  DELETE: 'activityActionDelete',
  REORDER: 'activityActionReorder',
};

export type ActivityMeta = Record<string, any> | null;

export type ActivityRow = {
  id: string;
  userId: string | null;
  userName: string;
  entity: ActivityEntity;
  action: ActivityAction;
  targetId: string | null;
  meta: ActivityMeta;
  createdAt: string;
};

export type StaffMember = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  online: boolean;
  totalChanges: number;
  customersAnswered: number;
};

export type HeatmapDay = { date: string; changes: number; chats: number };

export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const HEAD_KEYS: Record<string, string> = {
  'PRODUCT:CREATE': 'activityProductCreate',
  'PRODUCT:UPDATE': 'activityProductUpdate',
  'PRODUCT:DELETE': 'activityProductDelete',
  'PRODUCT:REORDER': 'activityProductReorder',
  'PRICE:CREATE': 'activityPriceCreate',
  'PRICE:UPDATE': 'activityPriceUpdate',
  'PRICE:DELETE': 'activityPriceDelete',
  'CURRENCY_RATE:CREATE': 'activityRateCreate',
  'CURRENCY_RATE:UPDATE': 'activityRateUpdate',
  'CURRENCY_RATE:DELETE': 'activityRateDelete',
  'CATEGORY:CREATE': 'activityCategoryCreate',
  'CATEGORY:UPDATE': 'activityCategoryUpdate',
  'CATEGORY:DELETE': 'activityCategoryDelete',
  'BANNER:CREATE': 'activityBannerCreate',
  'BANNER:UPDATE': 'activityBannerUpdate',
  'BANNER:DELETE': 'activityBannerDelete',
  'BRAND:CREATE': 'activityBrandCreate',
  'BRAND:UPDATE': 'activityBrandUpdate',
  'BRAND:DELETE': 'activityBrandDelete',
  'COLOR:CREATE': 'activityColorCreate',
  'COLOR:UPDATE': 'activityColorUpdate',
  'COLOR:DELETE': 'activityColorDelete',
};

const ORDER_HEAD_KEYS: Record<string, string> = {
  STATUS: 'activityOrderStatus',
  CANCEL: 'activityOrderCancel',
  NOTES: 'activityOrderNotes',
  DELIVERY_FEE: 'activityOrderDeliveryFee',
};

const FIELD_LABEL_KEYS: Record<string, string> = {
  name: 'activityFieldName',
  price: 'activityFieldPrice',
  priceInTmt: 'activityFieldPriceInTmt',
  displayPriceTmt: 'activityFieldDisplayPriceTmt',
  outOfStock: 'activityFieldOutOfStock',
  category: 'activityFieldCategory',
  brand: 'activityFieldBrand',
  product: 'activityFieldProduct',
  rate: 'activityFieldRate',
  popular: 'activityFieldPopular',
  parent: 'activityFieldParent',
  hex: 'activityFieldHex',
  isActive: 'activityFieldIsActive',
  sortOrder: 'activityFieldSortOrder',
  startsAt: 'activityFieldStartsAt',
  endsAt: 'activityFieldEndsAt',
  status: 'activityFieldStatus',
  deliveryPrice: 'activityFieldDeliveryPrice',
  description: 'activityFieldDescription',
  tags: 'activityFieldTags',
  videos: 'activityFieldVideos',
};

const ORDER_STATUS_KEYS: Record<string, string> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
  USER_CANCELLED: 'userCancelled',
  ADMIN_CANCELLED: 'adminCancelled',
};

const ASHGABAT = 'Asia/Ashgabat';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: ASHGABAT,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: ASHGABAT,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const partsOf = (format: Intl.DateTimeFormat, date: Date) =>
  Object.fromEntries(
    format.formatToParts(date).map((part) => [part.type, part.value]),
  );

/** `DD.MM.YYYY HH:mm` in the shop's time zone, the same in every locale. */
export function formatActivityTime(value: string | Date): string {
  const p = partsOf(timeFormat, new Date(value));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export function formatActivityDay(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}.${month}.${year}`;
}

const formatDate = (value: string | Date): string => {
  const p = partsOf(dayFormat, new Date(value));
  return `${p.day}.${p.month}.${p.year}`;
};

export function relativeSeen(
  lastSeenAt: string | null,
  now: Date,
  t: Translate,
): string {
  if (lastSeenAt == null) return t('activityNeverSeen');
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(lastSeenAt).getTime()) / 1000),
  );
  if (seconds < 60) return t('activityJustNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('activityMinutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('activityHoursAgo', { count: hours });
  return t('activityDaysAgo', { count: Math.floor(hours / 24) });
}

function formatValue(field: string, value: unknown, t: Translate): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return t(value ? 'yes' : 'no');
  if (field === 'price') return `$${value}`;
  if (['priceInTmt', 'displayPriceTmt', 'deliveryPrice'].includes(field)) {
    return `${value} TMT`;
  }
  if (field === 'startsAt' || field === 'endsAt') {
    return formatDate(value as string);
  }
  if (field === 'status') {
    const key = ORDER_STATUS_KEYS[String(value)];
    return key ? t(key) : String(value);
  }
  return String(value);
}

const fieldLabel = (field: string, t: Translate): string =>
  FIELD_LABEL_KEYS[field] ? t(FIELD_LABEL_KEYS[field]) : field;

function headFor(row: ActivityRow, t: Translate): string {
  const meta = row.meta ?? {};
  const name = String(meta.name ?? '');

  if (row.entity === 'PRICE' && row.action === 'UPDATE' && meta.count != null) {
    return meta.rate != null
      ? t('activityPricesMovedToRate', { count: meta.count, rate: meta.rate })
      : t('activityPricesBulk', { count: meta.count });
  }
  if (row.entity === 'ORDER') {
    const key = ORDER_HEAD_KEYS[String(meta.kind)] ?? ORDER_HEAD_KEYS.STATUS;
    return t(key, { orderNumber: String(meta.orderNumber ?? '') });
  }
  if (row.entity === 'CATEGORY' && row.action === 'REORDER') {
    return t(
      meta.direction === 'up'
        ? 'activityCategoryMovedUp'
        : 'activityCategoryMovedDown',
      { name },
    );
  }
  if (row.entity === 'BANNER') {
    return t(HEAD_KEYS[`BANNER:${row.action}`], {
      position: String(meta.position ?? ''),
    });
  }
  const key = HEAD_KEYS[`${row.entity}:${row.action}`];
  return key ? t(key, { name }) : `${row.entity} ${row.action}`;
}

function detailsFor(row: ActivityRow, t: Translate): string[] {
  const meta = row.meta ?? {};
  const details: string[] = [];

  if (row.entity === 'PRICE' && row.action === 'UPDATE' && meta.count != null) {
    if (
      Array.isArray(meta.fields) &&
      meta.fields.length > 0 &&
      meta.rate == null
    ) {
      details.push(
        t('activityEditedFields', {
          fields: meta.fields
            .map((field: string) => fieldLabel(field, t))
            .join(', '),
        }),
      );
    }
    return details;
  }

  if (row.action === 'CREATE') {
    if (meta.category)
      details.push(t('activityInCategory', { category: meta.category }));
    if (meta.parent)
      details.push(t('activityInCategory', { category: meta.parent }));
    if (meta.images != null)
      details.push(t('activityImagesCount', { count: meta.images }));
    if (row.entity === 'PRICE' && meta.price != null)
      details.push(`$${meta.price}`);
    if (row.entity === 'PRICE' && meta.product) {
      details.push(t('activityConnectedTo', { product: meta.product }));
    }
    if (row.entity === 'CURRENCY_RATE' && meta.rate != null) {
      details.push(`${fieldLabel('rate', t)}: ${meta.rate}`);
    }
    if (row.entity === 'COLOR' && meta.hex) details.push(String(meta.hex));
  }

  const changes = (meta.changes ?? {}) as Record<
    string,
    { from: unknown; to: unknown }
  >;
  Object.entries(changes).forEach(([field, change]) => {
    details.push(
      `${fieldLabel(field, t)}: ${formatValue(field, change.from, t)} → ${formatValue(field, change.to, t)}`,
    );
  });

  if (Array.isArray(meta.edited) && meta.edited.length > 0) {
    details.push(
      t('activityEditedFields', {
        fields: meta.edited
          .map((field: string) => fieldLabel(field, t))
          .join(', '),
      }),
    );
  }
  if (meta.imagesAdded)
    details.push(t('activityImagesAdded', { count: meta.imagesAdded }));
  if (meta.imagesRemoved)
    details.push(t('activityImagesRemoved', { count: meta.imagesRemoved }));
  if (meta.imagesReordered) details.push(t('activityImagesReordered'));
  if (meta.imageChanged) details.push(t('activityImageChanged'));
  if (meta.imagesChanged) details.push(t('activityImagesChanged'));
  if (meta.redirectChanged) details.push(t('activityRedirectChanged'));
  if (meta.notesChanged) details.push(t('activityNotesAlso'));
  if (meta.reason) details.push(t('activityReason', { reason: meta.reason }));
  if (meta.recalculatedPrices) {
    details.push(t('activityRecalculated', { count: meta.recalculatedPrices }));
  }
  if (meta.reassignedPrices) {
    details.push(t('activityReassigned', { count: meta.reassignedPrices }));
  }
  if (row.action === 'DELETE' && meta.subcategories != null) {
    details.push(t('activitySubcategories', { count: meta.subcategories }));
  }
  if (row.action === 'DELETE' && meta.products != null) {
    details.push(t('activityProductsCount', { count: meta.products }));
  }

  return details;
}

/** One plain sentence for the feed, built from structured `meta` at read time. */
export function activitySentence(row: ActivityRow, t: Translate): string {
  const details = detailsFor(row, t);
  const head = headFor(row, t);
  return details.length > 0 ? `${head}: ${details.join('; ')}` : head;
}

export type HeatmapCell = {
  date: string;
  changes: number;
  chats: number;
  level: 0 | 1 | 2 | 3 | 4;
};

const weekdayMonFirst = (day: string): number =>
  (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

const nextDay = (day: string): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/**
 * Monday-first columns of seven, `from`..`to` inclusive. Cells outside the range
 * (the padding before `from` and after `to`) are null. Intensity is relative to
 * the busiest day so a quiet admin's year is still readable.
 */
export function heatmapGrid(
  days: HeatmapDay[],
  from: string,
  to: string,
): (HeatmapCell | null)[][] {
  const byDay = new Map(days.map((day) => [day.date, day]));
  const max = Math.max(0, ...days.map((day) => day.changes + day.chats));

  const weeks: (HeatmapCell | null)[][] = [];
  let week: (HeatmapCell | null)[] = Array.from(
    { length: weekdayMonFirst(from) },
    () => null,
  );

  for (let day = from; day <= to; day = nextDay(day)) {
    const entry = byDay.get(day);
    const changes = entry?.changes ?? 0;
    const chats = entry?.chats ?? 0;
    const total = changes + chats;
    const level = (
      total === 0 || max === 0 ? 0 : Math.min(4, Math.ceil((total / max) * 4))
    ) as HeatmapCell['level'];
    week.push({ date: day, changes, chats, level });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}
