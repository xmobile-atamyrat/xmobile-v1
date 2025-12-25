import { FetchWithCredsType, SnackbarProps } from '@/pages/lib/types';
import { UserOrder, UserOrderStatus } from '@prisma/client';
import { Dispatch, SetStateAction } from 'react';

interface GetOrdersParams {
  accessToken: string;
  status?: UserOrderStatus;
  searchKeyword?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  fetchWithCreds: FetchWithCredsType;
}

interface GetOrdersResponse {
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

export async function getOrdersList({
  accessToken,
  status,
  searchKeyword,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
  fetchWithCreds,
}: GetOrdersParams): Promise<GetOrdersResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (searchKeyword) queryParams.append('searchKeyword', searchKeyword);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) {
      // If dateTo is just a date (YYYY-MM-DD), append end of day time
      // Otherwise use as-is (in case it already includes time)
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
      path: `/api/order/admin?${queryParams.toString()}`,
      method: 'GET',
    });

    return { success, data, message };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      success: false,
      message: 'fetchOrdersError',
    };
  }
}

export async function getOrderDetail({
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
      path: `/api/order/admin/${orderId}`,
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

export async function updateOrderStatus({
  accessToken,
  orderId,
  status,
  adminNotes,
  cancellationReason,
  fetchWithCreds,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  orderId: string;
  status: UserOrderStatus;
  adminNotes?: string;
  cancellationReason?: string;
  fetchWithCreds: FetchWithCredsType;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}): Promise<UserOrder | null> {
  try {
    const { success, data, message } = await fetchWithCreds<UserOrder>({
      accessToken,
      path: `/api/order/admin/${orderId}?action=status`,
      method: 'PUT',
      body: {
        status,
        ...(adminNotes !== undefined && { adminNotes }),
        ...(cancellationReason && { cancellationReason }),
      },
    });

    if (success && data) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'statusUpdated',
        severity: 'success',
      });
      return data;
    }
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: message || 'updateStatusError',
      severity: 'error',
    });
    return null;
  } catch (error) {
    console.error('Error updating order status:', error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'updateStatusError',
      severity: 'error',
    });
    return null;
  }
}

export async function updateAdminNotes({
  accessToken,
  orderId,
  adminNotes,
  fetchWithCreds,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  orderId: string;
  adminNotes: string;
  fetchWithCreds: FetchWithCredsType;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}): Promise<UserOrder | null> {
  try {
    const { success, data, message } = await fetchWithCreds<UserOrder>({
      accessToken,
      path: `/api/order/admin/${orderId}?action=notes`,
      method: 'PUT',
      body: {
        adminNotes,
      },
    });

    if (success && data) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'notesUpdated',
        severity: 'success',
      });
      return data;
    }
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: message || 'updateNotesError',
      severity: 'error',
    });
    return null;
  } catch (error) {
    console.error('Error updating admin notes:', error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'updateNotesError',
      severity: 'error',
    });
    return null;
  }
}
