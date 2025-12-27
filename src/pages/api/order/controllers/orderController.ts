import { ResponseApi } from '@/pages/lib/types';
import { UserOrder } from '@prisma/client';
import {
  cancelOrderByUser,
  createOrder,
  getOrderById,
  getOrders,
  GetOrdersFilters,
} from '../services/orderService';
import {
  cancelOrderSchema,
  createOrderSchema,
} from '../validators/orderValidators';

/**
 * Controller for creating a new order
 */
export async function createOrderController(
  data: unknown,
  userId: string,
): Promise<{ resp: ResponseApi<UserOrder>; status: number }> {
  try {
    const validated = createOrderSchema.parse(data);
    const order = await createOrder({
      userId,
      deliveryAddress: validated.deliveryAddress,
      deliveryPhone: validated.deliveryPhone,
      notes: validated.notes,
      updateAddress: validated.updateAddress,
    });

    return {
      resp: { success: true, data: order },
      status: 200,
    };
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return {
        resp: {
          success: false,
          message: `Validation error: ${error.errors[0].message}`,
        },
        status: 400,
      };
    }

    return {
      resp: {
        success: false,
        message: error.message || 'Failed to create order',
      },
      status: 400,
    };
  }
}

/**
 * Controller for getting user's orders
 */
export async function getUserOrdersController(
  filters: GetOrdersFilters,
  userId: string,
): Promise<{ resp: ResponseApi; status: number }> {
  try {
    const result = await getOrders({
      ...filters,
      userId, // Always filter by the authenticated user's ID
    });
    return {
      resp: {
        success: true,
        data: {
          orders: result.orders,
          pagination: result.pagination,
        },
      },
      status: 200,
    };
  } catch (error: any) {
    return {
      resp: {
        success: false,
        message: error.message || 'Failed to fetch orders',
      },
      status: 500,
    };
  }
}

/**
 * Controller for getting a single order
 */
export async function getOrderController(
  orderId: string,
  userId: string,
  isAdmin = false,
): Promise<{ resp: ResponseApi<UserOrder>; status: number }> {
  try {
    const order = await getOrderById(orderId, isAdmin);

    if (!order) {
      return {
        resp: { success: false, message: 'Order not found' },
        status: 404,
      };
    }

    // Check if user owns the order (unless admin)
    if (!isAdmin && order.userId !== userId) {
      return {
        resp: { success: false, message: 'Unauthorized' },
        status: 403,
      };
    }

    return {
      resp: { success: true, data: order },
      status: 200,
    };
  } catch (error: any) {
    return {
      resp: {
        success: false,
        message: error.message || 'Failed to fetch order',
      },
      status: 500,
    };
  }
}

/**
 * Controller for user cancelling their order
 */
export async function cancelOrderController(
  orderId: string,
  userId: string,
  data: unknown,
): Promise<{ resp: ResponseApi<UserOrder>; status: number }> {
  try {
    const validated = cancelOrderSchema.parse(data);
    const order = await cancelOrderByUser(
      orderId,
      userId,
      validated.cancellationReason,
    );

    return {
      resp: { success: true, data: order },
      status: 200,
    };
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return {
        resp: {
          success: false,
          message: `Validation error: ${error.errors[0].message}`,
        },
        status: 400,
      };
    }

    return {
      resp: {
        success: false,
        message: error.message || 'Failed to cancel order',
      },
      status: 400,
    };
  }
}
