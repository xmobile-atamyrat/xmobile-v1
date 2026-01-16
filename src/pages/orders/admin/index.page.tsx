import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { userOrdersIndexClasses } from '@/styles/classMaps/userOrders';
import { interClassname } from '@/styles/theme';
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Pagination,
  Select,
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
import { getOrdersList } from './lib/apiUtils';

export const getStaticProps = (async () => {
  // For static export, we can't rely on context.locale (Next.js i18n)
  // Load default locale messages at build time
  // Client-side will switch locale based on cookie
  const defaultLocale = 'ru';
  let messages = {};
  try {
    messages = (await import(`../../../i18n/${defaultLocale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
      // Also load all locale messages so client can switch without page reload
      allMessages: {
        en: (await import('../../../i18n/en.json')).default,
        ru: (await import('../../../i18n/ru.json')).default,
        tk: (await import('../../../i18n/tk.json')).default,
        ch: (await import('../../../i18n/ch.json')).default,
        tr: (await import('../../../i18n/tr.json')).default,
      },
    },
  };
}) satisfies GetStaticProps<object>;

export default function UserOrdersPage() {
  const router = useRouter();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const t = useTranslations();
  const platform = usePlatform();

  const [orders, setOrders] = useState<
    (UserOrder & {
      user?: {
        name: string;
        phoneNumber: string | null;
      };
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  // Filters
  const [status, setStatus] = useState<UserOrderStatus | undefined>();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState('');
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
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchOrders = async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const result = await getOrdersList({
        accessToken,
        status,
        searchKeyword: debouncedSearchKeyword || undefined,
        dateFrom,
        dateTo,
        page,
        limit,
        fetchWithCreds,
      });

      if (result.success && result.data) {
        setOrders(result.data.orders);
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
      return;
    }

    if (!['ADMIN', 'SUPERUSER'].includes(user.grade)) {
      router.push('/');
      return;
    }

    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, page, limit]);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const handleClearFilters = () => {
    setStatus(undefined);
    setSearchKeyword('');
    setDebouncedSearchKeyword('');
    const date = new Date();
    date.setDate(date.getDate() - 30);
    setDateFrom(date.toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
    setPage(1);
  };

  // Fetch orders when filters change
  useEffect(() => {
    if (user && accessToken) {
      setPage(1);
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedSearchKeyword, dateFrom, dateTo]);

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {['ADMIN', 'SUPERUSER'].includes(user?.grade) && (
        <Box
          sx={{
            mt:
              platform === 'web'
                ? `${appBarHeight}px`
                : `${mobileAppBarHeight}px`,
            p: platform === 'web' ? 2 : 1,
          }}
          className={userOrdersIndexClasses.box[platform]}
        >
          <Box className={userOrdersIndexClasses.header[platform]}>
            <Typography
              className={`${interClassname.className} ${userOrdersIndexClasses.title[platform]}`}
            >
              {t('userOrders')}
            </Typography>
          </Box>

          <OrderFilters
            status={status}
            searchKeyword={searchKeyword}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onStatusChange={setStatus}
            onSearchKeywordChange={setSearchKeyword}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onClear={handleClearFilters}
          />

          {loading && (
            <Box className="flex justify-center items-center py-12">
              <CircularProgress />
            </Box>
          )}
          {!loading && orders.length === 0 && (
            <Box className={userOrdersIndexClasses.emptyState[platform]}>
              <Typography className={interClassname.className}>
                {t('noOrdersFound')}
              </Typography>
            </Box>
          )}
          {!loading && orders.length > 0 && (
            <>
              {platform === 'web' && <OrderTable orders={orders} />}
              {platform === 'mobile' && (
                <Box className="flex flex-col">
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </Box>
              )}

              <Box className={userOrdersIndexClasses.pagination[platform]}>
                <Box className="flex flex-row items-center gap-2">
                  <Typography className={interClassname.className}>
                    {t('itemsPerPage')}:
                  </Typography>
                  <Select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    size="small"
                    sx={{ minWidth: 80 }}
                  >
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                  </Select>
                </Box>

                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                />

                <Typography className={interClassname.className}>
                  {t('page')} {page} {t('of')} {totalPages} ({total}{' '}
                  {t('total').toLowerCase()})
                </Typography>
              </Box>
            </>
          )}

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              setSnackbarOpen(false);
            }}
          >
            <Alert
              onClose={() => setSnackbarOpen(false)}
              severity={snackbarMessage?.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbarMessage?.message && t(snackbarMessage.message)}
            </Alert>
          </Snackbar>
        </Box>
      )}
    </Layout>
  );
}
