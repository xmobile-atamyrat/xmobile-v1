import { ResponseApi } from '@/pages/lib/types';
import { UserOrder } from '@prisma/client';
import {
  getOrderById,
  getOrders,
  GetOrdersFilters,
  updateAdminNotes,
  updateOrderStatus,
} from '../services/orderService';
import {
  updateAdminNotesSchema,
  updateOrderStatusSchema,
} from '../validators/orderValidators';

/**
 * Controller for getting all orders (admin)
 */
export async function getAdminOrdersController(
  filters: GetOrdersFilters,
): Promise<{ resp: ResponseApi; status: number }> {
  try {
    const result = await getOrders(filters);
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
 * Controller for getting a single order (admin)
 */
export async function getAdminOrderController(
  orderId: string,
): Promise<{ resp: ResponseApi<UserOrder>; status: number }> {
  try {
    const order = await getOrderById(orderId, true);

    if (!order) {
      return {
        resp: { success: false, message: 'Order not found' },
        status: 404,
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
 * Controller for updating order status (admin)
 */
export async function updateOrderStatusController(
  orderId: string,
  data: unknown,
): Promise<{ resp: ResponseApi<UserOrder>; status: number }> {
  try {
    const validated = updateOrderStatusSchema.parse(data);
    const order = await updateOrderStatus(
      orderId,
      validated.status,
      validated.adminNotes,
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
        message: error.message || 'Failed to update order status',
      },
      status: 400,
    };
  }
}

/**
 * Controller for updating admin notes
 */
export async function updateAdminNotesController(
  orderId: string,
  data: unknown,
): Promise<{ resp: ResponseApi<UserOrder>; status: number }> {
  try {
    const validated = updateAdminNotesSchema.parse(data);
    const order = await updateAdminNotes(orderId, validated.adminNotes);

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
        message: error.message || 'Failed to update admin notes',
      },
      status: 400,
    };
  }
}
