import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { ordersIndexClasses } from '@/styles/classMaps/orders/index';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Pagination,
  Snackbar,
  Typography,
} from '@mui/material';
import { UserOrder, UserOrderStatus } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import OrderCard from './components/OrderCard';
import OrderFilters from './components/OrderFilters';
import OrderTable from './components/OrderTable';
import { getUserOrdersList } from './lib/apiUtils';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

type TabType = 'ongoing' | 'completed';

export default function OrdersPage() {
  const router = useRouter();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const t = useTranslations();
  const platform = usePlatform();

  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  // Mobile tabs
  const [activeTab, setActiveTab] = useState<TabType>('ongoing');

  // Web filters
  const [status, setStatus] = useState<UserOrderStatus | undefined>();
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [, setTotal] = useState(0);

  // Determine status filter based on platform and tab
  const getStatusFilter = (): UserOrderStatus | undefined => {
    if (platform === 'mobile') {
      return activeTab === 'ongoing'
        ? undefined // Will filter in frontend
        : undefined; // Will filter in frontend
    }
    return status;
  };

  const fetchOrders = async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const statusFilter = getStatusFilter();
      const result = await getUserOrdersList({
        accessToken,
        status: statusFilter,
        dateFrom: platform === 'web' ? dateFrom : undefined,
        dateTo: platform === 'web' ? dateTo : undefined,
        page,
        limit,
        fetchWithCreds,
      });

      if (result.success && result.data) {
        let filteredOrders = result.data.orders;

        // Apply tab filtering on mobile
        if (platform === 'mobile') {
          if (activeTab === 'ongoing') {
            filteredOrders = filteredOrders.filter(
              (o) => o.status === 'PENDING' || o.status === 'IN_PROGRESS',
            );
          } else {
            filteredOrders = filteredOrders.filter(
              (o) =>
                o.status === 'COMPLETED' ||
                o.status === 'USER_CANCELLED' ||
                o.status === 'ADMIN_CANCELLED',
            );
          }
        }

        setOrders(filteredOrders);
        setTotalPages(result.data.pagination.totalPages);
        setTotal(result.data.pagination.total);
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: result.message || 'fetchOrdersError',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'fetchOrdersError',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/user/profile');
      return;
    }

    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, page, limit]);

  // Fetch orders when filters/tabs change
  useEffect(() => {
    if (user && accessToken) {
      setPage(1);
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, status, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setStatus(undefined);
    const date = new Date();
    date.setDate(date.getDate() - 30);
    setDateFrom(date.toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
    setPage(1);
  };

  const handleBackButton = () => {
    if (platform === 'mobile') {
      router.push('/user/profile');
    } else {
      router.push('/');
    }
  };

  return (
    <Layout handleHeaderBackButton={handleBackButton}>
      <Box
        sx={{
          mt:
            platform === 'web'
              ? `${appBarHeight}px`
              : `${mobileAppBarHeight}px`,
          p: platform === 'web' ? 2 : 1,
        }}
        className={ordersIndexClasses.container[platform]}
      >
        {/* Title */}
        <Box className="flex items-center gap-4 mb-4">
          {platform === 'mobile' && (
            <IconButton onClick={handleBackButton}>
              <ArrowBackIosIcon />
            </IconButton>
          )}
          <Typography
            className={`${interClassname.className} ${ordersIndexClasses.title[platform]}`}
          >
            {t('myOrders')}
          </Typography>
        </Box>

        {/* Mobile Tabs */}
        {platform === 'mobile' && (
          <Box className={ordersIndexClasses.tabs.mobile}>
            <Button
              className={`${ordersIndexClasses.tab.mobile} ${
                activeTab === 'ongoing'
                  ? ordersIndexClasses.tabActive.mobile
                  : ordersIndexClasses.tabInactive.mobile
              }`}
              onClick={() => setActiveTab('ongoing')}
              sx={{
                backgroundColor:
                  activeTab === 'ongoing' ? '#1c1b1b' : 'transparent',
                color: activeTab === 'ongoing' ? 'white' : '#1c1b1b',
                '&:hover': {
                  backgroundColor:
                    activeTab === 'ongoing' ? '#1c1b1b' : 'transparent',
                },
              }}
            >
              <Typography
                className={`${interClassname.className} font-medium text-[16px]`}
              >
                {t('ongoing')}
              </Typography>
            </Button>
            <Button
              className={`${ordersIndexClasses.tab.mobile} ${
                activeTab === 'completed'
                  ? ordersIndexClasses.tabActive.mobile
                  : ordersIndexClasses.tabInactive.mobile
              }`}
              onClick={() => setActiveTab('completed')}
              sx={{
                backgroundColor:
                  activeTab === 'completed' ? '#1c1b1b' : 'transparent',
                color: activeTab === 'completed' ? 'white' : '#1c1b1b',
                '&:hover': {
                  backgroundColor:
                    activeTab === 'completed' ? '#1c1b1b' : 'transparent',
                },
              }}
            >
              <Typography
                className={`${interClassname.className} font-medium text-[16px]`}
              >
                {t('completed')}
              </Typography>
            </Button>
          </Box>
        )}

        {/* Web Filters */}
        {platform === 'web' && (
          <OrderFilters
            status={status}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onStatusChange={setStatus}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onClear={handleClearFilters}
          />
        )}

        {/* Loading */}
        {loading && (
          <Box className="flex justify-center items-center py-12">
            <CircularProgress />
          </Box>
        )}

        {/* Empty State */}
        {!loading && orders.length === 0 && (
          <Box className={ordersIndexClasses.emptyState[platform]}>
            <Typography className={interClassname.className}>
              {t('noOrdersFound')}
            </Typography>
          </Box>
        )}

        {/* Orders List */}
        {!loading && orders.length > 0 && (
          <>
            {platform === 'web' ? (
              <OrderTable orders={orders} />
            ) : (
              <Box>
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </Box>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Box className={ordersIndexClasses.pagination[platform]}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage?.severity}
          variant="filled"
        >
          {snackbarMessage?.message && t(snackbarMessage.message)}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
