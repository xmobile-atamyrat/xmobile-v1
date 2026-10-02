import { getSlack } from '@/lib/slack';
import { isPickupOrder } from '@/pages/lib/orderDelivery';
import { UserOrder, UserOrderStatus } from '@prisma/client';

const SLACK_BOT_NAME = 'ORDER_BOT_WEBHOOK';

// Translate status to Russian
const statusTranslations: Record<string, string> = {
  PENDING: 'Ожидает',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершен',
  USER_CANCELLED: 'Отменен пользователем',
  ADMIN_CANCELLED: 'Отменен администратором',
};

/**
 * Sends a Slack notification when a new order is created
 */
export async function notifyOrderCreated(order: UserOrder): Promise<void> {
  const slack = getSlack(SLACK_BOT_NAME);
  if (!slack) {
    console.warn(
      `[SlackNotification] Slack client '${SLACK_BOT_NAME}' not found. Make sure ${SLACK_BOT_NAME} is set in environment variables.`,
    );
    return;
  }

  const orderLink = `https://xmobile.com.tm/orders/admin/${order.id}`;
  const statusRu = statusTranslations[order.status as string] || order.status;
  const deliveryRu = isPickupOrder(order)
    ? '*Получение:* Самовывоз'
    : `*Получение:* Доставка (цену доставки нужно указать в заказе)\n*Адрес:* ${order.deliveryAddress}`;
  const message = `🛒 *Создан новый заказ*\n\n*Номер заказа:* ${order.orderNumber}\n*Клиент:* ${order.userName || 'Н/Д'}\n*Телефон:* ${order.deliveryPhone}\n${deliveryRu}\n*Сумма:* ${parseFloat(order.totalPrice).toFixed(2)} TMT\n*Статус:* ${statusRu}\n\n<${orderLink}|Открыть заказ>`;

  const result = await slack.send(message);
  if (!result.success) {
    console.error(
      `[SlackNotification] Failed to send order creation notification:`,
      result,
    );
  }
}

/**
 * Sends a Slack notification when an order is cancelled by a user
 */
export async function notifyOrderCancelledByUser(
  order: UserOrder,
): Promise<void> {
  const slack = getSlack(SLACK_BOT_NAME);
  if (!slack) {
    console.warn(
      `[SlackNotification] Slack client '${SLACK_BOT_NAME}' not found. Make sure ${SLACK_BOT_NAME} is set in environment variables.`,
    );
    return;
  }

  const orderLink = `https://xmobile.com.tm/orders/admin/${order.id}`;
  const reasonText = order.cancellationReason
    ? `\n*Причина:* ${order.cancellationReason}`
    : '';
  const message = `❌ *Заказ отменен пользователем*\n\n*Номер заказа:* ${order.orderNumber}\n*Клиент:* ${order.userName || 'Н/Д'}\n*Телефон:* ${order.deliveryPhone}${reasonText}\n*Сумма:* ${parseFloat(order.totalPrice).toFixed(2)} TMT\n\n<${orderLink}|Открыть заказ>`;

  const result = await slack.send(message);
  if (!result.success) {
    console.error(
      `[SlackNotification] Failed to send order cancellation notification:`,
      result,
    );
  }
}

/**
 * Sends a Slack notification when order status is updated by admin
 */
export async function notifyOrderStatusUpdated(
  order: UserOrder,
  previousStatus: UserOrderStatus,
): Promise<void> {
  const slack = getSlack(SLACK_BOT_NAME);
  if (!slack) {
    console.warn(
      `[SlackNotification] Slack client '${SLACK_BOT_NAME}' not found. Make sure ${SLACK_BOT_NAME} is set in environment variables.`,
    );
    return;
  }

  const orderLink = `https://xmobile.com.tm/orders/admin/${order.id}`;
  let statusEmoji = '📋';
  if (order.status === 'COMPLETED') {
    statusEmoji = '✅';
  } else if (
    order.status === 'ADMIN_CANCELLED' ||
    order.status === 'USER_CANCELLED'
  ) {
    statusEmoji = '🚫';
  } else if (order.status === 'IN_PROGRESS' || order.status === 'PENDING') {
    statusEmoji = '🔄';
  }

  const previousStatusRu =
    statusTranslations[previousStatus as string] || previousStatus;
  const newStatusRu =
    statusTranslations[order.status as string] || order.status;

  let message = `${statusEmoji} *Статус заказа обновлен*\n\n*Номер заказа:* ${order.orderNumber}\n*Клиент:* ${order.userName || 'Н/Д'}\n*Предыдущий статус:* ${previousStatusRu}\n*Новый статус:* ${newStatusRu}`;

  if (order.status === 'ADMIN_CANCELLED' && order.cancellationReason) {
    message += `\n*Причина отмены:* ${order.cancellationReason}`;
  }

  if (order.adminNotes) {
    message += `\n*Заметки администратора:* ${order.adminNotes}`;
  }

  message += `\n\n<${orderLink}|Открыть заказ>`;

  const result = await slack.send(message);
  if (!result.success) {
    console.error(
      `[SlackNotification] Failed to send order status update notification:`,
      result,
    );
  }
}
