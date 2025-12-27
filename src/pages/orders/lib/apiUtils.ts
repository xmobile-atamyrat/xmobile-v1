import { FetchWithCredsType } from '@/pages/lib/types';
import { UserOrder, UserOrderStatus } from '@prisma/client';

interface GetUserOrdersParams {
  accessToken: string;
  status?: UserOrderStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  fetchWithCreds: FetchWithCredsType;
}

interface GetUserOrdersResponse {
  success: boolean;
  data?: {
    orders: UserOrder[];
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
    if (status) queryParams.append('status', status);
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
      orders: UserOrder[];
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
}): Promise<{ success: boolean; data?: UserOrder; message?: string }> {
  try {
    const { success, data, message } = await fetchWithCreds<UserOrder>({
      accessToken,
      path: `/api/order/${orderId}`,
      method: 'GET',
    });

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
