import { getSlack } from '@/lib/slack';
import { UserOrder, UserOrderStatus } from '@prisma/client';

const SLACK_BOT_NAME = 'order_bot_webhook';

/**
 * Sends a Slack notification when a new order is created
 */
export async function notifyOrderCreated(order: UserOrder): Promise<void> {
  const slack = getSlack(SLACK_BOT_NAME);
  if (!slack) {
    console.warn(
      `[SlackNotification] Slack client '${SLACK_BOT_NAME}' not found. Make sure SLACK_order_bot_webhook is set in environment variables.`,
    );
    return;
  }

  const message = `🛒 *New Order Created*\n\n*Order Number:* ${order.orderNumber}\n*Customer:* ${order.userName || 'N/A'}\n*Phone:* ${order.deliveryPhone}\n*Address:* ${order.deliveryAddress}\n*Total:* ${parseFloat(order.totalPrice).toFixed(2)} TMT\n*Status:* ${order.status}`;

  const result = await slack.send(message);
  if (!result.success) {
    console.error(
      `[SlackNotification] Failed to send order creation notification:`,
      result.error,
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
      `[SlackNotification] Slack client '${SLACK_BOT_NAME}' not found. Make sure SLACK_order_bot_webhook is set in environment variables.`,
    );
    return;
  }

  const reasonText = order.cancellationReason
    ? `\n*Reason:* ${order.cancellationReason}`
    : '';
  const message = `❌ *Order Cancelled by User*\n\n*Order Number:* ${order.orderNumber}\n*Customer:* ${order.userName || 'N/A'}\n*Phone:* ${order.deliveryPhone}${reasonText}\n*Total:* ${parseFloat(order.totalPrice).toFixed(2)} TMT`;

  const result = await slack.send(message);
  if (!result.success) {
    console.error(
      `[SlackNotification] Failed to send order cancellation notification:`,
      result.error,
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
      `[SlackNotification] Slack client '${SLACK_BOT_NAME}' not found. Make sure SLACK_order_bot_webhook is set in environment variables.`,
    );
    return;
  }

  let statusEmoji = '📋';
  if (order.status === 'COMPLETED') {
    statusEmoji = '✅';
  } else if (order.status === 'ADMIN_CANCELLED') {
    statusEmoji = '🚫';
  } else if (order.status === 'IN_PROGRESS') {
    statusEmoji = '🔄';
  }

  let message = `${statusEmoji} *Order Status Updated*\n\n*Order Number:* ${order.orderNumber}\n*Customer:* ${order.userName || 'N/A'}\n*Previous Status:* ${previousStatus}\n*New Status:* ${order.status}`;

  if (order.status === 'ADMIN_CANCELLED' && order.cancellationReason) {
    message += `\n*Cancellation Reason:* ${order.cancellationReason}`;
  }

  if (order.adminNotes) {
    message += `\n*Admin Notes:* ${order.adminNotes}`;
  }

  const result = await slack.send(message);
  if (!result.success) {
    console.error(
      `[SlackNotification] Failed to send order status update notification:`,
      result.error,
    );
  }
}
