import dbClient from '@/lib/dbClient';
import { sendFCMWithCallbackFallback } from '@/lib/fcm/fcmService';
import { getPrice } from '@/pages/api/prices/index.page';
import {
  createNotificationForOrderStatusUpdate,
  createNotificationsForAdmins,
  sendNotificationToWebSocketServer,
} from '@/ws-server/lib/utils';
import { Prisma, UserOrder, UserOrderStatus } from '@prisma/client';
import { calculateTotalPrice, generateOrderNumber } from '../utils/orderUtils';
import {
  notifyOrderCancelledByUser,
  notifyOrderCreated,
  notifyOrderStatusUpdated,
} from '../utils/slackNotifications';

const squareBracketRegex = /\[([^\]]+)\]/;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface CreateOrderData {
  userId: string;
  deliveryAddress: string;
  deliveryPhone: string;
  notes?: string;
  updateAddress?: boolean;
}

export interface CreateGuestOrderData {
  guestSessionId: string;
  deliveryAddress: string;
  deliveryPhone: string;
  notes?: string;
  userName?: string;
}

export interface GetOrdersFilters {
  userId?: string; // For filtering user's own orders
  searchKeyword?: string;
  status?: UserOrderStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

async function buildOrderItemsData(
  cartItems: Array<{
    quantity: number;
    productId: string;
    product: { name: string; price: string | null };
  }>,
) {
  return Promise.all(
    cartItems.map(async (item) => {
      let productPrice = '0';
      if (item.product.price) {
        const priceMatch = item.product.price.match(squareBracketRegex);
        if (priceMatch) {
          const priceId = priceMatch[1];
          const price = await getPrice(priceId);
          if (price && price.priceInTmt) {
            productPrice = price.priceInTmt;
          }
        }
      }
      return {
        quantity: item.quantity,
        productName: item.product.name,
        productPrice,
        productId: item.productId,
      };
    }),
  );
}

/**
 * Creates a new order from user's cart items
 */
export async function createOrder(data: CreateOrderData): Promise<UserOrder> {
  const { userId, deliveryAddress, deliveryPhone, notes, updateAddress } = data;

  // Get user's cart items with products
  const cartItems = await dbClient.cartItem.findMany({
    where: {
      userId,
      product: { deletedAt: null },
    },
    include: { product: true },
  });

  if (cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  // Get user data for snapshot
  const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate total price
  const totalPrice = await calculateTotalPrice(cartItems);

  // Generate order number
  const orderNumber = await generateOrderNumber();

  const orderItemsData = await buildOrderItemsData(cartItems);

  // Create order with items in a transaction
  const order = await dbClient.$transaction(async (tx) => {
    // Create the order
    const newOrder = await tx.userOrder.create({
      data: {
        orderNumber,
        userId,
        userName: user.name,
        userEmail: user.email,
        deliveryAddress,
        deliveryPhone,
        notes,
        totalPrice,
        status: 'PENDING',
        items: {
          create: orderItemsData,
        },
      },
      include: { items: true },
    });

    // Clear cart items
    await tx.cartItem.deleteMany({
      where: { userId },
    });

    // Update user address if requested
    if (updateAddress) {
      await tx.user.update({
        where: { id: userId },
        data: { address: deliveryAddress },
      });
    }

    return newOrder;
  });

  // Send Slack notification (fire and forget - don't block on this)
  notifyOrderCreated(order).catch((error) => {
    console.error(
      '[OrderService] Failed to send Slack notification for order creation:',
      error,
    );
  });

  // Create and send in-app notifications to admins (fire and forget)
  createNotificationsForAdmins(
    order.id,
    order.orderNumber,
    'NEW_ORDER',
    order.userName || undefined,
  )
    .then((notifications) => {
      // Send notifications with FCM first, fallback to WebSocket
      notifications.forEach((notification) => {
        sendFCMWithCallbackFallback(
          notification.userId,
          notification,
          sendNotificationToWebSocketServer,
        ).catch((error) => {
          console.error(
            `[OrderService] Failed to send notification to user ${notification.userId}:`,
            error,
          );
        });
      });
    })
    .catch((error) => {
      console.error(
        '[OrderService] Failed to create/send admin notifications for new order:',
        error,
      );
    });

  return order;
}

export async function createGuestOrder(
  data: CreateGuestOrderData,
): Promise<UserOrder> {
  const { guestSessionId, deliveryAddress, deliveryPhone, notes, userName } =
    data;

  const cartItems = await dbClient.guestCartItem.findMany({
    where: {
      guestSessionId,
      product: { deletedAt: null },
    },
    include: { product: true },
  });

  if (cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  const totalPrice = await calculateTotalPrice(cartItems);
  const orderNumber = await generateOrderNumber();
  const orderItemsData = await buildOrderItemsData(cartItems);

  const order = await dbClient.$transaction(async (tx) => {
    const newOrder = await tx.userOrder.create({
      data: {
        orderNumber,
        userId: null,
        guestSessionId,
        userName,
        deliveryAddress,
        deliveryPhone,
        notes,
        totalPrice,
        status: 'PENDING',
        items: {
          create: orderItemsData,
        },
      },
      include: { items: true },
    });

    await tx.guestCartItem.deleteMany({
      where: { guestSessionId },
    });

    return newOrder;
  });

  notifyOrderCreated(order).catch((error) => {
    console.error(
      '[OrderService] Failed to send Slack notification for guest order creation:',
      error,
    );
  });

  createNotificationsForAdmins(
    order.id,
    order.orderNumber,
    'NEW_ORDER',
    order.userName || 'Guest',
  )
    .then((notifications) => {
      notifications.forEach((notification) => {
        sendFCMWithCallbackFallback(
          notification.userId,
          notification,
          sendNotificationToWebSocketServer,
        ).catch((error) => {
          console.error(
            `[OrderService] Failed to send notification to user ${notification.userId}:`,
            error,
          );
        });
      });
    })
    .catch((error) => {
      console.error(
        '[OrderService] Failed to create/send admin notifications for guest order:',
        error,
      );
    });

  return order;
}

export async function getGuestOrders(guestSessionId: string) {
  return dbClient.userOrder.findMany({
    where: { guestSessionId, userId: null },
    include: {
      items: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getGuestOrderById(
  orderId: string,
  guestSessionId: string,
) {
  return dbClient.userOrder.findFirst({
    where: {
      id: orderId,
      guestSessionId,
      userId: null,
    },
    include: {
      items: {
        include: { product: true },
      },
    },
  });
}

export async function migrateGuestDataToUser(
  userId: string,
  guestSessionId: string,
): Promise<void> {
  const [guestItems, userItems, user] = await Promise.all([
    dbClient.guestCartItem.findMany({
      where: { guestSessionId },
    }),
    dbClient.cartItem.findMany({
      where: { userId },
    }),
    dbClient.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
  ]);

  if (!guestItems.length && !user) return;

  const userItemByProduct = new Map(
    userItems.map((item) => [item.productId, item]),
  );

  await dbClient.$transaction(async (tx) => {
    await Promise.all(
      guestItems.map(async (guestItem) => {
        const existing = userItemByProduct.get(guestItem.productId);
        if (existing) {
          // Requirement: overwrite quantity if product already exists in user cart.
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: guestItem.quantity },
          });
          return;
        }
        await tx.cartItem.create({
          data: {
            userId,
            productId: guestItem.productId,
            quantity: guestItem.quantity,
          },
        });
      }),
    );

    await tx.userOrder.updateMany({
      where: { guestSessionId, userId: null },
      data: {
        userId,
        userName: user?.name,
        userEmail: user?.email,
      },
    });

    await tx.guestCartItem.deleteMany({
      where: { guestSessionId },
    });
  });
}

/**
 * Gets orders with pagination and filters
 */
export async function getOrders(filters: GetOrdersFilters) {
  const {
    userId,
    searchKeyword,
    status,
    dateFrom,
    dateTo,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
  } = filters;

  const pageSize = Math.min(limit, MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserOrderWhereInput = {};

  // Filter by userId if provided (for user's own orders)
  if (userId) {
    where.userId = userId;
  }

  // Search across UserOrder fields (snapshots and delivery info)
  if (searchKeyword && searchKeyword.trim()) {
    const keyword = searchKeyword.trim();
    where.OR = [
      { userName: { contains: keyword, mode: 'insensitive' } },
      { userEmail: { contains: keyword, mode: 'insensitive' } },
      { deliveryAddress: { contains: keyword, mode: 'insensitive' } },
      { deliveryPhone: { contains: keyword } },
    ];
  }

  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [orders, total] = await Promise.all([
    dbClient.userOrder.findMany({
      where,
      include: {
        items: {
          include: { product: true },
        },
        // Include user relation if it still exists (for backward compatibility)
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    dbClient.userOrder.count({ where }),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Gets a single order by ID
 */
export async function getOrderById(
  orderId: string,
  includeUser = false,
): Promise<UserOrder | null> {
  return dbClient.userOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true },
      },
      ...(includeUser && {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            address: true,
          },
        },
      }),
    },
  });
}

/**
 * Cancels an order (user cancellation)
 */
export async function cancelOrderByUser(
  orderId: string,
  userId: string,
  cancellationReason?: string,
): Promise<UserOrder> {
  const order = await dbClient.userOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.userId !== userId) {
    throw new Error('Unauthorized: Order does not belong to user');
  }

  if (order.status === 'COMPLETED') {
    throw new Error('Cannot cancel a completed order');
  }

  if (order.status === 'USER_CANCELLED' || order.status === 'ADMIN_CANCELLED') {
    throw new Error('Order is already cancelled');
  }

  const updatedOrder = await dbClient.userOrder.update({
    where: { id: orderId },
    data: {
      status: 'USER_CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancellationReason,
    },
  });

  // Send Slack notification (fire and forget - don't block on this)
  notifyOrderCancelledByUser(updatedOrder).catch((error) => {
    console.error(
      '[OrderService] Failed to send Slack notification for order cancellation:',
      error,
    );
  });

  // Create and send in-app notifications to admins (fire and forget)
  createNotificationsForAdmins(
    updatedOrder.id,
    updatedOrder.orderNumber,
    'ORDER_CANCELLED',
    updatedOrder.userName || undefined,
  )
    .then((notifications) => {
      // Send notifications with FCM first, fallback to WebSocket
      notifications.forEach((notification) => {
        sendFCMWithCallbackFallback(
          notification.userId,
          notification,
          sendNotificationToWebSocketServer,
        ).catch((error) => {
          console.error(
            `[OrderService] Failed to send notification to user ${notification.userId}:`,
            error,
          );
        });
      });
    })
    .catch((error) => {
      console.error(
        '[OrderService] Failed to create/send admin notifications for order cancellation:',
        error,
      );
    });

  return updatedOrder;
}

/**
 * Updates order status (admin only)
 */
export async function updateOrderStatus(
  orderId: string,
  status: UserOrderStatus,
  adminNotes?: string,
  cancellationReason?: string,
): Promise<UserOrder> {
  const order = await dbClient.userOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  const updateData: Prisma.UserOrderUpdateInput = {
    status,
    ...(adminNotes !== undefined && { adminNotes }),
  };

  // Set completion/cancellation timestamps
  if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
    updateData.completedAt = new Date();
  }

  if (status === 'ADMIN_CANCELLED') {
    updateData.cancelledAt = new Date();
    if (cancellationReason) {
      updateData.cancellationReason = cancellationReason;
    }
  }

  const previousStatus = order.status;
  const updatedOrder = await dbClient.userOrder.update({
    where: { id: orderId },
    data: updateData,
  });

  // Send Slack notification (fire and forget - don't block on this)
  notifyOrderStatusUpdated(updatedOrder, previousStatus).catch((error) => {
    console.error(
      '[OrderService] Failed to send Slack notification for order status update:',
      error,
    );
  });

  // Create and send in-app notification to order owner if status changed (fire and forget)
  if (previousStatus !== updatedOrder.status && updatedOrder.userId) {
    createNotificationForOrderStatusUpdate(
      updatedOrder.id,
      updatedOrder.userId,
      updatedOrder.orderNumber,
      updatedOrder.status,
      previousStatus,
    )
      .then((notification) => {
        if (notification) {
          // Send notification with FCM first, fallback to WebSocket
          sendFCMWithCallbackFallback(
            notification.userId,
            notification,
            sendNotificationToWebSocketServer,
          ).catch((error) => {
            console.error(
              `[OrderService] Failed to send notification to user ${notification.userId}:`,
              error,
            );
          });
        }
      })
      .catch((error) => {
        console.error(
          '[OrderService] Failed to create/send notification for order status update:',
          error,
        );
      });
  }

  return updatedOrder;
}

/**
 * Updates admin notes
 */
export async function updateAdminNotes(
  orderId: string,
  adminNotes: string,
): Promise<UserOrder> {
  const order = await dbClient.userOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  return dbClient.userOrder.update({
    where: { id: orderId },
    data: { adminNotes },
  });
}
