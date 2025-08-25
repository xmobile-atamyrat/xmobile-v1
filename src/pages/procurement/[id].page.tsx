import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useDollarRateContext } from '@/pages/lib/DollarRateContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import ActionsMenu from '@/pages/procurement/components/ActionsMenu';

import EmptyOrder from '@/pages/procurement/components/OrderTable';
import {
  editDollarRateUtil,
  getHistoryUtil,
} from '@/pages/procurement/lib/apiUtils';
import {
  DetailedOrder,
  HistoryPrice,
  ProcurementProductWithOrderStatus,
} from '@/pages/procurement/lib/types';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  DollarRate,
  ProcurementOrderProductQuantity,
  ProcurementSupplier,
} from '@prisma/client';

import { useRouter } from 'next/router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

export default function ProcurementSession() {
  const { user, accessToken } = useUserContext();
  const { rates } = useDollarRateContext();
  const fetchWithCreds = useFetchWithCreds();
  const router = useRouter();
  const { id } = router.query;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  const [selectedProducts, setSelectedProducts] = useState<
    ProcurementProductWithOrderStatus[]
  >([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<
    ProcurementSupplier[]
  >([]);

  const [selectedHistory, setSelectedHistory] = useState<DetailedOrder>();

  const [productQuantities, setProductQuantities] = useState<
    ProcurementOrderProductQuantity[]
  >([]);
  const [prices, setPrices] = useState<HistoryPrice>({});

  const [loading, setLoading] = useState(false);
  const [hashedQuantities, setHashedQuantities] = useState<
    Record<string, number>
  >({});
  const [orderCurrencyRate, setOrderCurrencyRate] = useState<DollarRate>();
  const [pricesMenuAnchorEl, setPricesMenuAnchorEl] =
    useState<null | HTMLElement>(null);

  const handleSelectHistory = useCallback(
    async (historyId: string) => {
      await getHistoryUtil({
        accessToken,
        id: historyId,
        fetchWithCreds,
        setSelectedHistory,
        setSelectedProducts,
        setSelectedSuppliers,
        setProductQuantities,
        setSnackbarMessage,
        setSnackbarOpen,
      });
    },
    [accessToken, fetchWithCreds],
  );

  const editDollarRate = useCallback(
    async (rate: number) => {
      if (!selectedHistory) return;
      await editDollarRateUtil({
        accessToken,
        rate,
        currency: selectedHistory.currency,
        fetchWithCreds,
        setSnackbarMessage,
        setSnackbarOpen,
      });
    },
    [accessToken, fetchWithCreds, selectedHistory],
  );

  // Load specific session when id is available
  useEffect(() => {
    if (accessToken && id && typeof id === 'string') {
      handleSelectHistory(id);
      setLoading(false);
    }
  }, [accessToken, id, handleSelectHistory]);

  // Update currency rate from context
  useLayoutEffect(() => {
    const dollarRates = Object.values(rates);
    if (dollarRates.length > 0) {
      setOrderCurrencyRate(dollarRates[0]);
    }
  }, [rates]);

  if (!user || user.grade !== 'SUPERUSER') {
    return (
      <Layout>
        <Box className="flex h-screen items-center justify-center">
          <Typography variant="h6" color="error">
            Доступ запрещен
          </Typography>
        </Box>
      </Layout>
    );
  }

  if (loading || !selectedHistory) {
    return (
      <Layout>
        <Box className="flex h-screen items-center justify-center">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box
        className="flex flex-col p-6"
        style={{
          minHeight: `calc(100vh - ${isMobile ? mobileAppBarHeight : appBarHeight}px)`,
        }}
      >
        <Box className="mb-6 flex items-center justify-between">
          <Box className="flex items-center gap-2">
            <IconButton
              onClick={() => router.push('/procurement')}
              sx={{ mr: 1 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
              {selectedHistory.name}
            </Typography>
          </Box>
          <Box className="flex gap-2">
            <Button
              className="h-9"
              onClick={(event) => setPricesMenuAnchorEl(event.currentTarget)}
              sx={{ textTransform: 'none' }}
              variant="outlined"
              endIcon={<KeyboardArrowDownIcon />}
            >
              Цены
            </Button>
            <Menu
              anchorEl={pricesMenuAnchorEl}
              open={Boolean(pricesMenuAnchorEl)}
              onClose={() => setPricesMenuAnchorEl(null)}
            >
              <MenuItem
                onClick={() => {
                  router.push('/procurement/all-prices');
                  setPricesMenuAnchorEl(null);
                }}
              >
                Все цены
              </MenuItem>
              <MenuItem
                onClick={() => {
                  router.push(`/procurement/prices/${selectedHistory.id}`);
                  setPricesMenuAnchorEl(null);
                }}
              >
                Цены сессии
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        <Box className="flex flex-col gap-6">
          <Box className="flex flex-row justify-between items-center">
            <Typography variant="h6">Товары и поставщики</Typography>
          </Box>

          <Box className="flex flex-col gap-4">
            <Box className="flex items-center gap-4">
              <Typography variant="h6">Курс доллара:</Typography>
              <TextField
                type="number"
                size="small"
                value={orderCurrencyRate?.rate || ''}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  if (!Number.isNaN(rate)) {
                    editDollarRate(rate);
                  }
                }}
                placeholder="Введите курс"
              />
              <Typography variant="body2">
                Валюта заказа: {selectedHistory.currency}
              </Typography>
            </Box>

            <EmptyOrder
              selectedProducts={selectedProducts}
              selectedSuppliers={selectedSuppliers}
              setProductQuantities={setProductQuantities}
              selectedHistory={selectedHistory}
              prices={prices}
              setPrices={setPrices}
              setSelectedProducts={setSelectedProducts}
              setSelectedSuppliers={setSelectedSuppliers}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarOpen={setSnackbarOpen}
              hashedQuantities={hashedQuantities}
              setHashedQuantities={setHashedQuantities}
            />
          </Box>

          <ActionsMenu
            hashedQuantities={hashedQuantities}
            selectedProducts={selectedProducts}
            selectedSuppliers={selectedSuppliers}
            productQuantities={productQuantities}
            prices={prices}
            selectedHistory={selectedHistory}
            setPrices={setPrices}
            setSnackbarMessage={setSnackbarMessage}
            setSnackbarOpen={setSnackbarOpen}
            actionsAnchor={null}
            setActionsAnchor={() => {}}
            setNewOrderDialog={() => {}}
            setLoading={setLoading}
          />
        </Box>

        {/* Dialogs */}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarMessage?.severity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage?.message}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
}
