import { NotificationType } from '@prisma/client';
import dbClient from '../../../src/lib/dbClient';
import { sendFCMWithCallbackFallback } from '../../../src/lib/fcm/fcmService';
import { countStaleProducts } from '../../../src/lib/priceStalenessQueries';
import { sendNotificationToWebSocketServer } from '../../../src/ws-server/lib/utils';

const DEFAULT_CRON = '0 9 * * *'; // 09:00 daily
const TIMEZONE = 'Asia/Ashgabat';

// Notification text is stored in the DB as Russian, like the order/admin ones.
export const PRICE_STALENESS_TITLE = 'Цены требуют обновления';

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
  const content = buildPriceStalenessContent(orange, red);

  const outcomes = await Promise.allSettled(
    admins.map(async ({ id }) => {
      const notification = await dbClient.inAppNotification.create({
        data: {
          userId: id,
          type: NotificationType.PRICE_STALENESS,
          title: PRICE_STALENESS_TITLE,
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
