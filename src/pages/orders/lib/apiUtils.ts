import { FetchWithCredsType } from '@/pages/lib/types';
import { UserOrder, UserOrderStatus } from '@prisma/client';

// What the order endpoints actually return alongside the order row: the item
// snapshots taken at order time, each still linked to the product it came from
// (only used here for the thumbnail).
export interface OrderItemSnapshot {
  id: string;
  quantity: number;
  productName: string;
  productPrice: string;
  selectedVariant?: string | null;
  product?: { imgUrls: string[] } | null;
}

export type UserOrderWithItems = UserOrder & { items?: OrderItemSnapshot[] };

interface GetUserOrdersParams {
  accessToken: string;
  // A list is sent comma-separated and matches any of the given statuses.
  status?: UserOrderStatus | UserOrderStatus[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  fetchWithCreds: FetchWithCredsType;
}

interface GetUserOrdersResponse {
  success: boolean;
  data?: {
    orders: UserOrderWithItems[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export async function getUserOrdersList({
  accessToken,
  status,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
  fetchWithCreds,
}: GetUserOrdersParams): Promise<GetUserOrdersResponse> {
  try {
    const queryParams = new URLSearchParams();
    const statusParam = Array.isArray(status) ? status.join(',') : status;
    if (statusParam) queryParams.append('status', statusParam);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) {
      // If dateTo is just a date (YYYY-MM-DD), append end of day time
      const dateToValue =
        dateTo.length === 10 ? `${dateTo}T23:59:59.999Z` : dateTo;
      queryParams.append('dateTo', dateToValue);
    }
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());

    const { success, data, message } = await fetchWithCreds<{
      orders: UserOrderWithItems[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>({
      accessToken,
      path: `/api/order?${queryParams.toString()}`,
      method: 'GET',
    });

    return { success, data, message };
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return {
      success: false,
      message: 'fetchOrdersError',
    };
  }
}

export async function getUserOrderDetail({
  accessToken,
  orderId,
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<{ success: boolean; data?: UserOrderWithItems; message?: string }> {
  try {
    const { success, data, message } = await fetchWithCreds<UserOrderWithItems>(
      {
        accessToken,
        path: `/api/order/${orderId}`,
        method: 'GET',
      },
    );

    return { success, data, message };
  } catch (error) {
    console.error('Error fetching order detail:', error);
    return {
      success: false,
      message: 'fetchOrderError',
    };
  }
}

export async function cancelUserOrder({
  accessToken,
  orderId,
  cancellationReason,
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  cancellationReason?: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<{ success: boolean; data?: UserOrder; message?: string }> {
  try {
    const { success, data, message } = await fetchWithCreds<UserOrder>({
      accessToken,
      path: `/api/order/${orderId}?action=cancel`,
      method: 'PUT',
      body: {
        cancellationReason,
      },
    });

    return { success, data, message };
  } catch (error) {
    console.error('Error cancelling order:', error);
    return {
      success: false,
      message: 'cancelOrderError',
    };
  }
}
