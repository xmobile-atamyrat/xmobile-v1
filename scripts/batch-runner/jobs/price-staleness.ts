import { NotificationType } from '@prisma/client';
import dbClient from '../../../src/lib/dbClient';
import { sendFCMWithCallbackFallback } from '../../../src/lib/fcm/fcmService';
import { countStaleProducts } from '../../../src/lib/priceStalenessQueries';
import { sendNotificationToWebSocketServer } from '../../../src/ws-server/lib/utils';

const DEFAULT_CRON = '0 9 * * *'; // 09:00 daily
const TIMEZONE = 'Asia/Ashgabat';

// Notification text is stored in the DB as Russian, like the order/admin ones.

/** Russian plural: 1, 21 → one; 2–4, 22–24 → few; 0, 5–20, 11–14 → many. */
export function ruPlural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// A sentence gets its own count. `nom` is "N товар/товара/товаров" (after a
// number, as a subject), `gen` is "N товара/товаров" (after "у", "для"), and
// `v` picks the singular or plural wording for whatever agrees with it.
type TitleParts = {
  nom: string;
  gen: string;
  v: (singular: string, plural: string) => string;
};

// The daily title, one per day in turn. Add or reword freely: every line
// must read right for 1, 3 and 5 (the tests check each one renders).
export const PRICE_STALENESS_TITLES: ((p: TitleParts) => string)[] = [
  ({ nom, v }) =>
    `${nom} ${v('сам себя не обновит', 'сами себя не обновят')} — помоги ${v('ему', 'им')}!`,
  ({ nom, v }) =>
    `${nom} ${v('собрал', 'собрали')} чемоданы. Обнови цены, пока не ${v('ушёл', 'ушли')}! 🧳`,
  ({ gen }) => `Цены у ${gen} покрылись пылью 🕸`,
  ({ nom, v }) =>
    `${nom} ${v('живёт', 'живут')} в прошлом. Верни ${v('его', 'их')} в настоящее! ⏰`,
  ({ gen }) => `Курс меняется, а цены у ${gen} — нет. Подозрительно… 🤨`,
  ({ nom, v }) => `${nom} ${v('скучает', 'скучают')} по тебе 🥺`,
  ({ nom, v }) =>
    `${nom} ${v('планирует', 'планируют')} покинуть магазин, если не обновить ${v('его цену', 'их цены')} сегодня!`,
  ({ nom }) => `Тук-тук! Это ${nom} с устаревшими ценами 🚪`,
  ({ nom, v }) => `${nom} ${v('просит', 'просят')} свежую цену на завтрак ☕`,
  ({ nom, v }) => `Минутка внимания: ${nom} ${v('ждёт', 'ждут')} новую цену ⏳`,
  ({ nom }) => `Спасательная операция: ${nom} с устаревшей ценой 🛟`,
  ({ nom, v }) =>
    `${nom} ${v('объявил', 'объявили')} забастовку: «${v('Обновите мне цену', 'Обновите нам цены')}!» ✊`,
  ({ nom, v }) =>
    `Цена — не вино, с годами лучше не становится. ${nom} ${v('ждёт', 'ждут')} обновления 🍷`,
  ({ nom }) => `Пять минут твоего времени — и ${nom} снова в строю 💪`,
  ({ nom, v }) =>
    `Мы нашли ${nom} из прошлого. Отправим ${v('его', 'их')} в будущее? 🚀`,
  ({ nom, v }) =>
    `${nom} ${v('шепчет', 'шепчут')}: «${v('Проверь меня', 'Проверь нас')}…» 👀`,
  ({ gen }) => `Сегодня отличный день, чтобы обновить цены у ${gen} 🌞`,
  ({ nom, v }) =>
    `${nom} ${v('сам себя не проверит', 'сами себя не проверят')}. Это работа для героя 🦸`,
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Ashgabat is UTC+5 all year (no daylight saving).
const ASHGABAT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * The title for `count` stale products on the day of `now`. The days take the
 * list in turn, so a line never repeats on the next day and every line comes
 * up once before any comes back. No state to store, unlike a random pick.
 */
export function buildPriceStalenessTitle(
  count: number,
  now: Date = new Date(),
): string {
  const day = Math.floor((now.getTime() + ASHGABAT_OFFSET_MS) / MS_PER_DAY);
  const template = PRICE_STALENESS_TITLES[day % PRICE_STALENESS_TITLES.length];
  return template({
    nom: `${count} ${ruPlural(count, 'товар', 'товара', 'товаров')}`,
    gen: `${count} ${ruPlural(count, 'товара', 'товаров', 'товаров')}`,
    v: (singular, plural) =>
      ruPlural(count, 'one', 'few', 'many') === 'one' ? singular : plural,
  });
}

export function buildPriceStalenessContent(
  orange: number,
  red: number,
): string {
  // "Label — number" keeps the grammar right for every count (no "1 товаров").
  // The buckets are exclusive: orange is 30–89 days, red is 90+.
  const parts: string[] = [];
  if (orange > 0) parts.push(`1–3 месяца — ${orange}`);
  if (red > 0) parts.push(`больше 3 месяцев — ${red}`);
  return `Товары без обновления цены: ${parts.join(', ')}`;
}

export interface PriceStalenessSummary {
  orange: number;
  red: number;
  recipients: number;
  sent: number;
  failed: number;
}

export async function runPriceStaleness(): Promise<PriceStalenessSummary> {
  const { orange, red } = await countStaleProducts(dbClient);
  const summary: PriceStalenessSummary = {
    orange,
    red,
    recipients: 0,
    sent: 0,
    failed: 0,
  };
  if (orange === 0 && red === 0) {
    console.log('[PriceStaleness] No stale prices, no notification.');
    return summary;
  }

  const admins = await dbClient.user.findMany({
    where: { grade: { in: ['ADMIN', 'SUPERUSER'] }, deletedAt: null },
    select: { id: true },
  });
  summary.recipients = admins.length;
  const title = buildPriceStalenessTitle(orange + red);
  const content = buildPriceStalenessContent(orange, red);

  const outcomes = await Promise.allSettled(
    admins.map(async ({ id }) => {
      const notification = await dbClient.inAppNotification.create({
        data: {
          userId: id,
          type: NotificationType.PRICE_STALENESS,
          title,
          content,
          isRead: false,
        },
      });
      await sendFCMWithCallbackFallback(
        id,
        notification,
        sendNotificationToWebSocketServer,
      );
    }),
  );
  outcomes.forEach((o, i) => {
    if (o.status === 'fulfilled') {
      summary.sent += 1;
    } else {
      summary.failed += 1;
      console.error(
        `[PriceStaleness] Failed for user ${admins[i].id}:`,
        o.reason,
      );
    }
  });

  console.log(
    `[PriceStaleness] orange ${orange}, red ${red}; recipients ${summary.recipients}, ok ${summary.sent}, failed ${summary.failed}.`,
  );
  return summary;
}

export const priceStalenessJob = {
  id: 'price-staleness',
  schedule: {
    type: 'cron' as const,
    expr: DEFAULT_CRON,
    timezone: TIMEZONE,
  },
  run: async (): Promise<void> => {
    await runPriceStaleness();
  },
};
