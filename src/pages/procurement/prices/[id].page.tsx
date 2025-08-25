import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { updateProductPricing } from '@/pages/procurement/lib/apis';
import { getHistoryUtil } from '@/pages/procurement/lib/apiUtils';
import { ProcurementOrderProductWithPricing } from '@/pages/procurement/lib/types';
import {
  convertCurrency,
  downloadExcelFile,
  roundByCurrency,
} from '@/pages/procurement/lib/utils';
import { debounce } from '@/pages/product/utils';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  DollarRate,
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
} from '@prisma/client';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

interface DetailedOrderForPricing extends ProcurementOrder {
  products: Array<
    ProcurementOrderProductWithPricing & { product: ProcurementProduct }
  >;
  suppliers: Array<{
    supplierId: string;
    supplier: {
      name: string;
    };
  }>;
  prices: Array<{
    productId: string;
    supplierId: string;
    price: number;
    color: 'green' | 'orange' | 'white';
  }>;
  productQuantities: ProcurementOrderProductQuantity[];
  dollarRate: DollarRate;
}

export default function PricingSession() {
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const router = useRouter();
  const { id } = router.query;

  const [order, setOrder] = useState<DetailedOrderForPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'TMT'>('USD');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [downloadMode, setDownloadMode] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'productName',
  ]);

  const fetchOrder = useCallback(async () => {
    if (!accessToken || !id || typeof id !== 'string') return;

    setLoading(true);
    try {
      await getHistoryUtil({
        accessToken,
        id,
        setSelectedHistory: (history) =>
          setOrder(history as DetailedOrderForPricing),
        setSelectedSuppliers: () => {}, // Not needed for pricing
        setSelectedProducts: () => {}, // Not needed for pricing
        setSnackbarOpen,
        setSnackbarMessage,
        setProductQuantities: () => {}, // Not needed for pricing
        fetchWithCreds,
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, fetchWithCreds]);

  useEffect(() => {
    if (accessToken && id) {
      fetchOrder();
    }
  }, [accessToken, id]);

  // Immediate UI update function
  const updateLocalState = useCallback(
    (productId: string, field: string, value: number | string | boolean) => {
      setOrder((prev) => {
        if (!prev) return prev;

        const product = prev.products.find((p) => p.productId === productId);
        if (!product) return prev;

        // Calculate final prices if needed
        const updatedData: any = { [field]: value };

        if (
          field === 'singleProductPrice' ||
          field === 'singleProductPercent'
        ) {
          const price =
            field === 'singleProductPrice'
              ? (value as number)
              : product.singleProductPrice;
          const percent =
            field === 'singleProductPercent'
              ? (value as number)
              : product.singleProductPercent;

          if (price && percent) {
            const finalPrice = roundByCurrency(
              price * (1 + percent / 100),
              displayCurrency,
            );
            updatedData.finalSinglePrice = finalPrice;
          }
        }

        if (field === 'bulkProductPrice' || field === 'bulkProductPercent') {
          const price =
            field === 'bulkProductPrice'
              ? (value as number)
              : product.bulkProductPrice;
          const percent =
            field === 'bulkProductPercent'
              ? (value as number)
              : product.bulkProductPercent;

          if (price && percent) {
            const finalPrice = roundByCurrency(
              price * (1 + percent / 100),
              displayCurrency,
            );
            updatedData.finalBulkPrice = finalPrice;
          }
        }

        return {
          ...prev,
          products: prev.products.map((p) =>
            p.productId === productId ? { ...p, ...updatedData } : p,
          ),
        };
      });
    },
    [displayCurrency],
  );

  // Debounced API call function
  const debouncedApiUpdate = useCallback(
    debounce(
      async (
        productId: string,
        field: string,
        value: number | string | boolean,
      ) => {
        if (!accessToken || !order) return;

        const product = order.products.find((p) => p.productId === productId);
        if (!product) return;

        // Calculate final prices for API call
        const updatedData: any = { [field]: value };

        if (
          field === 'singleProductPrice' ||
          field === 'singleProductPercent'
        ) {
          const price =
            field === 'singleProductPrice'
              ? (value as number)
              : product.singleProductPrice;
          const percent =
            field === 'singleProductPercent'
              ? (value as number)
              : product.singleProductPercent;

          if (price && percent) {
            const finalPrice = roundByCurrency(
              price * (1 + percent / 100),
              displayCurrency,
            );
            updatedData.finalSinglePrice = finalPrice;
          }
        }

        if (field === 'bulkProductPrice' || field === 'bulkProductPercent') {
          const price =
            field === 'bulkProductPrice'
              ? (value as number)
              : product.bulkProductPrice;
          const percent =
            field === 'bulkProductPercent'
              ? (value as number)
              : product.bulkProductPercent;

          if (price && percent) {
            const finalPrice = roundByCurrency(
              price * (1 + percent / 100),
              displayCurrency,
            );
            updatedData.finalBulkPrice = finalPrice;
          }
        }

        try {
          const { success } = await updateProductPricing({
            accessToken,
            orderId: order.id,
            productId,
            ...updatedData,
            fetchWithCreds,
          });

          if (success) {
            setSnackbarOpen(true);
            setSnackbarMessage({
              message: 'Цены обновлены',
              severity: 'success',
            });
          }
        } catch (error) {
          console.error('Pricing update error:', error);
          // Revert local state on error
          fetchOrder();
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'Ошибка обновления цен',
            severity: 'error',
          });
        }
      },
      500,
    ),
    [accessToken, order, fetchWithCreds, displayCurrency, fetchOrder],
  );

  // Combined handler that updates UI immediately and calls API with debounce
  const handlePricingUpdate = useCallback(
    (productId: string, field: string, value: number | string | boolean) => {
      // Update UI immediately
      updateLocalState(productId, field, value);

      // Make debounced API call
      debouncedApiUpdate(productId, field, value);
    },
    [updateLocalState, debouncedApiUpdate],
  );

  const handleBulkPercentUpdate = () => {
    // eslint-disable-next-line no-alert
    const percentInput = window.prompt(
      'Введите процент для выбранных товаров:',
    );
    if (!percentInput || selectedProducts.length === 0) return;

    const percent = parseFloat(percentInput);
    if (Number.isNaN(percent)) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'Неверный формат процента',
        severity: 'error',
      });
      return;
    }

    selectedProducts.forEach((productId) => {
      handlePricingUpdate(productId, 'singleProductPercent', percent);
      handlePricingUpdate(productId, 'bulkProductPercent', percent);
    });

    setSelectedProducts([]);
  };

  const convertPrice = useCallback(
    (price: number | null | undefined, fromCurrency: string) => {
      if (!price || !order?.dollarRate) return price;

      // Get exchange rates (should come from database, but hardcoded for now)
      let currencyToUsdRate = 1.0;
      if (fromCurrency === order.currency) {
        currencyToUsdRate = order.dollarRate.rate;
      } else if (fromCurrency === 'CNY') {
        currencyToUsdRate = 7.0;
      } else if (fromCurrency === 'AED') {
        currencyToUsdRate = 3.67;
      }
      const usdToTmtRate = 3.5;

      return convertCurrency(
        price,
        fromCurrency,
        displayCurrency,
        currencyToUsdRate,
        usdToTmtRate,
      );
    },
    [displayCurrency, order?.dollarRate, order?.currency],
  );

  // Helper function to get the cheapest (green) price for a product
  const getOriginalPriceAndSupplier = useCallback(
    (productId: string) => {
      if (!order?.prices) return { price: null, supplier: null };

      const greenPrice = order.prices.find(
        (price) => price.productId === productId && price.color === 'green',
      );

      if (!greenPrice) return { price: null, supplier: null };

      const supplier = order.suppliers.find(
        (s) => s.supplierId === greenPrice.supplierId,
      );

      return {
        price: greenPrice.price,
        supplier: supplier?.supplier?.name || null,
      };
    },
    [order?.prices, order?.suppliers],
  );

  const formatPrice = useCallback(
    (price: number | null | undefined) => {
      if (!price) return '';
      return displayCurrency === 'TMT'
        ? `${Math.round(price)}`
        : `${price.toFixed(2)}`;
    },
    [displayCurrency],
  );

  const availableColumns = [
    { key: 'productName', label: 'Название товара', required: true },
    { key: 'supplier', label: 'Поставщик' },
    { key: 'orderReceived', label: 'Получено' },
    { key: 'quantity', label: 'Количество' },
    { key: 'singleProductPrice', label: 'Цена поставщика' },
    { key: 'singleProductPercent', label: 'Надбавка розница (%)' },
    { key: 'bulkProductPrice', label: 'Оптовая цена поставщика' },
    { key: 'bulkProductPercent', label: 'Надбавка опт (%)' },
    { key: 'finalSinglePrice', label: 'Итоговая розница' },
    { key: 'finalBulkPrice', label: 'Итоговый опт' },
  ];

  const handleDownload = async () => {
    if (!order || selectedColumns.length === 0) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'Выберите хотя бы одну колонку',
        severity: 'error',
      });
      return;
    }

    try {
      // Filter only ordered products for download
      const orderedProductsForDownload = order.products.filter(
        (p) => p.ordered,
      );

      // Prepare data for download
      const dataForDownload = orderedProductsForDownload.map((product) => {
        const quantity =
          order.productQuantities.find((q) => q.productId === product.productId)
            ?.quantity || 0;

        const { supplier } = getOriginalPriceAndSupplier(product.productId);

        return {
          ...product,
          product: product.product,
          supplier: supplier || 'Не указан',
          quantity,
          singleProductPrice: convertPrice(
            product.singleProductPrice,
            order.currency,
          ),
          bulkProductPrice: convertPrice(
            product.bulkProductPrice,
            order.currency,
          ),
          finalSinglePrice: convertPrice(
            product.finalSinglePrice,
            order.currency,
          ),
          finalBulkPrice: convertPrice(product.finalBulkPrice, order.currency),
        };
      });

      const success = await downloadExcelFile(
        dataForDownload,
        selectedColumns,
        `цены-${order.name}-${displayCurrency}-${new Date().toISOString().split('T')[0]}`,
        displayCurrency,
      );

      if (success) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'Файл успешно скачан',
          severity: 'success',
        });
        setDownloadMode(false);
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'Ошибка при скачивании файла',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'Ошибка при скачивании файла',
        severity: 'error',
      });
    }
  };

  if (!user || user.grade !== 'SUPERUSER') {
    return (
      <Box className="flex h-screen items-center justify-center">
        <Typography variant="h6" color="error">
          Доступ запрещен
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box className="flex h-screen items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  if (!order) {
    return (
      <Box className="flex h-screen items-center justify-center">
        <Typography variant="h6" color="error">
          Заказ не найден
        </Typography>
      </Box>
    );
  }

  // Filter only ordered products
  const orderedProducts = order.products.filter((p) => p.ordered);

  return (
    <Box className="container mx-auto p-4">
      <Box className="mb-6 flex items-center justify-between">
        <Box className="flex items-center gap-2">
          <IconButton
            onClick={() => router.push(`/procurement/${id}`)}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Управление ценами: {order.name}
          </Typography>
        </Box>
        <Box className="flex gap-2">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Валюта</InputLabel>
            <Select
              value={displayCurrency}
              label="Валюта"
              onChange={(e) =>
                setDisplayCurrency(e.target.value as 'USD' | 'TMT')
              }
            >
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="TMT">TMT</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant={downloadMode ? 'contained' : 'outlined'}
            onClick={() => setDownloadMode(!downloadMode)}
          >
            {downloadMode ? 'Отменить' : 'Скачать'}
          </Button>
        </Box>
      </Box>

      <Card className="mb-4">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Информация о заказе
          </Typography>
          <Typography>Исходная валюта: {order?.currency}</Typography>
          <Typography>Курс доллара: {order?.dollarRate?.rate}</Typography>
        </CardContent>
      </Card>

      {downloadMode && (
        <Card className="mb-4">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Выберите колонки для скачивания
            </Typography>
            <Box className="grid gap-2 md:grid-cols-3">
              {availableColumns.map((column) => (
                <Box key={column.key}>
                  <Checkbox
                    checked={selectedColumns.includes(column.key)}
                    disabled={column.required}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedColumns((prev) => [...prev, column.key]);
                      } else {
                        setSelectedColumns((prev) =>
                          prev.filter((columnKey) => columnKey !== column.key),
                        );
                      }
                    }}
                  />
                  {column.label}
                  {column.required && ' (обязательно)'}
                </Box>
              ))}
            </Box>
            <Box className="mt-4 flex gap-2">
              <Button variant="contained" onClick={handleDownload}>
                Скачать Excel
              </Button>
              <Typography variant="body2" className="flex items-center">
                Валюта: {displayCurrency}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {selectedProducts.length > 0 && (
        <Card className="mb-4">
          <CardContent>
            <Box className="flex items-center justify-between">
              <Typography>
                Выбрано товаров: {selectedProducts.length}
              </Typography>
              <Button variant="contained" onClick={handleBulkPercentUpdate}>
                Применить процент ко всем
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {orderedProducts.length === 0 ? (
        <Card>
          <CardContent className="text-center">
            <Typography variant="h6" color="textSecondary">
              Нет заказанных товаров для управления ценами
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Checkbox
                    checked={selectedProducts.length === orderedProducts.length}
                    indeterminate={
                      selectedProducts.length > 0 &&
                      selectedProducts.length < orderedProducts.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts(
                          orderedProducts.map((p) => p.productId),
                        );
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                  />
                </TableCell>
                <TableCell>Товар</TableCell>
                <TableCell>Поставщик</TableCell>
                <TableCell>Получено</TableCell>
                <TableCell>Количество</TableCell>
                <TableCell>Цена от поставщика</TableCell>
                <TableCell>% надбавки (шт)</TableCell>
                <TableCell>Оптовая цена</TableCell>
                <TableCell>% надбавки (опт)</TableCell>
                <TableCell>Итого (шт)</TableCell>
                <TableCell>Итого (опт)</TableCell>
                <TableCell>Комментарий</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderedProducts.map((product) => {
                const quantity =
                  order.productQuantities.find(
                    (q) => q.productId === product.productId,
                  )?.quantity || 0;

                const { price: originalPrice, supplier } =
                  getOriginalPriceAndSupplier(product.productId);

                return (
                  <TableRow key={product.productId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.includes(product.productId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts((prev) => [
                              ...prev,
                              product.productId,
                            ]);
                          } else {
                            setSelectedProducts((prev) =>
                              prev.filter(
                                (productId) => productId !== product.productId,
                              ),
                            );
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>{product.product.name}</TableCell>
                    <TableCell>{supplier || 'Не указан'}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={product.orderReceived || false}
                        onChange={(e) => {
                          handlePricingUpdate(
                            product.productId,
                            'orderReceived',
                            e.target.checked,
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>{quantity}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        sx={{ minWidth: 120 }}
                        value={formatPrice(
                          convertPrice(
                            product.singleProductPrice || originalPrice,
                            order.currency,
                          ),
                        )}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value)) {
                            handlePricingUpdate(
                              product.productId,
                              'singleProductPrice',
                              value,
                            );
                          }
                        }}
                        placeholder="Цена"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        sx={{ minWidth: 80 }}
                        value={product.singleProductPercent || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value)) {
                            handlePricingUpdate(
                              product.productId,
                              'singleProductPercent',
                              value,
                            );
                          }
                        }}
                        placeholder="%"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        sx={{ minWidth: 120 }}
                        value={formatPrice(
                          convertPrice(
                            product.bulkProductPrice,
                            order.currency,
                          ),
                        )}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value)) {
                            handlePricingUpdate(
                              product.productId,
                              'bulkProductPrice',
                              value,
                            );
                          }
                        }}
                        placeholder="Опт цена"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        sx={{ minWidth: 80 }}
                        value={product.bulkProductPercent || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value)) {
                            handlePricingUpdate(
                              product.productId,
                              'bulkProductPercent',
                              value,
                            );
                          }
                        }}
                        placeholder="%"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {formatPrice(
                          convertPrice(
                            product.finalSinglePrice,
                            order.currency,
                          ),
                        )}{' '}
                        {displayCurrency}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {formatPrice(
                          convertPrice(product.finalBulkPrice, order.currency),
                        )}{' '}
                        {displayCurrency}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        multiline
                        rows={2}
                        maxRows={6}
                        sx={{ minWidth: 200, width: '100%' }}
                        value={product.comment || ''}
                        onChange={(e) => {
                          handlePricingUpdate(
                            product.productId,
                            'comment',
                            e.target.value,
                          );
                        }}
                        placeholder="Комментарий"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage?.severity}
        >
          {snackbarMessage?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
