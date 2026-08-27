import Layout from '@/pages/components/Layout';
import { OrderListSkeleton } from '@/pages/components/SkeletonLoader';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AccountNav from '@/pages/user/components/AccountNav';
import { ordersIndexClasses } from '@/styles/classMaps/orders/index';
import { fontClassName } from '@/styles/theme';
import {
  Alert,
  Box,
  ButtonBase,
  Pagination,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { UserOrderStatus } from '@prisma/client';
import { ArrowLeft } from 'lucide-react';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import OrderCard from './components/OrderCard';
import OrderWebCard from './components/OrderWebCard';
import { getUserOrdersList, UserOrderWithItems } from './lib/apiUtils';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

type TabType = 'all' | 'ongoing' | 'completed';

// What each tab means in real `UserOrderStatus` terms. Cancelled orders sit
// under "Completed" (they are finished, just not delivered) — the semantics
// step 43 already shipped on mobile.
const TAB_STATUSES: Record<TabType, UserOrderStatus[] | undefined> = {
  all: undefined,
  ongoing: ['PENDING', 'IN_PROGRESS'],
  completed: ['COMPLETED', 'USER_CANCELLED', 'ADMIN_CANCELLED'],
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const t = useTranslations();
  const platform = usePlatform();

  const [orders, setOrders] = useState<UserOrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  // Status tabs — pills on web (spec 1758), the segmented row on mobile
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Web-only date range. Both bounds start empty so the default view is the
  // user's whole history, matching mobile; the old 30-day default silently hid
  // every older order behind a control the mockup doesn't even have.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [, setTotal] = useState(0);

  // Web filters in the `where` clause so the tab and the pagination agree;
  // mobile keeps its existing post-fetch filtering.
  const getStatusFilter = (): UserOrderStatus[] | undefined =>
    platform === 'web' ? TAB_STATUSES[activeTab] : undefined;

  const filterByTab = (list: UserOrderWithItems[]) => {
    const allowed = TAB_STATUSES[activeTab];
    return allowed ? list.filter((o) => allowed.includes(o.status)) : list;
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      if (!user) {
        const guestResp = await fetchWithoutCreds<UserOrderWithItems[]>(
          '/api/guest/order',
          'GET',
        );
        if (!guestResp.success) {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: guestResp.message || 'fetchOrdersError',
            severity: 'error',
          });
          return;
        }

        // The guest endpoint returns the whole (unpaginated) list, so the tab
        // is applied here on both platforms.
        const guestOrders = filterByTab(guestResp.data || []);

        setOrders(guestOrders);
        setTotalPages(1);
        setTotal(guestOrders.length);
        return;
      }

      if (!accessToken) return;

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
        // Web already filtered server-side via `getStatusFilter`.
        const filteredOrders =
          platform === 'mobile'
            ? filterByTab(result.data.orders)
            : result.data.orders;

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
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, page, limit]);

  // Fetch orders when filters/tabs change
  useEffect(() => {
    setPage(1);
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateFrom, dateTo]);

  const hasDateFilter = dateFrom !== '' || dateTo !== '';
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleBackButton = () => {
    router.push('/user');
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'ongoing', label: t('ongoing') },
    { key: 'completed', label: t('completed') },
  ];

  const snackbar = (
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
  );

  // The mockup's compact date box (48px/radius-12/2px navy focus), the same
  // field shape step 56 gave the checkout form.
  const dateFieldSx = {
    '& .MuiOutlinedInput-root': {
      height: '38px',
      borderRadius: '10px',
      backgroundColor: '#fff',
      fontSize: '13px',
      '& fieldset': { borderColor: '#ECECF1' },
      '&:hover fieldset': { borderColor: '#20166E' },
      '&.Mui-focused fieldset': { borderColor: '#20166E', borderWidth: '2px' },
    },
  };

  // Desktop order history (spec 1725-1790): account rail + status pills + cards.
  if (platform === 'web') {
    return (
      <Layout handleHeaderBackButton={handleBackButton}>
        <Box className={ordersIndexClasses.web.grid}>
          <AccountNav active="orders" />
          <Box className={ordersIndexClasses.web.col}>
            <Box className={ordersIndexClasses.web.headRow}>
              <Typography
                className={`${fontClassName.className} ${ordersIndexClasses.web.title}`}
              >
                {t('myOrders')}
              </Typography>
              <Box className={ordersIndexClasses.web.tabs}>
                {tabs.map((tab) => (
                  <ButtonBase
                    key={tab.key}
                    disableRipple
                    onClick={() => setActiveTab(tab.key)}
                    className={`${fontClassName.className} ${
                      ordersIndexClasses.web.tab
                    } ${
                      activeTab === tab.key
                        ? ordersIndexClasses.web.tabActive
                        : ordersIndexClasses.web.tabIdle
                    }`}
                  >
                    {tab.label}
                  </ButtonBase>
                ))}
              </Box>
            </Box>

            {/* Not in the mockup, kept because it is a real capability the web
                page already had — just no longer a 30-day default. */}
            <Box className={ordersIndexClasses.web.filterBar}>
              <Typography
                className={`${fontClassName.className} ${ordersIndexClasses.web.filterLabel}`}
              >
                {t('dateFrom')}
              </Typography>
              <TextField
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                sx={dateFieldSx}
              />
              <Typography
                className={`${fontClassName.className} ${ordersIndexClasses.web.filterDash}`}
              >
                —
              </Typography>
              <TextField
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                sx={dateFieldSx}
              />
              {hasDateFilter && (
                <ButtonBase
                  disableRipple
                  onClick={handleClearFilters}
                  className={`${fontClassName.className} ${ordersIndexClasses.web.clear}`}
                >
                  {t('clearAll')}
                </ButtonBase>
              )}
            </Box>

            {loading && <OrderListSkeleton count={5} />}

            {!loading && orders.length === 0 && (
              <Box className={ordersIndexClasses.web.empty}>
                <Typography
                  className={`${fontClassName.className} ${ordersIndexClasses.web.emptyText}`}
                >
                  {t('noOrdersFound')}
                </Typography>
              </Box>
            )}

            {!loading && orders.length > 0 && (
              <>
                <Box className={ordersIndexClasses.web.list}>
                  {orders.map((order) => (
                    <OrderWebCard key={order.id} order={order} />
                  ))}
                </Box>
                {totalPages > 1 && (
                  <Box className={ordersIndexClasses.web.pagination}>
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
        </Box>
        {snackbar}
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={handleBackButton}>
      <Box className={ordersIndexClasses.container[platform]}>
        {/* Mobile header + tabs */}
        {platform === 'mobile' && (
          <Box className={ordersIndexClasses.headerWrap.mobile}>
            <Box className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={handleBackButton}
                className={ordersIndexClasses.backButton.mobile}
                aria-label="back"
              >
                <ArrowLeft size={20} className="text-[#20166E]" />
              </button>
              <Typography
                className={`${fontClassName.className} ${ordersIndexClasses.title.mobile}`}
              >
                {t('myOrders')}
              </Typography>
            </Box>
            <Box className={ordersIndexClasses.tabs.mobile}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`${fontClassName.className} ${
                    ordersIndexClasses.tab.mobile
                  } ${
                    activeTab === tab.key
                      ? ordersIndexClasses.tabActive.mobile
                      : ordersIndexClasses.tabInactive.mobile
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </Box>
          </Box>
        )}

        {/* Content */}
        <Box className={ordersIndexClasses.content[platform]}>
          {/* Loading */}
          {loading && <OrderListSkeleton count={5} />}

          {/* Empty State */}
          {!loading && orders.length === 0 && (
            <Box className={ordersIndexClasses.emptyState[platform]}>
              <Typography
                className={`${fontClassName.className} ${ordersIndexClasses.emptyStateText[platform]}`}
              >
                {t('noOrdersFound')}
              </Typography>
            </Box>
          )}

          {/* Orders List */}
          {!loading && orders.length > 0 && (
            <>
              <Box>
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </Box>

              {/* Pagination */}
              <Box className={ordersIndexClasses.pagination[platform]}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            </>
          )}
        </Box>
      </Box>
      {snackbar}
    </Layout>
  );
}
